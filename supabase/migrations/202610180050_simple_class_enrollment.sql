begin;
create table intrack.program_checklists (
 program_id uuid primary key references intrack.programs(id), requirements jsonb not null,
 attendance_policy jsonb not null default '{"confirmed":false,"intakeOnly":true}',
 revision integer not null default 1, updated_by uuid references intrack.profiles(id), updated_at timestamptz not null default now()
);
alter table intrack.program_checklists enable row level security;
revoke all on intrack.program_checklists from public,anon,authenticated;
create table intrack.program_checklist_history (
 program_id uuid not null references intrack.programs(id), revision integer not null,
 requirements jsonb not null, attendance_policy jsonb not null, updated_by uuid references intrack.profiles(id), created_at timestamptz not null default now(),
 primary key(program_id,revision)
);
alter table intrack.program_checklist_history enable row level security;
revoke all on intrack.program_checklist_history from public,anon,authenticated;
create trigger preserve_program_checklists before update or delete on intrack.program_checklist_history for each row execute function intrack.guard_append_only();

-- Standard checklist approved for the simplified application workflow.
-- Preserve the latest configured requirement overrides and additional items.
with defaults as (select '[{"code":"PRE-01","title":"Certificate of Registration (COR)","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-02","title":"Resume","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-03","title":"Notarize Memorandum of Agreement (MOA)","stage":"pre","evidenceType":"moa","reviewer":"coordinator","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-04","title":"Endorsement/Recommendation Letter","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-05","title":"Notarized Waiver/Consent Form","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-06","title":"Notarized Internship Agreement","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-07","title":"Student Practicum Plan","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-08","title":"Medical Certificate","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-09","title":"Good Moral Certificate","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-10","title":"Certificate of Insurance","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-11","title":"Certificate (Sexual Harassment and Work Ethics)","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-12","title":"SIS grades (1st year to 3rd year)","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-13","title":"Practicum kit (expanded envelope)","stage":"pre","evidenceType":"staff_verification","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-14","title":"Attendance OJT Orientation","stage":"pre","evidenceType":"staff_verification","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"PRE-15","title":"Certificate (OJT Orientation)","stage":"pre","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["pre_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-01","title":"Daily Time Record","stage":"during","evidenceType":"dtr","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-02","title":"Self-Reflection","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-03","title":"Weekly Journal (Week 1)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-04","title":"Weekly Journal (Week 2)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-05","title":"Weekly Journal (Week 3)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-06","title":"Weekly Journal (Week 4)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-07","title":"Weekly Journal (Week 5)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-08","title":"Weekly Journal (Week 6)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-09","title":"Weekly Journal (Week 7)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-10","title":"Weekly Journal (Week 8)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-11","title":"Weekly Journal (Week 9)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-12","title":"Weekly Journal (Week 10)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-13","title":"Weekly Journal (Week 11)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-14","title":"Weekly Journal (Week 12)","stage":"during","evidenceType":"journal","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-15","title":"Pictures / Documentation (Week 1)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-16","title":"Pictures / Documentation (Week 2)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-17","title":"Pictures / Documentation (Week 3)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-18","title":"Pictures / Documentation (Week 4)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-19","title":"Pictures / Documentation (Week 5)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-20","title":"Pictures / Documentation (Week 6)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-21","title":"Pictures / Documentation (Week 7)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-22","title":"Pictures / Documentation (Week 8)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-23","title":"Pictures / Documentation (Week 9)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-24","title":"Pictures / Documentation (Week 10)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-25","title":"Pictures / Documentation (Week 11)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"DURING-26","title":"Pictures / Documentation (Week 12)","stage":"during","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["during_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"POST-01","title":"Student Performance Evaluation","stage":"post","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["post_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"POST-02","title":"HTE Supervisor’s Evaluation","stage":"post","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["post_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"POST-03","title":"HTE Evaluation","stage":"post","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["post_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"POST-04","title":"Certificate of Completion","stage":"post","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["post_ojt"],"recurrence":{"kind":"once","dueAt":null}},{"code":"POST-05","title":"Curriculum Vitae/Resume with picture","stage":"post","evidenceType":"file","reviewer":"adviser","mandatory":true,"allowedStages":["post_ojt"],"recurrence":{"kind":"once","dueAt":null}}]'::jsonb as items)
insert into intrack.program_checklists(program_id,requirements,attendance_policy)
select p.id,
 (select jsonb_agg(coalesce(override.item,base.item) order by base.ordinal)
 from jsonb_array_elements(defaults.items) with ordinality base(item,ordinal)
 left join lateral (
  select jsonb_build_object('code',d.code,'title',d.title,'stage',d.stage,'evidenceType',d.evidence_type,'reviewer',d.reviewer,'mandatory',d.mandatory,'allowedStages',d.allowed_submission_stages,'recurrence',case when d.recurrence->>'kind' in ('once','occurrences') then d.recurrence else '{"kind":"once","dueAt":null}'::jsonb end,'templateVersionId',d.template_version_id) as item
  from intrack.requirement_definitions d where d.policy_version_id=latest.id and (d.code=base.item->>'code' or d.title=base.item->>'title') order by (d.code=base.item->>'code') desc limit 1
 ) override on true)
 || coalesce((select jsonb_agg(jsonb_build_object('code',d.code,'title',d.title,'stage',d.stage,'evidenceType',d.evidence_type,'reviewer',d.reviewer,'mandatory',d.mandatory,'allowedStages',d.allowed_submission_stages,'recurrence',case when d.recurrence->>'kind' in ('once','occurrences') then d.recurrence else '{"kind":"once","dueAt":null}'::jsonb end,'templateVersionId',d.template_version_id) order by d.code) from intrack.requirement_definitions d where d.policy_version_id=latest.id and not exists(select 1 from jsonb_array_elements(defaults.items) base where base->>'code'=d.code or base->>'title'=d.title)),'[]'::jsonb)
