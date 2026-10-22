begin;
create function intrack.historical_training_allowed(target uuid,placement uuid,starts_at timestamptz,ends_at timestamptz) returns boolean language sql stable set search_path='' as $$
 select starts_at is not null and ends_at is not null and ends_at>starts_at
 and coalesce((select event.to_clearance='active' and event.basis_snapshot->>'placementId'=placement::text from intrack.enrollment_events event where event.enrollment_id=target and event.created_at<=starts_at order by event.created_at desc,event.after_revision desc limit 1),false)
 and not exists(select 1 from intrack.enrollment_events event where event.enrollment_id=target and event.created_at>starts_at and event.created_at<ends_at and event.to_clearance<>'active')
$$;
revoke all on function intrack.historical_training_allowed(uuid,uuid,timestamptz,timestamptz) from public,anon,authenticated;
create or replace function public.intrack_attendance_correction(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; s intrack.attendance_sessions%rowtype; r intrack.correction_requests%rowtype; p intrack.placements%rowtype;
 actor uuid;receipt jsonb; id uuid;action text:=payload->>'action'; start_at timestamptz;end_at timestamptz;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='request' then 'student' when action='void' then 'coordinator' else 'adviser' end);
 receipt:=intrack.begin_command(actor,command_id,'attendance_correction',payload);if receipt is not null then return receipt;end if;
 if e.outcome not in ('active','withdrawn') or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Active current enrollment and reason required' using errcode='40001';end if;
 if action in ('request','void') then
  select * into s from intrack.attendance_sessions where attendance_sessions.id=(payload->>'sessionId')::uuid and enrollment_id=e.id for update;
 else
  select * into r from intrack.correction_requests where correction_requests.id=(payload->>'requestId')::uuid and enrollment_id=e.id for update;
  if r.id is null or r.status<>'pending' or r.requested_by=actor or actor=e.student_id or (payload->>'expectedRequestRevision')::integer is distinct from r.revision then raise exception 'Current other-user correction required' using errcode='40001';end if;
  select * into s from intrack.attendance_sessions where attendance_sessions.id=r.session_id for update;
 end if;
 if s.id is null or s.status='void' or (payload->>'expectedSessionRevision')::integer is distinct from s.revision or (r.id is not null and r.original_revision<>s.revision) then raise exception 'Stale or unavailable session' using errcode='40001';end if;
 if action='request' then
  start_at:=(payload->>'clockInAt')::timestamptz;end_at:=(payload->>'clockOutAt')::timestamptz;
  if start_at is null or end_at is null or end_at<=start_at or end_at>now() or end_at>start_at+interval '24 hours' then raise exception 'Valid historical interval required' using errcode='22023';end if;
  if not exists(select 1 from intrack.documents where documents.id=(payload->>'evidenceDocumentId')::uuid and enrollment_id=e.id and uploaded_by=e.student_id and status in ('validated','attached')) then raise exception 'Validated owned correction evidence required' using errcode='42501';end if;
  insert into intrack.correction_requests(enrollment_id,session_id,original_revision,evidence_document_id,original_snapshot,proposed_snapshot,requested_by,reason,status)
   values(e.id,s.id,s.revision,(payload->>'evidenceDocumentId')::uuid,to_jsonb(s),jsonb_build_object('clockInAt',start_at,'clockOutAt',end_at),actor,trim(payload->>'reason'),'pending') returning correction_requests.id into id;
 elsif action in ('approve','reject') then
  if action='approve' then
   start_at:=(r.proposed_snapshot->>'clockInAt')::timestamptz;end_at:=(r.proposed_snapshot->>'clockOutAt')::timestamptz;
   select * into p from intrack.placements where placements.id=s.placement_id;
   if start_at<(p.starts_on::timestamp at time zone 'Asia/Manila') or (p.ends_on is not null and end_at>=((p.ends_on+1)::timestamp at time zone 'Asia/Manila')) or end_at>now()
    or end_at>start_at+make_interval(mins=>(s.policy_snapshot->'attendance'->>'maxSessionMinutes')::integer) then raise exception 'Correction outside historical placement/policy' using errcode='22023';end if;
   if not intrack.schedule_allows(s.policy_snapshot->'schedule',start_at) and not exists(select 1 from intrack.attendance_exceptions where enrollment_id=e.id and placement_id=s.placement_id and kind='schedule' and status='approved' and 'correction'=any(allowed_actions) and start_at>=starts_at and end_at<=ends_at) then raise exception 'Coordinator schedule exception required' using errcode='42501';end if;
   if exists(select 1 from intrack.attendance_sessions t where t.enrollment_id=e.id and t.id<>s.id and t.status<>'void' and tstzrange(t.clock_in_at,coalesce(t.clock_out_at,now()),'[)')&&tstzrange(start_at,end_at,'[)')) then raise exception 'Overlapping attendance interval' using errcode='40001';end if;
   if not intrack.historical_training_allowed(e.id,s.placement_id,start_at,end_at) then raise exception 'Correction cannot bypass historical deployment authority' using errcode='42501';end if;
   perform intrack.invalidate_attendance(e.id,actor,command_id,trim(payload->>'reason'));
   update intrack.attendance_sessions set clock_in_at=start_at,clock_out_at=end_at,attendance_date=(start_at at time zone 'Asia/Manila')::date,status='pending',net_minutes=null,revision=revision+1 where attendance_sessions.id=s.id returning * into s;
   insert into intrack.attendance_session_revisions(enrollment_id,session_id,revision,origin,actor_id,command_id,reason,frozen_snapshot) values(e.id,s.id,s.revision,'correction',actor,command_id,trim(payload->>'reason'),to_jsonb(s));
  end if;
  update intrack.correction_requests set status=case action when 'approve' then 'approved' else 'rejected' end,decided_by=actor,decided_at=now(),decision_reason=trim(payload->>'reason'),revision=revision+1 where correction_requests.id=r.id;id:=r.id;
 elsif action='void' then
  if actor=e.student_id or not exists(select 1 from intrack.documents where documents.id=(payload->>'evidenceDocumentId')::uuid and enrollment_id=e.id and status in ('validated','attached')) then raise exception 'Other-user verified evidence required' using errcode='42501';end if;
  if exists(select 1 from intrack.correction_requests where session_id=s.id and status='pending') then raise exception 'Resolve pending correction before void' using errcode='40001';end if;
  perform intrack.invalidate_attendance(e.id,actor,command_id,trim(payload->>'reason'));
  update intrack.attendance_sessions set status='void',revision=revision+1 where attendance_sessions.id=s.id returning * into s;
  insert into intrack.attendance_session_revisions(enrollment_id,session_id,revision,origin,actor_id,command_id,reason,frozen_snapshot) values(e.id,s.id,s.revision,'void',actor,command_id,trim(payload->>'reason'),to_jsonb(s)||jsonb_build_object('evidenceDocumentId',payload->>'evidenceDocumentId'));id:=s.id;
 else raise exception 'Unsupported correction action' using errcode='22023';end if;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'attendance_correction',payload,jsonb_build_object('id',id,'enrollmentRevision',e.revision+1),'attendance_correction',id,e.id,e.revision,e.revision+1);
