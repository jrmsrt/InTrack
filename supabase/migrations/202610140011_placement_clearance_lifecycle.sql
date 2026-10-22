begin;
create function intrack.requirement_gate(target uuid, stage text, accepted_moa uuid default null)
returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('ready',count(*)>0 and coalesce(bool_and(coalesce(
      (r.waived_at is not null and r.waiver_actor is not null and length(trim(r.waiver_reason))>0)
      or (d.evidence_type='moa' and accepted_moa is not null and exists(select 1 from intrack.submission_versions ms where ms.id=accepted_moa and ms.requirement_id=r.id))
      or (d.evidence_type<>'moa' and s.status='approved')
    ,false)),false),
    'basis',coalesce(jsonb_agg(jsonb_build_object('requirementId',r.id,'submissionId',case when d.evidence_type='moa' then accepted_moa else s.id end,
      'waiverActor',r.waiver_actor,'waiverReason',r.waiver_reason) order by r.id),'[]'))
  from intrack.enrollment_requirements r join intrack.requirement_definitions d on d.id=r.definition_id
  left join intrack.submission_versions s on s.requirement_id=r.id and s.is_current
  where r.enrollment_id=target and d.stage=requirement_gate.stage and d.mandatory
$$;
revoke all on function intrack.requirement_gate(uuid,text,uuid) from public,anon,authenticated;

