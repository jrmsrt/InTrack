begin;
create table intrack.attendance_periods(
 id uuid primary key default gen_random_uuid(), enrollment_id uuid not null references intrack.enrollments(id),
 period_key text not null check(length(period_key) between 1 and 80), starts_on date not null,ends_on date not null,
 approval_reference text not null check(length(trim(approval_reference)) between 1 and 1000),created_by uuid not null references intrack.profiles(id),
 check(ends_on between starts_on and starts_on+62),unique(enrollment_id,period_key),unique(enrollment_id,starts_on,ends_on));
alter table intrack.attendance_periods enable row level security;
revoke all on intrack.attendance_periods from public,anon,authenticated;
create trigger preserve_attendance_period before update or delete on intrack.attendance_periods for each row execute function intrack.guard_append_only();

-- Net minutes for one Manila date. Merge overlapping unpaid-break windows.
create function intrack.session_day_minutes(s intrack.attendance_sessions, day date) returns integer language plpgsql stable set search_path='' as $$
declare lower_bound timestamptz;upper_bound timestamptz; anchor date; shift_start timestamp; b jsonb; start_at timestamp;end_at timestamp;
 windows tstzrange[]:='{}';merged tstzmultirange;cut tstzrange;seconds numeric;
begin
 if s.clock_out_at is null or s.clock_out_at<=s.clock_in_at then raise exception 'Closed positive interval required' using errcode='22023';end if;
 lower_bound:=greatest(s.clock_in_at,day::timestamp at time zone 'Asia/Manila');upper_bound:=least(s.clock_out_at,(day+1)::timestamp at time zone 'Asia/Manila');
 if upper_bound<=lower_bound then return 0;end if;
 anchor:=(s.clock_in_at at time zone 'Asia/Manila')::date;
 shift_start:=anchor+(s.policy_snapshot->'schedule'->>'start')::time;
 if (s.policy_snapshot->'schedule'->>'overnight')::boolean is true and (s.clock_in_at at time zone 'Asia/Manila')<shift_start then anchor:=anchor-1;shift_start:=shift_start-interval '1 day';end if;
 for b in select value from jsonb_array_elements(s.policy_snapshot->'schedule'->'breaks') loop
  start_at:=anchor+(b->>'start')::time;end_at:=anchor+(b->>'end')::time;
  if (s.policy_snapshot->'schedule'->>'overnight')::boolean is true and start_at<shift_start then start_at:=start_at+interval '1 day';end if;
  if end_at<=start_at then end_at:=end_at+interval '1 day';end if;
  if end_at>start_at+interval '24 hours' then raise exception 'Invalid historical break' using errcode='22023';end if;
  if (b->>'paid')::boolean is distinct from true then windows:=array_append(windows,tstzrange(start_at at time zone 'Asia/Manila',end_at at time zone 'Asia/Manila','[)'));end if;
 end loop;
 seconds:=extract(epoch from upper_bound-lower_bound);
 select range_agg(w) into merged from unnest(windows) w;
 if merged is not null then for cut in select unnest(merged*tstzmultirange(tstzrange(lower_bound,upper_bound,'[)'))) loop seconds:=seconds-extract(epoch from upper(cut)-lower(cut));end loop;end if;
 return greatest(0,floor(seconds/60)::integer);
end $$;

-- Recalculate conservatively across the enrollment after any source correction.
-- Original submitted snapshots/history remain immutable; current eligibility ends.
create function intrack.invalidate_attendance(target uuid,actor uuid,command uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare d intrack.dtr_versions%rowtype;
begin
 for d in select * from intrack.dtr_versions where enrollment_id=target and status in ('approved','submitted','under_review') for update loop
  update intrack.dtr_versions set status='needs_revision',revision=revision+1 where id=d.id;
  insert into intrack.dtr_review_events(enrollment_id,dtr_id,actor_id,command_id,decision,reason,dtr_revision) values(target,d.id,actor,command,'invalidated',reason,d.revision+1);
 end loop;
 update intrack.hour_credits set invalidated_at=now(),invalidated_by=actor,invalidation_reason=reason where enrollment_id=target and invalidated_at is null;
 update intrack.journal_versions set status='needs_revision',revision=revision+1,reviewed_by=null,reviewed_at=null where enrollment_id=target and is_current and status in ('approved','submitted','under_review');
 update intrack.portfolio_versions set status='needs_revision',revision=revision+1,adviser_reviewed_by=null,adviser_approved_at=null,coordinator_reviewed_by=null,coordinator_approved_at=null where enrollment_id=target and is_current and status in ('approved','submitted','under_review');
end $$;

create function public.intrack_attendance_correction(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; s intrack.attendance_sessions%rowtype; r intrack.correction_requests%rowtype; p intrack.placements%rowtype;
 actor uuid;receipt jsonb; id uuid;action text:=payload->>'action'; start_at timestamptz;end_at timestamptz;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='request' then 'student' when action='void' then 'coordinator' else 'adviser' end);
 receipt:=intrack.begin_command(actor,command_id,'attendance_correction',payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Active current enrollment and reason required' using errcode='40001';end if;
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

create function public.intrack_dtr_command(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; period intrack.attendance_periods%rowtype; d intrack.dtr_versions%rowtype; s intrack.attendance_sessions%rowtype;
 actor uuid;receipt jsonb;action text:=payload->>'action';id uuid; v integer; day date;minutes integer;available integer;cap integer; snapshot jsonb;source jsonb;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='configure_period' then 'coordinator' when action in ('generate','submit') then 'student' else 'adviser' end);
 receipt:=intrack.begin_command(actor,command_id,'dtr',payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Current active enrollment required' using errcode='40001';end if;
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

create function public.intrack_list_dtrs(enrollment_id uuid,actor_role text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform intrack.enrollment_actor(enrollment_id,actor_role);
 return jsonb_build_object('periods',coalesce((select jsonb_agg(to_jsonb(p)) from intrack.attendance_periods p where p.enrollment_id=intrack_list_dtrs.enrollment_id),'[]'::jsonb),
 'dtrs',coalesce((select jsonb_agg(to_jsonb(d)) from (select * from intrack.dtr_versions where dtr_versions.enrollment_id=intrack_list_dtrs.enrollment_id order by generated_at desc,id limit 100) d),'[]'::jsonb),
 'corrections',coalesce((select jsonb_agg(to_jsonb(c)) from intrack.correction_requests c where c.enrollment_id=intrack_list_dtrs.enrollment_id and status='pending'),'[]'::jsonb));
end $$;
revoke all on function intrack.session_day_minutes(intrack.attendance_sessions,date),intrack.invalidate_attendance(uuid,uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.intrack_attendance_correction(uuid,jsonb),public.intrack_dtr_command(uuid,jsonb),public.intrack_list_dtrs(uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_attendance_correction(uuid,jsonb),public.intrack_dtr_command(uuid,jsonb),public.intrack_list_dtrs(uuid,text) to authenticated;
commit;
