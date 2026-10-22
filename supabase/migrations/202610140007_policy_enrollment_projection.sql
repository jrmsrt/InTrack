begin;
create function intrack.enrollment_actor(target uuid, actor_role text)
returns uuid language plpgsql security definer set search_path='' as $$
declare enrollment intrack.enrollments%rowtype; actor uuid;
begin
  select * into enrollment from intrack.enrollments where id=target;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.authorized_actor(actor_role,enrollment.program_id);
  if actor_role='student' and enrollment.student_id<>actor then raise exception 'Student scope denied' using errcode='42501';end if;
  if actor_role='adviser' then
    perform 1 from intrack.adviser_assignments where enrollment_id=target and adviser_id=actor and ends_at is null and starts_at<=now() for share;
    if not found then raise exception 'Current assignment required' using errcode='42501';end if;
  end if;
  return actor;
end $$;
revoke all on function intrack.enrollment_actor(uuid,text) from public,anon,authenticated;

create function public.intrack_publish_policy(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<publication>>
declare source intrack.policy_versions%rowtype; actor uuid; receipt jsonb; id uuid; version integer; item jsonb; recurrence jsonb; occurrence jsonb; settings jsonb;
begin
  select * into source from intrack.policy_versions where policy_versions.id=(payload->>'sourcePolicyId')::uuid;
  if not found then raise exception 'Policy unavailable' using errcode='42501';end if;
  actor:=intrack.authorized_actor('coordinator',source.program_id);
  receipt:=intrack.begin_command(actor,command_id,'publish_policy',payload);if receipt is not null then return receipt;end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('policy:'||source.program_id::text||':'||source.component::text,0));
  if source.year_level is null or source.semester is null or coalesce(length(trim(payload->>'approvalReference')),0) not between 1 and 1000 then raise exception 'Confirmed academic labels and approval reference required' using errcode='22023';end if;
  if jsonb_typeof(payload->'requirements') is distinct from 'array' or jsonb_array_length(payload->'requirements') not between 1 and 100 then raise exception 'Configured requirement list required' using errcode='22023';end if;
  settings:=payload->'attendancePolicy';
  if jsonb_typeof(settings) is distinct from 'object' or (settings->>'confirmed')::boolean is distinct from true
    or coalesce((settings->>'dailyCapMinutes')::integer,0) not between 1 and 1440
    or coalesce((settings->>'maxSessionMinutes')::integer,0) not between 1 and 1440
    or coalesce((settings->>'maxAccuracyMeters')::numeric,0)<=0
    or coalesce((settings->>'maxCoordinateAgeSeconds')::integer,0) not between 1 and 300 then
    raise exception 'Approved attendance settings required; defaults are not policy' using errcode='22023';
  end if;
  select coalesce(max(v.version),0)+1 into version from intrack.policy_versions v where v.program_id=source.program_id and v.component=source.component;
  insert into intrack.policy_versions(program_id,component,version,year_level,semester,required_minutes,attendance_policy)
    values(source.program_id,source.component,version,source.year_level,source.semester,source.required_minutes,settings||jsonb_build_object('approvalReference',payload->>'approvalReference')) returning policy_versions.id into id;
  for item in select value from jsonb_array_elements(payload->'requirements') loop
    if coalesce(length(trim(item->>'code')),0) not between 1 and 80 or coalesce(length(trim(item->>'title')),0) not between 1 and 240
      or coalesce(item->>'stage','') not in ('pre','during','post','portfolio') or coalesce(item->>'reviewer','') not in ('adviser','coordinator','both')
      or coalesce(item->>'evidenceType','') not in ('file','staff_verification','moa','dtr','journal','evaluation','portfolio')
      or jsonb_typeof(item->'allowedStages') is distinct from 'array' or jsonb_array_length(item->'allowedStages')=0 then
      raise exception 'Every requirement needs explicit evidence, reviewer and submission stages' using errcode='22023';end if;
    recurrence:=coalesce(item->'recurrence','{"kind":"once"}'::jsonb);
    if coalesce(recurrence->>'kind','') not in ('once','occurrences') then raise exception 'Explicit recurrence required' using errcode='22023';end if;
    if recurrence->>'kind'='occurrences' then
      if jsonb_typeof(recurrence->'items') is distinct from 'array' or jsonb_array_length(recurrence->'items') not between 1 and 100 then raise exception 'Bounded occurrence list required' using errcode='22023';end if;
      for occurrence in select value from jsonb_array_elements(recurrence->'items') loop
        if coalesce(length(occurrence->>'key'),0) not between 1 and 80 then raise exception 'Occurrence key required' using errcode='22023';end if;
        perform (occurrence->>'dueAt')::timestamptz;
      end loop;
      if (select count(*) from jsonb_array_elements(recurrence->'items'))<>(select count(distinct value->>'key') from jsonb_array_elements(recurrence->'items')) then raise exception 'Duplicate occurrence key' using errcode='22023';end if;
    else perform (recurrence->>'dueAt')::timestamptz;end if;
    if item->>'templateVersionId' is not null and not exists(select 1 from intrack.template_versions where template_versions.id=(item->>'templateVersionId')::uuid and program_id=source.program_id and status='published') then raise exception 'Published scoped template required' using errcode='42501';end if;
    -- Evaluation rubric publication has its own workflow; avoid claiming that a
    -- generic requirement row constitutes an approved rubric.
    if item->>'evidenceType'='evaluation' then raise exception 'Publish evaluation rubric through its specialized workflow first' using errcode='22023';end if;
    insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,mandatory,allowed_submission_stages,template_version_id,recurrence)
      values(id,trim(item->>'code'),trim(item->>'title'),item->>'stage',item->>'evidenceType',item->>'reviewer',coalesce((item->>'mandatory')::boolean,true),
        array(select jsonb_array_elements_text(item->'allowedStages')),(item->>'templateVersionId')::uuid,recurrence);
  end loop;
  update intrack.policy_versions set confirmed_by=actor,confirmed_at=now() where policy_versions.id=publication.id;
  return intrack.finish_command(actor,command_id,'publish_policy',payload,jsonb_build_object('policyId',id,'version',version),'policy',id);
