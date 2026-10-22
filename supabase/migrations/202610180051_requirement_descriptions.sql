begin;
alter table intrack.requirement_definitions add column description text not null default '' check(length(description)<=2000);
create or replace function intrack.validate_program_checklist(items jsonb)
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
  if (item ? 'description' and jsonb_typeof(item->'description') is distinct from 'string') or length(coalesce(item->>'description',''))>2000 then raise exception 'Requirement description must be text of at most 2000 characters' using errcode='22023';end if;
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
create or replace function public.intrack_save_program_checklist(command_id uuid,actor_role text,payload jsonb)
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
   if not exists(select 1 from jsonb_array_elements(config.requirements) old where old->>'code'=item->>'code') and coalesce(length(trim(item->>'description')),0)=0 then raise exception 'A description is required for every new requirement' using errcode='22023';end if;
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
create or replace function public.intrack_create_ojt_class(command_id uuid,actor_role text,payload jsonb)
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
  insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,mandatory,allowed_submission_stages,template_version_id,recurrence,description)
  values(snapshot,item->>'code',item->>'title',item->>'stage',item->>'evidenceType',item->>'reviewer',(item->>'mandatory')::boolean,array(select jsonb_array_elements_text(item->'allowedStages')),(item->>'templateVersionId')::uuid,item->'recurrence',coalesce(item->>'description',''));
 end loop;
 -- This freezes a class snapshot; it is not institutional attendance approval.
 update intrack.policy_versions set confirmed_by=actor,confirmed_at=now() where id=snapshot;
 result:=public.intrack_create_practicum_class(gen_random_uuid(),'adviser',jsonb_build_object('policyId',snapshot,'termId',term.id,'section',payload->>'section','reason','Class created using the saved program checklist'));
 return intrack.finish_command(actor,command_id,'create_ojt_class',payload,result,'practicum_class',(result->>'classId')::uuid);
end $$;
create or replace function public.intrack_list_requirements(actor_role text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare identity jsonb; actor uuid; result jsonb;
begin
  identity:=public.intrack_get_my_identity();
  if identity->>'state'<>'ready' or not ((identity->'usableRoles') ? actor_role) then
    raise exception 'Ready identity required' using errcode='42501';
  end if;
  actor:=(identity->'profile'->>'id')::uuid;
  select coalesce(jsonb_agg(jsonb_build_object(
    'stage',d.stage,'instanceKey',r.instance_key,
    'id',r.id,'requirementRevision',r.revision,'title',d.title,'description',coalesce(r.definition_snapshot->>'description',d.description,''),'code',d.code,'reviewer',d.reviewer,'evidenceType',d.evidence_type,
    'allowedStages',d.allowed_submission_stages,'dueAt',r.due_at,'waived',r.waived_at is not null,
    'enrollmentId',e.id,'enrollmentRevision',e.revision,'lifecycle',e.lifecycle,'outcome',e.outcome,
    'studentName',p.display_name,'programCode',pr.code,
    'submission',case when s.id is null then null else jsonb_build_object(
      'id',s.id,'version',s.version,'revision',s.revision,'status',s.status,'submittedAt',s.submitted_at,
      'documentId',s.document_id,'documentName',(select doc.original_name from intrack.documents doc where doc.id=s.document_id),'mimeType',(select doc.mime_type from intrack.documents doc where doc.id=s.document_id),'reviewStartedAt',s.review_started_at) end,
    'history',coalesce((select jsonb_agg(jsonb_build_object('id',h.id,'version',h.version,'status',h.status,
      'submittedAt',h.submitted_at,'documentId',h.document_id,'current',h.is_current,
      'verifications',coalesce((select jsonb_agg(jsonb_build_object('note',v.note,'verifiedAt',v.verified_at,'verifiedBy',v.verified_by) order by v.verified_at,v.id) from intrack.staff_verification_events v where v.submission_id=h.id),'[]'::jsonb),
      'reviews',coalesce((select jsonb_agg(jsonb_build_object('role',v.reviewer_role,'decision',v.decision,
        'remarks',v.remarks,'at',v.created_at) order by v.created_at,v.id) from intrack.review_events v where v.submission_id=h.id),'[]'::jsonb)
    ) order by h.version desc) from intrack.submission_versions h where h.requirement_id=r.id),'[]'::jsonb)
  ) order by p.display_name,d.title,r.id),'[]'::jsonb) into result
  from intrack.enrollment_requirements r join intrack.enrollments e on e.id=r.enrollment_id
  join intrack.requirement_definitions d on d.id=r.definition_id and d.policy_version_id=e.policy_version_id
  join intrack.policy_versions policy on policy.id=e.policy_version_id and policy.confirmed_at is not null
  join intrack.profiles p on p.id=e.student_id join intrack.programs pr on pr.id=e.program_id
  left join intrack.submission_versions s on s.requirement_id=r.id and s.is_current
  where exists(select 1 from intrack.memberships m where m.profile_id=actor and m.program_id=e.program_id and m.role=actor_role and m.active)
    and (actor_role='coordinator' or (actor_role='student' and e.student_id=actor)
      or (actor_role='adviser' and exists(select 1 from intrack.adviser_assignments a where a.enrollment_id=e.id and a.adviser_id=actor and a.ends_at is null and a.starts_at<=now())));
  return result;
end $$;
notify pgrst,'reload schema';
commit;