, case when (latest.attendance_policy->>'confirmed')::boolean is true then latest.attendance_policy else '{"confirmed":false,"intakeOnly":true}'::jsonb end
from intrack.programs p cross join defaults left join lateral (select id,attendance_policy from intrack.policy_versions v where v.program_id=p.id and v.confirmed_at is not null order by v.confirmed_at desc,v.version desc limit 1) latest on true;

insert into intrack.program_checklist_history(program_id,revision,requirements,attendance_policy,updated_by)
select program_id,revision,requirements,attendance_policy,updated_by from intrack.program_checklists;

create function intrack.validate_program_checklist(items jsonb)
returns void language plpgsql set search_path='' as $$
declare item jsonb; occurrence jsonb;
begin
 if jsonb_typeof(items) is distinct from 'array' or jsonb_array_length(items) not between 1 and 100 then raise exception 'A requirement checklist is required' using errcode='22023';end if;
 if (select count(*) from jsonb_array_elements(items))<>(select count(distinct value->>'code') from jsonb_array_elements(items)) then raise exception 'Duplicate requirement code' using errcode='22023';end if;
 for item in select value from jsonb_array_elements(items) loop
  if coalesce(length(trim(item->>'code')),0) not between 1 and 80 or coalesce(length(trim(item->>'title')),0) not between 1 and 240
   or coalesce(item->>'stage','') not in ('pre','during','post','portfolio')
   or coalesce(item->>'reviewer','') not in ('adviser','coordinator','both')
   or coalesce(item->>'evidenceType','') not in ('file','staff_verification','moa','dtr','journal','portfolio')
   or jsonb_typeof(item->'mandatory') is distinct from 'boolean'
   or jsonb_typeof(item->'allowedStages') is distinct from 'array' or jsonb_array_length(item->'allowedStages')=0
   or exists(select 1 from jsonb_array_elements_text(item->'allowedStages') s where s not in ('pre_ojt','during_ojt','post_ojt','portfolio')) then raise exception 'Invalid requirement settings' using errcode='22023';end if;
  if (item->>'evidenceType'='moa' and item->>'reviewer'<>'coordinator') or (item->>'evidenceType' in ('dtr','journal') and item->>'reviewer'<>'adviser') or (item->>'evidenceType'='portfolio' and item->>'reviewer'<>'both') then raise exception 'Reviewer does not match evidence workflow' using errcode='22023';end if;
  if coalesce(item->'recurrence'->>'kind','')='once' then perform (item->'recurrence'->>'dueAt')::timestamptz;
  elsif item->'recurrence'->>'kind'='occurrences' then
   if jsonb_typeof(item->'recurrence'->'items') is distinct from 'array' or jsonb_array_length(item->'recurrence'->'items') not between 1 and 100 then raise exception 'Invalid recurring requirements' using errcode='22023';end if;
   for occurrence in select value from jsonb_array_elements(item->'recurrence'->'items') loop
    if coalesce(length(occurrence->>'key'),0) not between 1 and 80 then raise exception 'Occurrence key required' using errcode='22023';end if;
    perform (occurrence->>'dueAt')::timestamptz;
   end loop;
   if (select count(*) from jsonb_array_elements(item->'recurrence'->'items'))<>(select count(distinct value->>'key') from jsonb_array_elements(item->'recurrence'->'items')) then raise exception 'Duplicate occurrence key' using errcode='22023';end if;
  else raise exception 'Invalid recurrence' using errcode='22023';end if;
 end loop;