end $$;
revoke all on function public.intrack_publish_policy(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_publish_policy(uuid,jsonb) to authenticated;

create function public.intrack_enroll_student(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<enrolling>>
declare policy intrack.policy_versions%rowtype; actor uuid; receipt jsonb; term intrack.academic_terms%rowtype;
  student intrack.profiles%rowtype; id uuid; definition intrack.requirement_definitions%rowtype; occurrence jsonb; attempt integer;
begin
  select * into policy from intrack.policy_versions where policy_versions.id=(payload->>'policyId')::uuid;
  if not found then raise exception 'Policy unavailable' using errcode='42501';end if;
  actor:=intrack.authorized_actor('coordinator',policy.program_id);
  receipt:=intrack.begin_command(actor,command_id,'enroll_student',payload);if receipt is not null then return receipt;end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('enrollment:'||(payload->>'studentId'),0));
  select * into student from intrack.profiles where profiles.id=(payload->>'studentId')::uuid for share;
  if not found or student.status<>'active' or student.id=actor then raise exception 'Active other student required' using errcode='42501';end if;
  perform 1 from intrack.memberships where profile_id=student.id and program_id=policy.program_id and role='student' and active for share;
  if not found then raise exception 'Student membership required' using errcode='42501';end if;
  select * into term from intrack.academic_terms where academic_terms.id=(payload->>'termId')::uuid;
  if not found or term.semester<>policy.semester or policy.confirmed_at is null then raise exception 'Matching term and published policy required' using errcode='22023';end if;
  attempt:=coalesce((payload->>'attempt')::integer,1);
  if attempt not between 1 and 99 or not exists(select 1 from intrack.requirement_definitions where policy_version_id=policy.id) then raise exception 'Valid attempt and configured requirements required' using errcode='22023';end if;
  if exists(select 1 from intrack.enrollments where student_id=student.id and term_id=term.id and program_id=policy.program_id and component=policy.component and enrollments.attempt=enrolling.attempt) then raise exception 'Attempt already enrolled; a new policy does not create another enrollment' using errcode='40001';end if;
  insert into intrack.enrollments(student_id,program_id,term_id,policy_version_id,component,attempt,required_minutes)
    values(student.id,policy.program_id,term.id,policy.id,policy.component,attempt,policy.required_minutes) returning enrollments.id into id;
  for definition in select * from intrack.requirement_definitions where policy_version_id=policy.id loop
    if definition.recurrence->>'kind'='occurrences' then
      for occurrence in select value from jsonb_array_elements(definition.recurrence->'items') loop
        insert into intrack.enrollment_requirements(enrollment_id,definition_id,instance_key,definition_snapshot,due_at)
          values(id,definition.id,occurrence->>'key',to_jsonb(definition),(occurrence->>'dueAt')::timestamptz);
      end loop;
    else
      insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot,due_at)
        values(id,definition.id,to_jsonb(definition),(definition.recurrence->>'dueAt')::timestamptz);
    end if;
  end loop;
  return intrack.finish_command(actor,command_id,'enroll_student',payload,jsonb_build_object('enrollmentId',id,'revision',0),'enrollment',id,id,null,0);
