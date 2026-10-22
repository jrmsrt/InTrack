-- LOCAL SYNTHETIC TEST ONLY. Execute in local Studio after migrations 1–4.
-- Create these two confirmed Auth accounts in local Studio first, with passwords
-- you choose: student.workflow@example.test and adviser.workflow@example.test.
-- This trusted fixture bypasses invitations ONLY for synthetic local testing.
-- It does not publish a university policy or approve use of real student data.
begin;
do $$
declare student_subject uuid; adviser_subject uuid; student uuid; adviser uuid;
  coordinator uuid; program uuid; policy uuid; definition uuid; term uuid; enrollment uuid;
  notice text;
begin
  select current_notice_version into notice from intrack.identity_configuration where singleton;
  if notice is distinct from 'dev-test-only' then raise exception 'Fixture requires the dev-test-only notice; never run against a university environment'; end if;
  select id into student_subject from auth.users where email='student.workflow@example.test' and email_confirmed_at is not null and deleted_at is null;
  select id into adviser_subject from auth.users where email='adviser.workflow@example.test' and email_confirmed_at is not null and deleted_at is null;
  if student_subject is null or adviser_subject is null then raise exception 'Create both confirmed synthetic Auth accounts first'; end if;
  select id into program from intrack.programs where code='BSIT';
  select p.id into coordinator from intrack.profiles p join intrack.memberships m on m.profile_id=p.id
    where p.status='active' and m.active and m.role='coordinator' and m.program_id=program order by p.created_at limit 1;
  if coordinator is null then raise exception 'Complete coordinator activation first'; end if;
  insert into intrack.profiles(auth_user_id,display_name,status,activated_at)
    values(student_subject,'Synthetic Workflow Student','active',now()) on conflict(auth_user_id) do nothing;
  insert into intrack.profiles(auth_user_id,display_name,status,activated_at)
    values(adviser_subject,'Synthetic Workflow Adviser','active',now()) on conflict(auth_user_id) do nothing;
  select id into student from intrack.profiles where auth_user_id=student_subject and status='active';
  select id into adviser from intrack.profiles where auth_user_id=adviser_subject and status='active';
  if student is null or adviser is null then raise exception 'Existing synthetic profile is disabled; fixture will not reactivate it'; end if;
  insert into intrack.memberships(profile_id,program_id,role,granted_by,change_reason)
    values(student,program,'student',coordinator,'Synthetic local requirement fixture'),(adviser,program,'adviser',coordinator,'Synthetic local requirement fixture')
    on conflict(profile_id,program_id,role) do nothing;
  insert into intrack.privacy_acknowledgments(profile_id,notice_version) values(student,notice),(adviser,notice) on conflict do nothing;
  insert into intrack.academic_terms(academic_year,semester,starts_on,ends_on)
    values('LOCAL-WORKFLOW-TEST','2',current_date,current_date+180) on conflict(academic_year,semester) do nothing;
  select id into term from intrack.academic_terms where academic_year='LOCAL-WORKFLOW-TEST' and semester='2';
  insert into intrack.policy_versions(program_id,component,version,year_level,semester,required_minutes)
    values(program,1,900001,4,'2',30000) on conflict(program_id,component,version) do nothing;
  select id into policy from intrack.policy_versions where program_id=program and component=1 and version=900001;
  select id into definition from intrack.requirement_definitions where policy_version_id=policy and code='LOCAL-TEST-EVIDENCE';
  if definition is null then
    insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,allowed_submission_stages)
      values(policy,'LOCAL-TEST-EVIDENCE','Synthetic requirement — sample evidence','pre','file','both',array['pre_ojt']) returning id into definition;
  end if;
  update intrack.policy_versions set confirmed_by=coordinator,confirmed_at=now() where id=policy and confirmed_at is null;
  insert into intrack.enrollments(student_id,program_id,term_id,policy_version_id,component,required_minutes)
    values(student,program,term,policy,1,30000) on conflict(student_id,term_id,program_id,component,attempt) do nothing;
  select id into enrollment from intrack.enrollments where student_id=student and term_id=term and policy_version_id=policy;
  if not exists(select 1 from intrack.adviser_assignments where enrollment_id=enrollment and ends_at is null) then
    insert into intrack.adviser_assignments(enrollment_id,adviser_id,assigned_by) values(enrollment,adviser,coordinator);
  end if;
  insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot)
    select enrollment,id,to_jsonb(d) from intrack.requirement_definitions d where id=definition on conflict(enrollment_id,definition_id,instance_key) do nothing;
  insert into intrack.audit_events(actor_id,enrollment_id,entity_type,entity_id,action,command_id,details)
    values(coordinator,enrollment,'enrollment',enrollment,'synthetic_local_fixture',gen_random_uuid(),'{"synthetic":true,"purpose":"local requirement workflow"}');
end $$;
commit;
