begin;

-- One term-specific class owner, established by the enrolling adviser.
create table intrack.practicum_classes (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references intrack.programs(id),
 term_id uuid not null references intrack.academic_terms(id), policy_id uuid not null references intrack.policy_versions(id),
 section text not null check(section ~ '^[1-9][0-9]*-[1-9][0-9]*$'),
 adviser_id uuid references intrack.profiles(id), created_by uuid not null references intrack.profiles(id), created_at timestamptz not null default now(),
 unique(program_id,term_id,section)
);
create table intrack.practicum_class_members (
 enrollment_id uuid primary key references intrack.enrollments(id), class_id uuid not null references intrack.practicum_classes(id),
 created_by uuid not null references intrack.profiles(id), created_at timestamptz not null default now()
);
alter table intrack.practicum_classes enable row level security;
alter table intrack.practicum_class_members enable row level security;
revoke all on intrack.practicum_classes,intrack.practicum_class_members from public,anon,authenticated;

create function public.intrack_create_academic_term(command_id uuid, actor_role text, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt jsonb; term intrack.academic_terms%rowtype; yr text; sem text; start_date date; end_date date;
begin
 if actor_role not in ('coordinator','adviser') then raise exception 'Staff role required' using errcode='42501';end if;
 actor:=intrack.authorized_actor(actor_role);
 receipt:=intrack.begin_command(actor,command_id,'create_academic_term',payload);if receipt is not null then return receipt;end if;
 yr:=trim(payload->>'academicYear');sem:=payload->>'semester';start_date:=(payload->>'startsOn')::date;end_date:=(payload->>'endsOn')::date;
 if yr is null or yr !~ '^[0-9]{4}-[0-9]{4}$' or split_part(yr,'-',2)::integer<>split_part(yr,'-',1)::integer+1
 or sem is null or sem not in ('1','2','summer') or start_date is null or end_date is null or end_date<start_date or end_date-start_date>366
 or extract(year from start_date) not between split_part(yr,'-',1)::integer and split_part(yr,'-',2)::integer
 or extract(year from end_date) not between split_part(yr,'-',1)::integer and split_part(yr,'-',2)::integer
 or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Academic year, semester, valid dates and reference required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('term:'||yr||':'||sem,0));
 select * into term from intrack.academic_terms where academic_year=yr and semester=sem;
 if found then
  if term.starts_on<>start_date or term.ends_on<>end_date then raise exception 'This term already exists with different dates. Existing terms are preserved.' using errcode='40001';end if;
 else insert into intrack.academic_terms(academic_year,semester,starts_on,ends_on) values(yr,sem,start_date,end_date) returning * into term;end if;
 return intrack.finish_command(actor,command_id,'create_academic_term',payload,jsonb_build_object('termId',term.id),'academic_term',term.id);
end $$;