end $$;

create function public.intrack_program_checklist(actor_role text, program_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if actor_role not in ('coordinator','adviser') then raise exception 'Staff access required' using errcode='42501';end if;
 perform intrack.authorized_actor(actor_role,program_id);
 return (select jsonb_build_object('programId',c.program_id,'revision',c.revision,'requirements',c.requirements,'attendancePolicy',c.attendance_policy) from intrack.program_checklists c where c.program_id=intrack_program_checklist.program_id);
end $$;

create function public.intrack_save_program_checklist(command_id uuid,actor_role text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt jsonb; config intrack.program_checklists%rowtype; settings jsonb; item jsonb;
begin
 if actor_role is distinct from 'coordinator' then raise exception 'Coordinator required' using errcode='42501';end if;
 actor:=intrack.authorized_actor('coordinator',(payload->>'programId')::uuid);
 receipt:=intrack.begin_command(actor,command_id,'save_program_checklist',payload);if receipt is not null then return receipt;end if;
 select * into config from intrack.program_checklists where program_id=(payload->>'programId')::uuid for update;
 if not found then raise exception 'Program checklist unavailable' using errcode='42501';end if;
 if config.revision is distinct from (payload->>'expectedRevision')::integer then raise exception 'Settings changed. Refresh before saving.' using errcode='40001';end if;
 if payload->>'action'='requirements' then
  perform intrack.validate_program_checklist(payload->'requirements');
  -- Existing variables cannot be removed by this editor.
  if exists(select 1 from jsonb_array_elements(config.requirements) previous where not exists(select 1 from jsonb_array_elements(payload->'requirements') replacement where replacement->>'code'=previous->>'code')) then raise exception 'Keep all existing requirement items' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(payload->'requirements') loop
   if item->>'templateVersionId' is not null and not exists(select 1 from intrack.template_versions where id=(item->>'templateVersionId')::uuid and program_id=config.program_id and status='published') then raise exception 'Published program template required' using errcode='42501';end if;
  end loop;
  update intrack.program_checklists set requirements=payload->'requirements',revision=revision+1,updated_by=actor,updated_at=now() where program_id=config.program_id;
 elsif payload->>'action'='attendance' then
  settings:=payload->'attendancePolicy';
  if jsonb_typeof(settings) is distinct from 'object' or (settings->>'confirmed')::boolean is distinct from true
   or coalesce((settings->>'dailyCapMinutes')::integer,0) not between 1 and 1440
   or coalesce((settings->>'maxSessionMinutes')::integer,0) not between 1 and 1440
   or coalesce((settings->>'maxAccuracyMeters')::numeric,0)<=0
   or coalesce((settings->>'maxCoordinateAgeSeconds')::integer,0) not between 1 and 300 then raise exception 'Confirmed attendance settings required' using errcode='22023';end if;
  update intrack.program_checklists set attendance_policy=settings,revision=revision+1,updated_by=actor,updated_at=now() where program_id=config.program_id;
 else raise exception 'Unsupported setting' using errcode='22023';end if;
 insert into intrack.program_checklist_history(program_id,revision,requirements,attendance_policy,updated_by)
 select program_id,revision,requirements,attendance_policy,updated_by from intrack.program_checklists where program_id=config.program_id;
 return intrack.finish_command(actor,command_id,'save_program_checklist',payload,jsonb_build_object('programId',config.program_id,'revision',config.revision+1),'program_checklist',config.program_id);
end $$;

create function public.intrack_create_ojt_class(command_id uuid,actor_role text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt jsonb; config intrack.program_checklists%rowtype; source intrack.policy_versions%rowtype;
 term intrack.academic_terms%rowtype; existing intrack.practicum_classes%rowtype; item jsonb; snapshot uuid; version integer; result jsonb; target uuid;
begin
 if actor_role is distinct from 'adviser' then raise exception 'The adviser creates the class' using errcode='42501';end if;
 target:=(payload->>'programId')::uuid;actor:=intrack.authorized_actor('adviser',target);
 receipt:=intrack.begin_command(actor,command_id,'create_ojt_class',payload);if receipt is not null then return receipt;end if;
 if coalesce(payload->>'section','') !~ '^[1-9][0-9]*-[1-9][0-9]*$' then raise exception 'Select a section' using errcode='22023';end if;
 select * into source from intrack.policy_versions where program_id=target and year_level=split_part(payload->>'section','-',1)::integer and semester=payload->>'semester' order by component,version limit 1;
 if not found then raise exception 'This program has no OJT component for the selected year and term' using errcode='22023';end if;
 perform public.intrack_create_academic_term(gen_random_uuid(),'adviser',payload);
 select * into term from intrack.academic_terms where academic_year=trim(payload->>'academicYear') and semester=payload->>'semester';
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class:'||target::text||':'||term.id::text||':'||(payload->>'section'),0));
 select * into existing from intrack.practicum_classes where program_id=target and term_id=term.id and section=payload->>'section';
 if found then
  if existing.adviser_id is distinct from actor then raise exception 'Class belongs to another adviser' using errcode='42501';end if;
  return intrack.finish_command(actor,command_id,'create_ojt_class',payload,jsonb_build_object('classId',existing.id),'practicum_class',existing.id);
 end if;
 select * into config from intrack.program_checklists where program_id=target for share;
 if not found then raise exception 'Program checklist unavailable' using errcode='42501';end if;
 perform intrack.validate_program_checklist(config.requirements);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('policy:'||target::text||':'||source.component::text,0));
 select coalesce(max(v.version),0)+1 into version from intrack.policy_versions v where v.program_id=target and v.component=source.component;
 insert into intrack.policy_versions(program_id,component,version,year_level,semester,required_minutes,attendance_policy)
 values(target,source.component,version,source.year_level,source.semester,source.required_minutes,config.attendance_policy||jsonb_build_object('source','program_checklist','checklistRevision',config.revision)) returning id into snapshot;
 for item in select value from jsonb_array_elements(config.requirements) loop
  insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,mandatory,allowed_submission_stages,template_version_id,recurrence)
  values(snapshot,item->>'code',item->>'title',item->>'stage',item->>'evidenceType',item->>'reviewer',(item->>'mandatory')::boolean,array(select jsonb_array_elements_text(item->'allowedStages')),(item->>'templateVersionId')::uuid,item->'recurrence');
 end loop;
 -- This freezes a class snapshot; it is not institutional attendance approval.
 update intrack.policy_versions set confirmed_by=actor,confirmed_at=now() where id=snapshot;
 result:=public.intrack_create_practicum_class(gen_random_uuid(),'adviser',jsonb_build_object('policyId',snapshot,'termId',term.id,'section',payload->>'section','reason','Class created using the saved program checklist'));
 return intrack.finish_command(actor,command_id,'create_ojt_class',payload,result,'practicum_class',(result->>'classId')::uuid);
end $$;

create function public.intrack_class_roster(actor_role text,class_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; class intrack.practicum_classes%rowtype;
begin
 if actor_role not in ('coordinator','adviser') then raise exception 'Staff access required' using errcode='42501';end if;
 select * into class from intrack.practicum_classes where id=class_id;
 if not found then raise exception 'Class unavailable' using errcode='42501';end if;
 actor:=intrack.authorized_actor(actor_role,class.program_id);
 if actor_role='adviser' and class.adviser_id is distinct from actor then raise exception 'Only your own class list is available' using errcode='42501';end if;
 return (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'studentId',p.id,'name',p.display_name,'studentNumber',coalesce(p.student_number,(select es.student_number from intrack.eligible_students es where es.invited_profile_id=p.id and es.program_id=e.program_id limit 1)),'email',(select es.email from intrack.eligible_students es where es.invited_profile_id=p.id and es.program_id=e.program_id limit 1),'section',class.section,'lifecycle',e.lifecycle,'outcome',e.outcome) order by p.display_name),'[]') from intrack.practicum_class_members cm join intrack.enrollments e on e.id=cm.enrollment_id join intrack.profiles p on p.id=e.student_id where cm.class_id=class.id);
end $$;
revoke all on function intrack.validate_program_checklist(jsonb) from public,anon,authenticated;
revoke all on function public.intrack_program_checklist(text,uuid),public.intrack_save_program_checklist(uuid,text,jsonb),public.intrack_create_ojt_class(uuid,text,jsonb),public.intrack_class_roster(text,uuid) from public,anon;
grant execute on function public.intrack_program_checklist(text,uuid),public.intrack_save_program_checklist(uuid,text,jsonb),public.intrack_create_ojt_class(uuid,text,jsonb),public.intrack_class_roster(text,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
