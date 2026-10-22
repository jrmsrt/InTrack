-- Forward extension: MOA bytes use the same private pipeline, never generic review.
begin;
create or replace function public.intrack_requirement_command(command_id uuid, action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  e intrack.enrollments%rowtype; r intrack.enrollment_requirements%rowtype;
  d intrack.requirement_definitions%rowtype; s intrack.submission_versions%rowtype;
  doc intrack.documents%rowtype; intent intrack.requirement_uploads%rowtype;
  actor uuid; selected_role text; digest text; receipt intrack.command_receipts%rowtype;
  result jsonb; remarks text; next_status text; new_id uuid; next_version integer;
  adviser_ok boolean; own_ok boolean; recipient uuid;
begin
  if command_id is null or payload is null or jsonb_typeof(payload)<>'object' then
    raise exception 'Invalid command' using errcode='22023';
  end if;
  if action not in ('reserve_upload','submit','withdraw','start_review','approve','request_revision','reject') then
    raise exception 'Unsupported command' using errcode='22023';
  end if;
  selected_role:=case when action in ('reserve_upload','submit','withdraw') then 'student' else payload->>'role' end;
  select * into e from intrack.enrollments where id=(payload->>'enrollmentId')::uuid for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501'; end if;
  actor:=intrack.requirement_actor(e.id,selected_role);
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||command_id::text,0));
  digest:=md5(jsonb_build_object('action',action,'payload',payload)::text);
  select * into receipt from intrack.command_receipts c where c.actor_id=actor and c.command_id=intrack_requirement_command.command_id;
  if found then
    if receipt.payload_hash<>digest then raise exception 'Command ID payload conflict' using errcode='40001'; end if;
    return receipt.result;
  end if;
  if e.outcome<>'active' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then
    raise exception 'Enrollment closed or stale; refresh' using errcode='40001';
  end if;
  select * into r from intrack.enrollment_requirements where id=(payload->>'requirementId')::uuid and enrollment_id=e.id for update;
  if not found then raise exception 'Requirement unavailable' using errcode='42501'; end if;
  select * into d from intrack.requirement_definitions where id=r.definition_id and policy_version_id=e.policy_version_id;
  if not found or d.evidence_type not in ('file','moa','staff_verification') or r.waived_at is not null
    or not exists(select 1 from intrack.policy_versions where id=e.policy_version_id and confirmed_at is not null) then
    raise exception 'Published file requirement required' using errcode='42501';
  end if;
  select * into s from intrack.submission_versions where requirement_id=r.id and is_current for update;
  if (payload->>'expectedSubmissionRevision')::integer is distinct from s.revision then
    raise exception 'Submission stale; refresh' using errcode='40001';
  end if;
  if selected_role='student' and not (e.lifecycle=any(d.allowed_submission_stages)) then
    raise exception 'Submission stage closed' using errcode='42501';
  end if;
  if d.evidence_type='staff_verification' and action in ('reserve_upload','submit') then
    raise exception 'Use the physical evidence request workflow' using errcode='22023';
  end if;
  if action='reserve_upload' then
    if s.id is not null and s.status not in ('needs_revision','rejected','withdrawn') and not (d.evidence_type='moa' and s.status='approved') then
      raise exception 'Current version cannot be replaced' using errcode='40001';
    end if;
    if coalesce(payload->>'mimeType','') not in ('application/pdf','image/jpeg','image/png')
      or coalesce((payload->>'bytes')::bigint,0) not between 1 and 10485760
      or coalesce(length(trim(payload->>'name')),0) not between 1 and 240 then
      raise exception 'Invalid file type, name or size' using errcode='22023';
    end if;
    new_id:=gen_random_uuid();
    insert into intrack.documents(id,enrollment_id,requirement_id,uploaded_by,object_path,original_name,mime_type,byte_count)
      values(new_id,e.id,r.id,actor,actor::text||'/'||e.id::text||'/'||new_id::text,payload->>'name',payload->>'mimeType',(payload->>'bytes')::bigint)
      returning * into doc;
    insert into intrack.requirement_uploads(document_id,enrollment_revision,submission_revision)
      values(new_id,e.revision,s.revision) returning * into intent;
    result:=jsonb_build_object('documentId',doc.id,'path',doc.object_path,'expiresAt',intent.expires_at);
  elsif action='submit' then
    select * into doc from intrack.documents where id=(payload->>'documentId')::uuid and enrollment_id=e.id and requirement_id=r.id and uploaded_by=actor for update;
    if not found or doc.status<>'validated' then raise exception 'Validated owned file required' using errcode='42501'; end if;
    select * into intent from intrack.requirement_uploads where document_id=doc.id;
    if not found or intent.expires_at<=now() or intent.enrollment_revision<>e.revision or intent.submission_revision is distinct from s.revision then
      raise exception 'Upload expired or stale; reserve a new upload' using errcode='40001';
    end if;
    if s.id is not null and s.status not in ('needs_revision','rejected','withdrawn') and not (d.evidence_type='moa' and s.status='approved') then
      raise exception 'Current version cannot be replaced' using errcode='40001';
    end if;
    next_version:=coalesce(s.version,0)+1;
    if s.id is not null then update intrack.submission_versions set is_current=false where id=s.id; end if;
    insert into intrack.submission_versions(enrollment_id,requirement_id,version,submitted_by,document_id,status,submitted_at)
      values(e.id,r.id,next_version,actor,doc.id,'submitted',now()) returning id into new_id;
    update intrack.documents set status='attached' where id=doc.id;
    result:=jsonb_build_object('submissionId',new_id,'version',next_version,'status','submitted');
    for recipient in select distinct m.profile_id from intrack.memberships m where m.active and m.program_id=e.program_id
      and ((d.reviewer in ('adviser','both') and m.role='adviser' and exists(select 1 from intrack.adviser_assignments a where a.enrollment_id=e.id and a.adviser_id=m.profile_id and a.ends_at is null and a.starts_at<=now()))
        or (d.reviewer='coordinator' and m.role='coordinator')) loop
      insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(recipient,e.id,command_id::text,jsonb_build_object('kind','requirement_submitted','requirementId',r.id,'submissionId',new_id));
    end loop;
  else
    if s.id is null or (payload->>'submissionId')::uuid is distinct from s.id then
      raise exception 'Current submission required' using errcode='40001';
    end if;
    remarks:=coalesce(trim(payload->>'remarks'),'');
    if length(remarks)>4000 then raise exception 'Remarks too long' using errcode='22023'; end if;
    if action='withdraw' then
      if s.status<>'submitted' or s.review_started_at is not null then raise exception 'Review already started' using errcode='40001'; end if;
      next_status:='withdrawn';
    else
      if d.evidence_type='moa' then raise exception 'Use coordinator MOA routing' using errcode='42501'; end if;
      if selected_role not in ('adviser','coordinator') or actor=e.student_id or actor=s.submitted_by then
        raise exception 'Self review or invalid reviewer' using errcode='42501';
      end if;
      if d.reviewer<>'both' and d.reviewer<>selected_role then raise exception 'Reviewer plan denied' using errcode='42501'; end if;
      select exists(select 1 from intrack.review_events where submission_id=s.id and reviewer_role='adviser' and decision='approved'),
        exists(select 1 from intrack.review_events where submission_id=s.id and reviewer_role=selected_role and decision='approved') into adviser_ok,own_ok;
      if (d.reviewer='both' and selected_role='coordinator' and not adviser_ok) or own_ok then
        raise exception 'Review step unavailable' using errcode='40001';
      end if;
      if s.status not in ('submitted','under_review') or s.submitted_at is null then raise exception 'Version not reviewable' using errcode='40001'; end if;
      if action in ('request_revision','reject') and remarks='' then raise exception 'Remarks required' using errcode='22023'; end if;
      if action='approve' and d.evidence_type='staff_verification' and not exists(
        select 1 from intrack.staff_verification_events where submission_id=s.id and verified_by<>s.submitted_by
      ) then raise exception 'Actual staff verification required' using errcode='42501'; end if;
      if action='approve' and d.evidence_type<>'staff_verification' and not exists(select 1 from intrack.documents where id=s.document_id and status='attached' and validated_at is not null and sha256 is not null) then
        raise exception 'Validated evidence required' using errcode='42501';
      end if;
      next_status:=case action when 'start_review' then 'under_review' when 'approve' then
        case when d.reviewer='both' and selected_role='adviser' then 'under_review' else 'approved' end
        when 'request_revision' then 'needs_revision' when 'reject' then 'rejected' end;
      insert into intrack.review_events(enrollment_id,submission_id,reviewer_id,reviewer_role,decision,remarks,command_id,submission_revision)
        values(e.id,s.id,actor,selected_role,case action when 'approve' then 'approved' else next_status end,remarks,command_id,s.revision);
      update intrack.submission_versions set review_started_at=coalesce(review_started_at,now()) where id=s.id;
    end if;
    update intrack.submission_versions set status=next_status,revision=revision+1 where id=s.id;
    result:=jsonb_build_object('submissionId',s.id,'status',next_status,'revision',s.revision+1);
    insert into intrack.notifications(recipient_id,enrollment_id,event_key,content)
      values(e.student_id,e.id,command_id::text,jsonb_build_object('kind','requirement_status','requirementId',r.id,'status',next_status));
    if action='approve' and d.reviewer='both' and selected_role='adviser' then
      for recipient in select distinct profile_id from intrack.memberships where program_id=e.program_id and role='coordinator' and active loop
        insert into intrack.notifications(recipient_id,enrollment_id,event_key,content)
          values(recipient,e.id,command_id::text,jsonb_build_object('kind','requirement_review','requirementId',r.id,'submissionId',s.id)) on conflict do nothing;
      end loop;
    end if;
  end if;
  if action<>'reserve_upload' then
    update intrack.enrollments set revision=revision+1 where id=e.id;
    result:=result||jsonb_build_object('enrollmentRevision',e.revision+1);
  end if;
  insert into intrack.audit_events(actor_id,enrollment_id,entity_type,entity_id,action,command_id,before_revision,after_revision,details)
    values(actor,e.id,'requirement',r.id,action,command_id,s.revision,case when action='submit' then 0 when action='reserve_upload' then s.revision else s.revision+1 end,result);
  insert into intrack.command_receipts(actor_id,command_id,payload_hash,result) values(actor,command_id,digest,result);
  return result;
end $$;

create or replace function public.intrack_requirement_file(document_id uuid, actor_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare doc intrack.documents%rowtype; actor uuid; intent intrack.requirement_uploads%rowtype;
begin
  select * into doc from intrack.documents where id=document_id;
  if not found then raise exception 'Document unavailable' using errcode='42501'; end if;
  actor:=intrack.requirement_actor(doc.enrollment_id,actor_role);
  if not exists(select 1 from intrack.enrollment_requirements r join intrack.requirement_definitions d on d.id=r.definition_id where r.id=doc.requirement_id and d.evidence_type in ('file','moa')) then
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
