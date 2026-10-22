-- Intake publication configures document collection only. Deployment still requires confirmed attendance settings.
begin;
create function public.intrack_publish_practicum_policy(command_id uuid, payload jsonb)
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
  settings:=case when payload->>'mode'='intake' then jsonb_build_object('confirmed',false,'intakeOnly',true) else payload->'attendancePolicy' end;
  if coalesce(payload->>'mode','') not in ('intake','full') then raise exception 'Choose intake or full policy configuration' using errcode='22023';end if;
  if payload->>'mode'='full' and (jsonb_typeof(settings) is distinct from 'object' or (settings->>'confirmed')::boolean is distinct from true
    or coalesce((settings->>'dailyCapMinutes')::integer,0) not between 1 and 1440
    or coalesce((settings->>'maxSessionMinutes')::integer,0) not between 1 and 1440
    or coalesce((settings->>'maxAccuracyMeters')::numeric,0)<=0
    or coalesce((settings->>'maxCoordinateAgeSeconds')::integer,0) not between 1 and 300) then
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
revoke all on function public.intrack_publish_practicum_policy(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_publish_practicum_policy(uuid,jsonb) to authenticated;

commit;