end $$;
revoke all on function public.intrack_enroll_student(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_enroll_student(uuid,jsonb) to authenticated;

create function public.intrack_assign_adviser(command_id uuid, enrollment_id uuid, expected_revision integer, adviser_id uuid, reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; actor uuid; payload jsonb; receipt jsonb;
begin
  select * into e from intrack.enrollments where id=enrollment_id for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,'coordinator');
  payload:=jsonb_build_object('enrollmentId',e.id,'expectedRevision',expected_revision,'adviserId',adviser_id,'reason',reason);
  receipt:=intrack.begin_command(actor,command_id,'assign_adviser',payload);if receipt is not null then return receipt;end if;
  if e.outcome<>'active' or expected_revision is distinct from e.revision then raise exception 'Closed or stale enrollment' using errcode='40001';end if;
  if adviser_id=e.student_id or coalesce(length(trim(reason)),0) not between 1 and 1000 then raise exception 'Other adviser and assignment reason required' using errcode='22023';end if;
  perform 1 from intrack.profiles where id=adviser_id and status='active' for share;
  if not found then raise exception 'Active adviser required' using errcode='42501';end if;
  perform 1 from intrack.memberships where profile_id=adviser_id and program_id=e.program_id and role='adviser' and active for share;
  if not found then raise exception 'Scoped adviser membership required' using errcode='42501';end if;
  update intrack.adviser_assignments set ends_at=clock_timestamp() where adviser_assignments.enrollment_id=e.id and ends_at is null;
  insert into intrack.adviser_assignments(enrollment_id,adviser_id,assigned_by) values(e.id,adviser_id,actor);
  update intrack.enrollments set revision=revision+1 where id=e.id;
  insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(adviser_id,e.id,command_id::text,jsonb_build_object('kind','assignment','enrollmentId',e.id));
  return intrack.finish_command(actor,command_id,'assign_adviser',payload,jsonb_build_object('enrollmentId',e.id,'revision',e.revision+1),'enrollment',e.id,e.id,e.revision,e.revision+1);
end $$;
revoke all on function public.intrack_assign_adviser(uuid,uuid,integer,uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_assign_adviser(uuid,uuid,integer,uuid,text) to authenticated;

create function public.intrack_list_enrollments(actor_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
  actor:=intrack.authorized_actor(actor_role);
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'studentId',e.student_id,'studentName',p.display_name,
    'programId',e.program_id,'programCode',program.code,'policyVersionId',e.policy_version_id,'component',e.component,
    'termId',e.term_id,'lifecycle',e.lifecycle,'outcome',e.outcome,'revision',e.revision,
    'requiredMinutes',e.required_minutes,'creditedMinutes',coalesce(credit.minutes,0),'remainingMinutes',greatest(0,e.required_minutes-coalesce(credit.minutes,0)),
    'adviserId',a.adviser_id,'clearance',coalesce(c.status,'not_issued'),'clearanceBasis',c.basis_snapshot,
    'moaStatus',coalesce(m.status,'NO MOA'),'moaVersionId',m.submission_id,
    'openSessions',(select count(*) from intrack.attendance_sessions s where s.enrollment_id=e.id and s.clock_out_at is null and s.status<>'void')
  ) order by e.created_at desc,e.id),'[]'::jsonb) into result
  from intrack.enrollments e join intrack.profiles p on p.id=e.student_id join intrack.programs program on program.id=e.program_id
  left join intrack.adviser_assignments a on a.enrollment_id=e.id and a.ends_at is null and a.starts_at<=now()
  left join lateral(select sum(h.minutes)::integer minutes from intrack.hour_credits h where h.enrollment_id=e.id and h.invalidated_at is null) credit on true
  left join lateral(select * from intrack.clearance_events c where c.enrollment_id=e.id order by c.enrollment_revision desc,c.created_at desc,c.id desc limit 1)c on true
  left join lateral(select * from intrack.moa_routing_events m where m.enrollment_id=e.id order by m.enrollment_revision desc,m.created_at desc,m.id desc limit 1)m on true
  where exists(select 1 from intrack.memberships mem where mem.profile_id=actor and mem.program_id=e.program_id and mem.role=actor_role and mem.active)
    and (actor_role='coordinator' or (actor_role='student' and e.student_id=actor) or (actor_role='adviser' and a.adviser_id=actor));
  return result;