create function public.intrack_enrollment_configuration(actor_role text, filters jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; scope_programs uuid[]; chosen_term uuid; chosen_program uuid; chosen_section text;
begin
 if actor_role not in ('coordinator','adviser') then raise exception 'Staff role required' using errcode='42501';end if;
 actor:=intrack.authorized_actor(actor_role);
 select array_agg(program_id) into scope_programs from intrack.memberships where profile_id=actor and role=actor_role and active;
 chosen_term:=nullif(filters->>'termId','')::uuid;chosen_program:=nullif(filters->>'programId','')::uuid;chosen_section:=nullif(trim(filters->>'section'),'');
 if chosen_program is not null and not chosen_program=any(scope_programs) then raise exception 'Program scope denied' using errcode='42501';end if;
 return jsonb_build_object(
 'programs',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'code',code) order by code),'[]') from intrack.programs where id=any(scope_programs)),
 'terms',(select coalesce(jsonb_agg(to_jsonb(t) order by starts_on desc),'[]') from intrack.academic_terms t),
 'policies',(select coalesce(jsonb_agg(jsonb_build_object('id',v.id,'programId',v.program_id,'component',v.component,'version',v.version,'yearLevel',v.year_level,'semester',v.semester,'requiredMinutes',v.required_minutes,'published',v.confirmed_at is not null,'attendanceConfirmed',coalesce((v.attendance_policy->>'confirmed')::boolean,false),'requirements',coalesce((select jsonb_agg(jsonb_build_object('code',d.code,'title',d.title,'stage',d.stage,'evidenceType',d.evidence_type,'reviewer',d.reviewer,'mandatory',d.mandatory,'allowedStages',d.allowed_submission_stages,'recurrence',d.recurrence) order by d.stage,d.code) from intrack.requirement_definitions d where d.policy_version_id=v.id),'[]')) order by v.component,v.version desc),'[]') from intrack.policy_versions v where v.program_id=any(scope_programs)),
 'classes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'programId',c.program_id,'termId',c.term_id,'policyId',c.policy_id,'section',c.section,'adviserId',c.adviser_id,'adviserName',p.display_name,'studentCount',(select count(*) from intrack.practicum_class_members m where m.class_id=c.id)) order by c.section),'[]') from intrack.practicum_classes c left join intrack.profiles p on p.id=c.adviser_id where c.program_id=any(scope_programs) and (chosen_term is null or c.term_id=chosen_term)),
 'students',case when actor_role<>'coordinator' or chosen_term is null or chosen_program is null or chosen_section is null then '[]'::jsonb else
 (select coalesce(jsonb_agg(to_jsonb(s) order by s.name),'[]') from (
 select es.invited_profile_id as id,es.display_name as name,es.student_number as "studentNumber",es.section,p.status,
 e.id as "enrollmentId",e.policy_version_id as "policyId",e.outcome,a.adviser_id as "adviserId"
 from intrack.eligible_students es join intrack.profiles p on p.id=es.invited_profile_id and p.status in ('active','invited') and p.auth_user_id is not null
 join intrack.memberships m on m.profile_id=p.id and m.program_id=es.program_id and m.role='student' and m.active
 left join intrack.enrollments e on e.student_id=p.id and e.program_id=es.program_id and e.term_id=chosen_term and e.attempt=1
 left join intrack.adviser_assignments a on a.enrollment_id=e.id and a.ends_at is null and a.starts_at<=now()
 where es.program_id=chosen_program and es.section=chosen_section
 and (actor_role='coordinator' or not exists(select 1 from intrack.practicum_classes c where c.program_id=es.program_id and c.term_id=chosen_term and c.section=es.section and c.adviser_id is not null and c.adviser_id<>actor))
 and (actor_role='coordinator' or a.adviser_id is null or a.adviser_id=actor)
 order by es.display_name limit 501) s) end);
end $$;