end $$;


create or replace function public.intrack_dtr_command(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; period intrack.attendance_periods%rowtype; d intrack.dtr_versions%rowtype; s intrack.attendance_sessions%rowtype;
 actor uuid;receipt jsonb;action text:=payload->>'action';id uuid; v integer; day date;minutes integer;available integer;cap integer; snapshot jsonb;source jsonb;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='configure_period' then 'coordinator' when action in ('generate','submit') then 'student' else 'adviser' end);
 receipt:=intrack.begin_command(actor,command_id,'dtr',payload);if receipt is not null then return receipt;end if;
 if e.outcome not in ('active','withdrawn') or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Current active enrollment required' using errcode='40001';end if;
 if action='configure_period' then
  if actor=e.student_id then raise exception 'No self administration' using errcode='42501';end if;
  if exists(select 1 from intrack.attendance_periods where enrollment_id=e.id and daterange(starts_on,ends_on,'[]')&&daterange((payload->>'startsOn')::date,(payload->>'endsOn')::date,'[]')) then raise exception 'Overlapping DTR periods' using errcode='40001';end if;
  insert into intrack.attendance_periods(enrollment_id,period_key,starts_on,ends_on,approval_reference,created_by) values(e.id,payload->>'periodKey',(payload->>'startsOn')::date,(payload->>'endsOn')::date,payload->>'approvalReference',actor) returning attendance_periods.id into id;
 elsif action='generate' then
  select * into period from intrack.attendance_periods where attendance_periods.id=(payload->>'periodId')::uuid and enrollment_id=e.id;
  if period.id is null or period.ends_on>(now() at time zone 'Asia/Manila')::date then raise exception 'Configured nonfuture period required' using errcode='22023';end if;
  if exists(select 1 from intrack.dtr_versions where enrollment_id=e.id and period_key=period.period_key and status in ('draft','submitted','under_review','approved')) then raise exception 'Resolve existing DTR before creating another version' using errcode='40001';end if;
  if exists(select 1 from intrack.correction_requests where enrollment_id=e.id and status='pending') or exists(select 1 from intrack.reconstruction_requests where enrollment_id=e.id and status='pending') then raise exception 'Resolve attendance requests before generation' using errcode='40001';end if;
  if exists(select 1 from intrack.attendance_sessions where enrollment_id=e.id and status<>'void' and clock_in_at<((period.ends_on+1)::timestamp at time zone 'Asia/Manila') and coalesce(clock_out_at,now())>(period.starts_on::timestamp at time zone 'Asia/Manila') and (clock_out_at is null or status='disputed')) then raise exception 'Open/disputed attendance blocks DTR generation' using errcode='40001';end if;
  select coalesce(max(version),0)+1 into v from intrack.dtr_versions where enrollment_id=e.id and period_key=period.period_key;
  select jsonb_build_object('period',to_jsonb(period),'sessions',coalesce(jsonb_agg(to_jsonb(t) order by t.clock_in_at,t.id),'[]')) into snapshot from intrack.attendance_sessions t where t.enrollment_id=e.id and t.status<>'void' and t.clock_in_at<((period.ends_on+1)::timestamp at time zone 'Asia/Manila') and t.clock_out_at>(period.starts_on::timestamp at time zone 'Asia/Manila');
  insert into intrack.dtr_versions(enrollment_id,starts_on,ends_on,version,period_key,printable_snapshot,status) values(e.id,period.starts_on,period.ends_on,v,period.period_key,snapshot,'draft') returning * into d;id:=d.id;
  insert into intrack.dtr_entries(enrollment_id,dtr_id,session_id,session_revision,frozen_snapshot) select e.id,d.id,t.id,t.revision,to_jsonb(t) from intrack.attendance_sessions t where t.enrollment_id=e.id and t.status<>'void' and t.clock_in_at<((period.ends_on+1)::timestamp at time zone 'Asia/Manila') and t.clock_out_at>(period.starts_on::timestamp at time zone 'Asia/Manila');
 else
  select * into d from intrack.dtr_versions where dtr_versions.id=(payload->>'dtrId')::uuid and enrollment_id=e.id for update;id:=d.id;
  if d.id is null or (payload->>'expectedDtrRevision')::integer is distinct from d.revision then raise exception 'Current DTR revision required' using errcode='40001';end if;
  if action='submit' then
   if d.status<>'draft' then raise exception 'Draft required' using errcode='40001';end if;
   update intrack.dtr_versions set status='submitted',submitted_at=now(),revision=revision+1 where dtr_versions.id=d.id;
  elsif action in ('approve','request_revision') then
   if actor=e.student_id or d.status not in ('submitted','under_review') then raise exception 'Other-user submitted DTR required' using errcode='42501';end if;
   if action='request_revision' and coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Revision reason required' using errcode='22023';end if;
   if action='approve' then
    if exists(select 1 from intrack.correction_requests where enrollment_id=e.id and status='pending') or exists(select 1 from intrack.reconstruction_requests where enrollment_id=e.id and status='pending') then raise exception 'Pending attendance resolution' using errcode='40001';end if;
    if exists(select 1 from intrack.dtr_entries entry join intrack.attendance_sessions history on history.id=entry.session_id where entry.dtr_id=d.id and not intrack.historical_training_allowed(e.id,history.placement_id,history.clock_in_at,history.clock_out_at)) then raise exception 'DTR cannot credit intervals without historical training authority' using errcode='42501';end if;
    if exists(select 1 from intrack.dtr_entries entry join intrack.attendance_sessions t on t.id=entry.session_id where entry.dtr_id=d.id and (t.revision<>entry.session_revision or t.status in ('open','disputed','void') or t.clock_out_at is null)) then raise exception 'Source revision changed' using errcode='40001';end if;
    if exists(select 1 from intrack.attendance_sessions t where t.enrollment_id=e.id and t.status<>'void' and t.clock_in_at<((d.ends_on+1)::timestamp at time zone 'Asia/Manila') and coalesce(t.clock_out_at,now())>(d.starts_on::timestamp at time zone 'Asia/Manila') and not exists(select 1 from intrack.dtr_entries entry where entry.dtr_id=d.id and entry.session_id=t.id)) then raise exception 'Period coverage changed' using errcode='40001';end if;
    if exists(select 1 from intrack.attendance_sessions a join intrack.attendance_sessions b on a.enrollment_id=b.enrollment_id and a.id<b.id where a.enrollment_id=e.id and a.status<>'void' and b.status<>'void' and tstzrange(a.clock_in_at,a.clock_out_at,'[)')&&tstzrange(b.clock_in_at,b.clock_out_at,'[)')) then raise exception 'Overlapping attendance must be resolved' using errcode='40001';end if;
    for day in select generate_series(d.starts_on,d.ends_on,interval '1 day')::date loop
     available:=null;
     for s in select t.* from intrack.attendance_sessions t join intrack.dtr_entries entry on entry.session_id=t.id where entry.dtr_id=d.id and t.clock_in_at<((day+1)::timestamp at time zone 'Asia/Manila') and t.clock_out_at>(day::timestamp at time zone 'Asia/Manila') order by t.clock_in_at,t.id loop
      cap:=(s.policy_snapshot->'attendance'->>'dailyCapMinutes')::integer;
      if cap is null or cap not between 1 and 1440 then raise exception 'Invalid frozen credit cap' using errcode='22023';end if;
      if available is null then available:=cap;elsif cap<> (select (t.policy_snapshot->'attendance'->>'dailyCapMinutes')::integer from intrack.attendance_sessions t join intrack.dtr_entries entry on entry.session_id=t.id where entry.dtr_id=d.id and t.clock_in_at<((day+1)::timestamp at time zone 'Asia/Manila') and t.clock_out_at>(day::timestamp at time zone 'Asia/Manila') order by t.clock_in_at,t.id limit 1) then raise exception 'Conflicting daily caps require policy reconciliation' using errcode='40001';end if;
      minutes:=least(intrack.session_day_minutes(s,day),greatest(0,available));available:=available-minutes;
      if exists(select 1 from intrack.hour_credits where enrollment_id=e.id and credit_date=day and invalidated_at is null) and not exists(select 1 from intrack.hour_credits where dtr_id=d.id and credit_date=day and invalidated_at is null) then raise exception 'Day already credited by another DTR' using errcode='40001';end if;
      insert into intrack.hour_credits(enrollment_id,dtr_id,session_id,session_revision,credit_date,minutes) values(e.id,d.id,s.id,s.revision,day,minutes);
     end loop;
    end loop;
   end if;
   update intrack.dtr_versions set status=case action when 'approve' then 'approved' else 'needs_revision' end,reviewed_by=actor,reviewed_at=now(),remarks=coalesce(payload->>'reason',''),revision=revision+1 where dtr_versions.id=d.id;
   insert into intrack.dtr_review_events(enrollment_id,dtr_id,actor_id,command_id,decision,reason,dtr_revision) values(e.id,d.id,actor,command_id,case action when 'approve' then 'approved' else 'needs_revision' end,coalesce(payload->>'reason',''),d.revision+1);
  else raise exception 'Unsupported DTR action' using errcode='22023';end if;
 end if;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'dtr',payload,jsonb_build_object('id',id,'enrollmentRevision',e.revision+1),'dtr',id,e.id,e.revision,e.revision+1);