end $$;
revoke all on function public.intrack_list_enrollments(text) from public,anon,authenticated;
grant execute on function public.intrack_list_enrollments(text) to authenticated;

-- Narrow coordinator directory for actual configuration/assignment; no Auth
-- credentials, unscoped programs or complete database dumps are returned.
create function public.intrack_administration_directory()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; programs uuid[];
begin
  actor:=intrack.authorized_actor('coordinator');
  select array_agg(program_id) into programs from intrack.memberships where profile_id=actor and role='coordinator' and active;
  return jsonb_build_object(
    'programs',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'studentDomains',coalesce(c.student_email_domains,'{}'),'staffDomains',coalesce(c.staff_email_domains,'{}'))),'[]') from intrack.programs p left join intrack.program_configuration c on c.program_id=p.id where p.id=any(programs)),
    'policies',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'programId',program_id,'component',component,'version',version,'requiredMinutes',required_minutes,'yearLevel',year_level,'semester',semester,'published',confirmed_at is not null)),'[]') from intrack.policy_versions where program_id=any(programs)),
    'terms',(select coalesce(jsonb_agg(to_jsonb(t)),'[]') from intrack.academic_terms t),
    'memberships',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'profileId',p.id,'name',p.display_name,'programId',m.program_id,'role',m.role,'active',m.active,'revision',m.revision)),'[]') from intrack.memberships m join intrack.profiles p on p.id=m.profile_id where m.program_id=any(programs)),
    'eligibleStudents',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',display_name,'studentNumber',student_number,'email',email,'programId',program_id,'section',section,'profileId',invited_profile_id)),'[]') from intrack.eligible_students where program_id=any(programs))
  );
end $$;
revoke all on function public.intrack_administration_directory() from public,anon,authenticated;
grant execute on function public.intrack_administration_directory() to authenticated;
commit;