create function public.intrack_enroll_practicum_class(command_id uuid, actor_role text, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<class_enrollment>>
declare actor uuid;receipt jsonb;policy intrack.policy_versions%rowtype;term intrack.academic_terms%rowtype;
 class intrack.practicum_classes%rowtype;section text;student_id uuid;student intrack.profiles%rowtype;enrollment intrack.enrollments%rowtype;
 definition intrack.requirement_definitions%rowtype;occurrence jsonb;adviser uuid;created_count integer:=0;assigned_count integer:=0;ids jsonb:='[]';
begin
 if actor_role not in ('coordinator','adviser') then raise exception 'Staff role required' using errcode='42501';end if;
 select * into policy from intrack.policy_versions where id=(payload->>'policyId')::uuid;
 if not found then raise exception 'Policy unavailable' using errcode='42501';end if;
 actor:=intrack.authorized_actor(actor_role,policy.program_id);
 receipt:=intrack.begin_command(actor,command_id,'enroll_practicum_class',payload);if receipt is not null then return receipt;end if;
 section:=trim(payload->>'section');
 select * into term from intrack.academic_terms where id=(payload->>'termId')::uuid;
 if not found or term.semester<>policy.semester or policy.confirmed_at is null or section is null or section !~ '^[1-9][0-9]*-[1-9][0-9]*$'
 or split_part(section,'-',1)::integer<>policy.year_level or not exists(select 1 from intrack.requirement_definitions where policy_version_id=policy.id)
 or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Published practicum, matching year/term, section and reason required' using errcode='22023';end if;
 if jsonb_typeof(payload->'studentIds') is distinct from 'array' or jsonb_array_length(payload->'studentIds') not between 1 and 500
 or (select count(distinct value) from jsonb_array_elements_text(payload->'studentIds'))<>jsonb_array_length(payload->'studentIds') then raise exception 'Select 1–500 distinct whitelisted students' using errcode='22023';end if;
 -- Same lock for both roles makes first-adviser ownership atomic under concurrency.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class:'||policy.program_id::text||':'||term.id::text||':'||section,0));
 select * into class from intrack.practicum_classes c where c.program_id=policy.program_id and c.term_id=term.id and c.section=class_enrollment.section for update;
 if found then
  if class.policy_id<>policy.id then raise exception 'Class already uses a different frozen practicum policy' using errcode='40001';end if;
  if actor_role='adviser' and class.adviser_id is not null and class.adviser_id<>actor then raise exception 'This class is already enrolled by another adviser. No assignment was changed.' using errcode='42501';end if;
  if actor_role='adviser' and class.adviser_id is null then update intrack.practicum_classes set adviser_id=actor where id=class.id returning * into class;end if;
 else
  insert into intrack.practicum_classes(program_id,term_id,policy_id,section,adviser_id,created_by)
   values(policy.program_id,term.id,policy.id,section,case when actor_role='adviser' then actor end,actor) returning * into class;
 end if;
 for student_id in select value::uuid from jsonb_array_elements_text(payload->'studentIds') order by value loop
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('enrollment:'||student_id::text,0));
  select * into student from intrack.profiles p where p.id=student_id for share;
  if not found or student.id=actor or student.status not in ('active','invited') or student.auth_user_id is null then raise exception 'Whitelisted other student required' using errcode='42501';end if;
  perform 1 from auth.users u where u.id=student.auth_user_id and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) for share;
  if not found then raise exception 'Student Auth account is unavailable' using errcode='42501';end if;
  perform 1 from intrack.memberships m where m.profile_id=student_id and m.program_id=policy.program_id and m.role='student' and m.active for share;
  if not found then raise exception 'Student program scope denied' using errcode='42501';end if;
  perform 1 from intrack.eligible_students es where es.invited_profile_id=student_id and es.program_id=policy.program_id and es.section=class_enrollment.section for share;
  if not found then raise exception 'Student does not belong to the selected masterlist section' using errcode='42501';end if;
  select * into enrollment from intrack.enrollments e where e.student_id=class_enrollment.student_id and e.program_id=policy.program_id and e.term_id=term.id and e.component=policy.component and e.attempt=1 for update;
  if found then
   if enrollment.policy_version_id<>policy.id or enrollment.outcome<>'active' then raise exception 'Existing enrollment is closed or uses another policy' using errcode='40001';end if;
  else
   insert into intrack.enrollments(student_id,program_id,term_id,policy_version_id,component,attempt,required_minutes)
    values(student_id,policy.program_id,term.id,policy.id,policy.component,1,policy.required_minutes) returning * into enrollment;
   for definition in select * from intrack.requirement_definitions where policy_version_id=policy.id loop
    if definition.recurrence->>'kind'='occurrences' then
     for occurrence in select value from jsonb_array_elements(definition.recurrence->'items') loop
      insert into intrack.enrollment_requirements(enrollment_id,definition_id,instance_key,definition_snapshot,due_at) values(enrollment.id,definition.id,occurrence->>'key',to_jsonb(definition),(occurrence->>'dueAt')::timestamptz);
     end loop;
    else insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot,due_at) values(enrollment.id,definition.id,to_jsonb(definition),(definition.recurrence->>'dueAt')::timestamptz);end if;
   end loop;
   created_count:=created_count+1;
  end if;
  if exists(select 1 from intrack.practicum_class_members m where m.enrollment_id=enrollment.id and m.class_id<>class.id) then raise exception 'Enrollment already belongs to another class' using errcode='40001';end if;
  insert into intrack.practicum_class_members(enrollment_id,class_id,created_by) values(enrollment.id,class.id,actor) on conflict(enrollment_id) do nothing;
  select adviser_id into adviser from intrack.adviser_assignments a where a.enrollment_id=enrollment.id and a.ends_at is null and a.starts_at<=now() for update;
  if adviser is not null and class.adviser_id is not null and adviser<>class.adviser_id then raise exception 'Existing adviser assignment conflicts; no reassignment was made' using errcode='42501';end if;
  if adviser is null and class.adviser_id is not null then
   perform 1 from intrack.memberships m join intrack.profiles p on p.id=m.profile_id where m.profile_id=class.adviser_id and m.program_id=policy.program_id and m.role='adviser' and m.active and p.status='active' for share of m,p;
   if not found then raise exception 'Class adviser is no longer active' using errcode='42501';end if;
   insert into intrack.adviser_assignments(enrollment_id,adviser_id,assigned_by) values(enrollment.id,class.adviser_id,actor);
   update intrack.enrollments set revision=revision+1 where id=enrollment.id;assigned_count:=assigned_count+1;
  end if;
  ids:=ids||jsonb_build_array(enrollment.id);
 end loop;
 return intrack.finish_command(actor,command_id,'enroll_practicum_class',payload,jsonb_build_object('classId',class.id,'created',created_count,'assigned',assigned_count,'adviserId',class.adviser_id,'enrollmentIds',ids),'practicum_class',class.id);
end $$;

revoke all on function public.intrack_create_academic_term(uuid,text,jsonb),public.intrack_enrollment_configuration(text,jsonb),public.intrack_enroll_practicum_class(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_create_academic_term(uuid,text,jsonb),public.intrack_enrollment_configuration(text,jsonb),public.intrack_enroll_practicum_class(uuid,text,jsonb) to authenticated;
commit;