end $$;


create or replace function public.intrack_resolution_file_command(command_id uuid,action text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype;actor uuid;receipt jsonb;doc intrack.documents%rowtype;id uuid;path text;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,'student');receipt:=intrack.begin_command(actor,command_id,'resolution_file:'||action,payload);if receipt is not null then return receipt;end if;
 if e.outcome not in ('active','withdrawn') or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Current active enrollment required' using errcode='40001';end if;
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

create or replace function public.intrack_reconstruction_command(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype;p intrack.placements%rowtype;r intrack.reconstruction_requests%rowtype;s intrack.attendance_sessions%rowtype;
 actor uuid;receipt jsonb;action text:=payload->>'action';start_at timestamptz;end_at timestamptz;settings jsonb;authority jsonb;id uuid;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='request' then 'student' else 'adviser' end);
 receipt:=intrack.begin_command(actor,command_id,'reconstruction',payload);if receipt is not null then return receipt;end if;
 if e.outcome not in ('active','withdrawn') or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Active current enrollment and reason required' using errcode='40001';end if;
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
   if not intrack.historical_training_allowed(e.id,p.id,start_at,end_at) then raise exception 'Reconstruction cannot bypass historical training authority' using errcode='42501';end if;
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

create or replace function public.intrack_can_upload_requirement(object_name text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare doc intrack.documents%rowtype; actor uuid;
begin
  select * into doc from intrack.documents where object_path=object_name and status='pending';
  if not found then return false; end if;
  actor:=intrack.requirement_actor(doc.enrollment_id,'student');
  if doc.purpose='attendance_resolution' then return doc.uploaded_by=actor and exists(select 1 from intrack.requirement_uploads u join intrack.enrollments e on e.id=doc.enrollment_id where u.document_id=doc.id and u.expires_at>now() and e.outcome in ('active','withdrawn') and e.lifecycle<>'completed' and e.revision=u.enrollment_revision);end if;
  return doc.uploaded_by=actor and exists(select 1 from intrack.requirement_uploads u
    join intrack.enrollments e on e.id=doc.enrollment_id
    join intrack.enrollment_requirements r on r.id=doc.requirement_id
    join intrack.requirement_definitions d on d.id=r.definition_id
    left join intrack.submission_versions s on s.requirement_id=r.id and s.is_current
    where u.document_id=doc.id and u.expires_at>now() and e.outcome='active' and e.revision=u.enrollment_revision
      and s.revision is not distinct from u.submission_revision and (s.id is null or s.status in ('needs_revision','rejected','withdrawn') or (d.evidence_type='moa' and s.status='approved'))
      and e.lifecycle=any(d.allowed_submission_stages) and r.waived_at is null and d.evidence_type in ('file','moa','evaluation','portfolio'));
exception when insufficient_privilege or invalid_authorization_specification then return false;
end $$;

revoke all on function public.intrack_requirement_command(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_requirement_command(uuid,text,jsonb) to authenticated;
revoke all on function public.intrack_requirement_file(uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_requirement_file(uuid,text) to authenticated;
revoke all on function public.intrack_can_upload_requirement(text) from public,anon,authenticated;
grant execute on function public.intrack_can_upload_requirement(text) to authenticated;






commit;