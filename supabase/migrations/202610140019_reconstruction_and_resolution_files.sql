begin;
create function public.intrack_resolution_file_command(command_id uuid,action text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype;actor uuid;receipt jsonb;doc intrack.documents%rowtype;id uuid;path text;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,'student');receipt:=intrack.begin_command(actor,command_id,'resolution_file:'||action,payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Current active enrollment required' using errcode='40001';end if;
 if action='reserve' then
  if coalesce((payload->>'bytes')::bigint,0) not between 1 and 10485760 or payload->>'mimeType' not in ('application/pdf','image/png','image/jpeg') or coalesce(length(trim(payload->>'name')),0) not between 1 and 240 then raise exception 'Valid bounded file metadata required' using errcode='22023';end if;
  if (select count(*) from intrack.documents where uploaded_by=actor and status='pending')>=20 then raise exception 'Resolve pending file reservations first' using errcode='40001';end if;
  id:=gen_random_uuid();path:=e.id::text||'/resolution/'||id::text;
  insert into intrack.documents(id,enrollment_id,purpose,uploaded_by,object_path,original_name,mime_type,byte_count) values(id,e.id,'attendance_resolution',actor,path,trim(payload->>'name'),payload->>'mimeType',(payload->>'bytes')::bigint);
  insert into intrack.requirement_uploads(document_id,enrollment_revision) values(id,e.revision);
 else
  if action<>'finalize' then raise exception 'Unsupported file command' using errcode='22023';end if;
  select * into doc from intrack.documents where documents.id=(payload->>'documentId')::uuid and enrollment_id=e.id and purpose='attendance_resolution' and uploaded_by=actor for update;
  if doc.id is null or doc.status<>'validated' or not exists(select 1 from intrack.requirement_uploads where document_id=doc.id and expires_at>now() and enrollment_revision=e.revision) then raise exception 'Current verified resolution upload required' using errcode='40001';end if;
  update intrack.documents set status='attached' where documents.id=doc.id;id:=doc.id;path:=doc.object_path;
 end if;
 return intrack.finish_command(actor,command_id,'resolution_file:'||action,payload,jsonb_build_object('documentId',id,'path',path),'document',id,e.id);
end $$;

create function public.intrack_reconstruction_command(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype;p intrack.placements%rowtype;r intrack.reconstruction_requests%rowtype;s intrack.attendance_sessions%rowtype;
 actor uuid;receipt jsonb;action text:=payload->>'action';start_at timestamptz;end_at timestamptz;settings jsonb;authority jsonb;id uuid;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='request' then 'student' else 'adviser' end);
 receipt:=intrack.begin_command(actor,command_id,'reconstruction',payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Active current enrollment and reason required' using errcode='40001';end if;
 if action='request' then
  start_at:=(payload->>'clockInAt')::timestamptz;end_at:=(payload->>'clockOutAt')::timestamptz;
  if start_at is null or end_at is null or end_at<=start_at or end_at>now() or end_at>start_at+interval '24 hours' then raise exception 'Historical bounded interval required' using errcode='22023';end if;
  if not exists(select 1 from intrack.documents where documents.id=(payload->>'evidenceDocumentId')::uuid and enrollment_id=e.id and uploaded_by=actor and status='attached') then raise exception 'Attached owned evidence required' using errcode='42501';end if;
  insert into intrack.reconstruction_requests(enrollment_id,placement_id,requested_by,proposed_clock_in,proposed_clock_out,evidence_document_id,reason,status)
   values(e.id,(payload->>'placementId')::uuid,actor,start_at,end_at,(payload->>'evidenceDocumentId')::uuid,trim(payload->>'reason'),'pending') returning reconstruction_requests.id into id;
 elsif action in ('approve','reject') then
  select * into r from intrack.reconstruction_requests where reconstruction_requests.id=(payload->>'requestId')::uuid and enrollment_id=e.id for update;
  if r.id is null or r.status<>'pending' or actor=e.student_id or r.requested_by=actor or (payload->>'expectedRequestRevision')::integer is distinct from r.revision then raise exception 'Current other-user request required' using errcode='40001';end if;
  if action='approve' then
   start_at:=r.proposed_clock_in;end_at:=r.proposed_clock_out;
   select * into p from intrack.placements where placements.id=r.placement_id and enrollment_id=e.id;
   select attendance_policy into settings from intrack.policy_versions where policy_versions.id=e.policy_version_id and confirmed_at is not null;
   select jsonb_build_object('clearanceEventId',c.id,'basis',c.basis_snapshot) into authority from intrack.clearance_events c where enrollment_id=e.id and placement_id=p.id and effective_at<=start_at order by effective_at desc,enrollment_revision desc limit 1;
   if authority is null or not exists(select 1 from intrack.clearance_events c where c.id=(authority->>'clearanceEventId')::uuid and c.status='active') then raise exception 'Historical active deployment clearance required' using errcode='42501';end if;
   if p.id is null or (settings->>'confirmed')::boolean is distinct from true or start_at<(p.starts_on::timestamp at time zone 'Asia/Manila') or (p.ends_on is not null and end_at>((p.ends_on+1)::timestamp at time zone 'Asia/Manila')) or end_at>now() or end_at>start_at+make_interval(mins=>(settings->>'maxSessionMinutes')::integer) then raise exception 'Historical placement/policy required' using errcode='22023';end if;
   if not intrack.schedule_allows(p.schedule_snapshot,start_at) and not exists(select 1 from intrack.attendance_exceptions where enrollment_id=e.id and placement_id=p.id and kind='schedule' and status='approved' and 'correction'=any(allowed_actions) and start_at>=starts_at and end_at<=ends_at) then raise exception 'Coordinator schedule exception required' using errcode='42501';end if;
   if exists(select 1 from intrack.attendance_sessions t where t.enrollment_id=e.id and t.status<>'void' and tstzrange(t.clock_in_at,coalesce(t.clock_out_at,now()),'[)')&&tstzrange(start_at,end_at,'[)')) then raise exception 'Overlapping historical interval' using errcode='40001';end if;
   perform intrack.invalidate_attendance(e.id,actor,command_id,trim(payload->>'reason'));
   insert into intrack.attendance_sessions(enrollment_id,placement_id,clock_in_at,clock_out_at,attendance_date,policy_snapshot,authority_snapshot,original_clock_in_at,original_clock_out_at,source,status)
    values(e.id,p.id,start_at,end_at,(start_at at time zone 'Asia/Manila')::date,jsonb_build_object('attendance',settings,'schedule',p.schedule_snapshot),authority||jsonb_build_object('reconstructionRequestId',r.id),start_at,end_at,'reconstruction','pending') returning * into s;
   insert into intrack.attendance_session_revisions(enrollment_id,session_id,revision,origin,actor_id,command_id,reason,frozen_snapshot) values(e.id,s.id,0,'reconstruction',actor,command_id,trim(payload->>'reason'),to_jsonb(s));
  end if;
  update intrack.reconstruction_requests set status=case action when 'approve' then 'approved' else 'rejected' end,decided_by=actor,decided_at=now(),decision_reason=trim(payload->>'reason'),created_session_id=s.id,revision=revision+1 where reconstruction_requests.id=r.id;id:=r.id;
 else raise exception 'Unsupported reconstruction action' using errcode='22023';end if;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'reconstruction',payload,jsonb_build_object('id',id,'sessionId',s.id,'enrollmentRevision',e.revision+1),'reconstruction',id,e.id,e.revision,e.revision+1);
end $$;
revoke all on function public.intrack_resolution_file_command(uuid,text,jsonb),public.intrack_reconstruction_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_resolution_file_command(uuid,text,jsonb),public.intrack_reconstruction_command(uuid,jsonb) to authenticated;
create or replace function public.intrack_requirement_file(document_id uuid, actor_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare doc intrack.documents%rowtype; actor uuid; intent intrack.requirement_uploads%rowtype;
begin
  select * into doc from intrack.documents where id=document_id;
  if not found then raise exception 'Document unavailable' using errcode='42501'; end if;
  actor:=intrack.requirement_actor(doc.enrollment_id,actor_role);
  if doc.purpose<>'attendance_resolution' and not exists(select 1 from intrack.enrollment_requirements r join intrack.requirement_definitions d on d.id=r.definition_id where r.id=doc.requirement_id and d.evidence_type in ('file','moa')) then
    raise exception 'Generic file workflow required' using errcode='42501';
  end if;
  if doc.status in ('pending','validated') then
    select * into intent from intrack.requirement_uploads where requirement_uploads.document_id=doc.id;
    if actor_role<>'student' or doc.uploaded_by<>actor or intent.document_id is null or intent.expires_at<=now() then
      raise exception 'Upload unavailable' using errcode='42501';
    end if;
  elsif doc.status<>'attached' then raise exception 'File quarantined' using errcode='42501'; end if;
  return jsonb_build_object('id',doc.id,'path',doc.object_path,'name',doc.original_name,'mimeType',doc.mime_type,'bytes',doc.byte_count,'status',doc.status);
end $$;

create or replace function public.intrack_can_upload_requirement(object_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare doc intrack.documents%rowtype; actor uuid;
begin
  select * into doc from intrack.documents where object_path=object_name and status='pending';
  if not found then return false; end if;
  actor:=intrack.requirement_actor(doc.enrollment_id,'student');
  if doc.purpose='attendance_resolution' then return doc.uploaded_by=actor and exists(select 1 from intrack.requirement_uploads u join intrack.enrollments e on e.id=doc.enrollment_id where u.document_id=doc.id and u.expires_at>now() and e.outcome='active' and e.lifecycle<>'completed' and e.revision=u.enrollment_revision);end if;
  return doc.uploaded_by=actor and exists(select 1 from intrack.requirement_uploads u
    join intrack.enrollments e on e.id=doc.enrollment_id
    join intrack.enrollment_requirements r on r.id=doc.requirement_id
    join intrack.requirement_definitions d on d.id=r.definition_id
    left join intrack.submission_versions s on s.requirement_id=r.id and s.is_current
    where u.document_id=doc.id and u.expires_at>now() and e.outcome='active' and e.revision=u.enrollment_revision
      and s.revision is not distinct from u.submission_revision and (s.id is null or s.status in ('needs_revision','rejected','withdrawn') or (d.evidence_type='moa' and s.status='approved'))
      and e.lifecycle=any(d.allowed_submission_stages) and r.waived_at is null and d.evidence_type in ('file','moa'));
exception when insufficient_privilege or invalid_authorization_specification then return false;
end $$;

revoke all on function public.intrack_requirement_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_requirement_command(uuid,text,jsonb) to authenticated;
revoke all on function public.intrack_requirement_file(uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_requirement_file(uuid,text) to authenticated;
revoke all on function public.intrack_can_upload_requirement(text) from public,anon,authenticated;
grant execute on function public.intrack_can_upload_requirement(text) to authenticated;


commit;