create function public.intrack_configure_placement(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; actor uuid; receipt jsonb; company uuid; placement uuid; schedule jsonb; day integer; item jsonb; clearance text;
begin
  select * into e from intrack.enrollments where id=(payload->>'enrollmentId')::uuid for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,'coordinator');receipt:=intrack.begin_command(actor,command_id,'configure_placement',payload);if receipt is not null then return receipt;end if;
  if e.outcome<>'active' or actor=e.student_id or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Closed, self or stale enrollment' using errcode='40001';end if;
  select c.status into clearance from intrack.clearance_events c where c.enrollment_id=e.id order by c.enrollment_revision desc limit 1;
  if clearance in ('active','suspended') or exists(select 1 from intrack.attendance_sessions where enrollment_id=e.id and clock_out_at is null and status<>'void') then raise exception 'Revoke clearance and resolve open attendance before changing placement' using errcode='40001';end if;
  if coalesce(length(trim(payload->>'companyName')),0) not between 1 and 240 or coalesce(length(trim(payload->>'companyAddress')),0) not between 1 and 1000
    or coalesce(length(trim(payload->>'approvalReference')),0) not between 1 and 1000
    or (payload->>'latitude')::double precision is null or (payload->>'longitude')::double precision is null
    or (payload->>'latitude')::double precision not between -90 and 90 or (payload->>'longitude')::double precision not between -180 and 180
    or coalesce((payload->>'radiusMeters')::integer,0) not between 1 and 100000 or (payload->>'startsOn')::date is null then raise exception 'Approved company, dates and geofence required' using errcode='22023';end if;
  schedule:=payload->'schedule';
  if jsonb_typeof(schedule) is distinct from 'object' or jsonb_typeof(schedule->'weekdays') is distinct from 'array' or jsonb_array_length(schedule->'weekdays')=0
    or coalesce(schedule->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(schedule->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or jsonb_typeof(schedule->'breaks') is distinct from 'array' then raise exception 'Explicit approved schedule and breaks required' using errcode='22023';end if;
  for day in select value::text::integer from jsonb_array_elements(schedule->'weekdays') loop
    if day not between 1 and 7 then raise exception 'Weekdays use ISO 1–7' using errcode='22023';end if;
  end loop;
  if (schedule->>'end')::time <= (schedule->>'start')::time and coalesce((schedule->>'overnight')::boolean,false)<>true then raise exception 'Overnight schedule requires explicit approval' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(schedule->'breaks') loop
    if coalesce(item->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(item->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Explicit break intervals required' using errcode='22023';end if;
  end loop;
  update intrack.placements set active=false,revision=revision+1 where enrollment_id=e.id and active;
  insert into intrack.companies(name,address) values(trim(payload->>'companyName'),trim(payload->>'companyAddress')) returning id into company;
  insert into intrack.placements(enrollment_id,company_id,starts_on,ends_on,active,latitude,longitude,radius_meters,schedule_snapshot)
    values(e.id,company,(payload->>'startsOn')::date,(payload->>'endsOn')::date,true,(payload->>'latitude')::double precision,(payload->>'longitude')::double precision,(payload->>'radiusMeters')::integer,
      schedule||jsonb_build_object('approvalReference',payload->>'approvalReference')) returning id into placement;
  update intrack.enrollments set revision=revision+1 where id=e.id;
  return intrack.finish_command(actor,command_id,'configure_placement',payload,jsonb_build_object('placementId',placement,'revision',e.revision+1),'placement',placement,e.id,e.revision,e.revision+1);
end $$;
revoke all on function public.intrack_configure_placement(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_configure_placement(uuid,jsonb) to authenticated;

create function public.intrack_waive_requirement(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; r intrack.enrollment_requirements%rowtype; actor uuid; receipt jsonb;
begin
  select * into e from intrack.enrollments where id=(payload->>'enrollmentId')::uuid for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,'coordinator');receipt:=intrack.begin_command(actor,command_id,'waive_requirement',payload);if receipt is not null then return receipt;end if;
  select * into r from intrack.enrollment_requirements where id=(payload->>'requirementId')::uuid and enrollment_id=e.id for update;
  if not found or e.student_id=actor then raise exception 'Other student requirement required' using errcode='42501';end if;
  if e.outcome<>'active' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or (payload->>'expectedRequirementRevision')::integer is distinct from r.revision then raise exception 'Closed or stale record' using errcode='40001';end if;
  if (payload->>'waive')::boolean is distinct from true or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Explicit waiver and reason required' using errcode='22023';end if;
  update intrack.enrollment_requirements set waiver_actor=actor,waiver_reason=trim(payload->>'reason'),waived_at=now(),revision=revision+1 where id=r.id;
  update intrack.enrollments set revision=revision+1 where id=e.id;
  insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(e.student_id,e.id,command_id::text,jsonb_build_object('kind','requirement_waived','requirementId',r.id));
  return intrack.finish_command(actor,command_id,'waive_requirement',payload,jsonb_build_object('requirementId',r.id,'waived',true,'revision',e.revision+1),'requirement',r.id,e.id,r.revision,r.revision+1);
end $$;
revoke all on function public.intrack_waive_requirement(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_waive_requirement(uuid,jsonb) to authenticated;

create function public.intrack_lifecycle_command(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; placement intrack.placements%rowtype; policy intrack.policy_versions%rowtype;
  clearance intrack.clearance_events%rowtype; moa intrack.moa_routing_events%rowtype; gate jsonb;
  actor uuid; receipt jsonb; action text; before_clearance text; next_clearance text; next_stage text; next_outcome text;
  basis jsonb:='{}'; open_sessions integer; unresolved integer; credited integer; session intrack.attendance_sessions%rowtype;
begin
  select * into e from intrack.enrollments where id=(payload->>'enrollmentId')::uuid for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,'coordinator');receipt:=intrack.begin_command(actor,command_id,'lifecycle',payload);if receipt is not null then return receipt;end if;
  action:=payload->>'action';
  if actor=e.student_id or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Other student and transition reason required' using errcode='42501';end if;
  if (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Enrollment stale' using errcode='40001';end if;
  if coalesce(action,'') not in ('issue_clearance','resume_clearance','suspend_clearance','revoke_clearance','enter_post_ojt','enter_portfolio','withdraw','return_to_training') then
    raise exception 'Unsupported transition; completion/reopen require the portfolio finalization workflow' using errcode='22023';end if;
  if e.outcome<>'active' then raise exception 'Enrollment is not active' using errcode='40001';end if;
  select * into clearance from intrack.clearance_events where enrollment_id=e.id order by enrollment_revision desc limit 1;
  select coalesce((select to_clearance from intrack.enrollment_events where enrollment_id=e.id order by after_revision desc limit 1),clearance.status,'not_issued') into before_clearance;
  next_clearance:=before_clearance;next_stage:=e.lifecycle;next_outcome:=e.outcome;
  select count(*) into open_sessions from intrack.attendance_sessions where enrollment_id=e.id and clock_out_at is null and status<>'void';
  select (select count(*) from intrack.attendance_sessions where enrollment_id=e.id and status='disputed')+
    (select count(*) from intrack.correction_requests where enrollment_id=e.id and status='pending')+
    (select count(*) from intrack.reconstruction_requests where enrollment_id=e.id and status='pending') into unresolved;
  select coalesce(sum(minutes),0)::integer into credited from intrack.hour_credits where enrollment_id=e.id and invalidated_at is null;
  if action in ('issue_clearance','resume_clearance') then
    if (action='issue_clearance' and (e.lifecycle not in ('pre_ojt','during_ojt') or before_clearance not in ('not_issued','revoked')))
      or (action='resume_clearance' and (e.lifecycle<>'during_ojt' or before_clearance<>'suspended')) then raise exception 'Clearance action unavailable' using errcode='40001';end if;
    select * into policy from intrack.policy_versions where id=e.policy_version_id;
    select * into placement from intrack.placements where enrollment_id=e.id and active for share;
    if policy.confirmed_at is null or coalesce((policy.attendance_policy->>'confirmed')::boolean,false)<>true or placement.id is null
      or placement.starts_on>(now() at time zone 'Asia/Manila')::date or (placement.ends_on is not null and placement.ends_on<(now() at time zone 'Asia/Manila')::date)
      or placement.schedule_snapshot->'weekdays' is null or placement.schedule_snapshot->'breaks' is null or open_sessions<>0 or unresolved<>0 then raise exception 'Approved policy, placement, schedule and resolved attendance required' using errcode='40001';end if;
    if action='resume_clearance' then
      select * into moa from intrack.moa_routing_events where enrollment_id=e.id and submission_id=clearance.moa_submission_id and status in ('SIGNED AND NOTARIZED','SAS COPY SUBMITTED') order by enrollment_revision desc limit 1;
    else select * into moa from intrack.moa_routing_events where enrollment_id=e.id order by enrollment_revision desc limit 1;end if;
    if moa.id is null or moa.status not in ('SIGNED AND NOTARIZED','SAS COPY SUBMITTED') then raise exception 'Accepted MOA required' using errcode='40001';end if;
    gate:=intrack.requirement_gate(e.id,'pre',moa.submission_id);
    if (gate->>'ready')::boolean is distinct from true then raise exception 'Configured Pre-OJT evidence unresolved' using errcode='40001';end if;
    basis:=jsonb_build_object('placementId',placement.id,'placementRevision',placement.revision,'policyVersionId',policy.id,'moaVersionId',moa.submission_id,'requirements',gate->'basis');
    if action='resume_clearance' and basis is distinct from clearance.basis_snapshot then raise exception 'Clearance basis changed; revoke and issue new clearance' using errcode='40001';end if;
    next_stage:='during_ojt';next_clearance:='active';
  elsif action='suspend_clearance' then
    if e.lifecycle<>'during_ojt' or before_clearance<>'active' then raise exception 'Only active training clearance can suspend' using errcode='40001';end if;next_clearance:='suspended';
  elsif action='revoke_clearance' then
    if before_clearance not in ('active','suspended') then raise exception 'Only issued clearance can revoke' using errcode='40001';end if;next_clearance:='revoked';
  elsif action='enter_post_ojt' then
    gate:=intrack.requirement_gate(e.id,'during');
    if e.lifecycle<>'during_ojt' or credited<e.required_minutes or open_sessions<>0 or unresolved<>0 or (gate->>'ready')::boolean is distinct from true then raise exception 'Hours, During-OJT evidence and attendance resolution required' using errcode='40001';end if;
    next_stage:='post_ojt';next_clearance:='revoked';
  elsif action='enter_portfolio' then
    gate:=intrack.requirement_gate(e.id,'post');
    if e.lifecycle<>'post_ojt' or open_sessions<>0 or unresolved<>0 or (gate->>'ready')::boolean is distinct from true then raise exception 'Post-OJT evidence and resolved attendance required' using errcode='40001';end if;
    next_stage:='portfolio';next_clearance:='revoked';
  elsif action='return_to_training' then
    if e.lifecycle not in ('post_ojt','portfolio') or open_sessions<>0 then raise exception 'Resolve attendance before returning to training' using errcode='40001';end if;
    next_stage:='during_ojt';next_clearance:='revoked';
    update intrack.portfolio_versions set status='needs_revision',revision=revision+1,adviser_reviewed_by=null,adviser_approved_at=null,coordinator_reviewed_by=null,coordinator_approved_at=null
      where enrollment_id=e.id and is_current and status<>'draft';
  elsif action='withdraw' then next_outcome:='withdrawn';next_clearance:='revoked';end if;
  if action not in ('issue_clearance','resume_clearance') then basis:=coalesce(clearance.basis_snapshot,'{}'::jsonb);end if;
  if next_clearance is distinct from before_clearance and (placement.id is not null or clearance.placement_id is not null) then
    insert into intrack.clearance_events(enrollment_id,placement_id,moa_submission_id,status,actor_id,reason,command_id,enrollment_revision,basis_snapshot)
      values(e.id,coalesce(placement.id,clearance.placement_id),coalesce(moa.submission_id,clearance.moa_submission_id),next_clearance,actor,trim(payload->>'reason'),command_id,e.revision+1,basis);
  end if;
  if next_clearance<>'active' then
    for session in select * from intrack.attendance_sessions where enrollment_id=e.id and clock_out_at is null and status<>'void' for update loop
      update intrack.attendance_sessions set status='disputed',revision=revision+1 where id=session.id;
      insert into intrack.attendance_session_revisions(enrollment_id,session_id,revision,origin,actor_id,command_id,reason,frozen_snapshot)
        values(e.id,session.id,session.revision+1,'review',actor,command_id,trim(payload->>'reason'),to_jsonb(session)||jsonb_build_object('status','disputed','revision',session.revision+1));
    end loop;
  end if;
  update intrack.enrollments set lifecycle=next_stage,outcome=next_outcome,revision=revision+1 where id=e.id;
  insert into intrack.enrollment_events(enrollment_id,actor_id,action,reason,command_id,before_revision,after_revision,from_stage,to_stage,from_outcome,to_outcome,from_clearance,to_clearance,basis_snapshot)
    values(e.id,actor,action,trim(payload->>'reason'),command_id,e.revision,e.revision+1,e.lifecycle,next_stage,e.outcome,next_outcome,before_clearance,next_clearance,basis);
  insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(e.student_id,e.id,command_id::text,jsonb_build_object('kind','enrollment_transition','action',action,'stage',next_stage,'clearance',next_clearance));
  return intrack.finish_command(actor,command_id,'lifecycle',payload,jsonb_build_object('enrollmentId',e.id,'lifecycle',next_stage,'outcome',next_outcome,'clearance',next_clearance,'revision',e.revision+1),'enrollment',e.id,e.id,e.revision,e.revision+1);
end $$;
revoke all on function public.intrack_lifecycle_command(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_lifecycle_command(uuid,jsonb) to authenticated;
commit;
