begin;
-- Preserve legacy unbound evaluation identities. New current versions are per
-- exact requirement occurrence, so multiple final-stage evaluation forms coexist.
drop index intrack.one_current_evaluation;
create unique index one_current_legacy_evaluation on intrack.evaluation_versions(enrollment_id,kind) where is_current and not (rubric_snapshot ? 'requirementId');
create unique index one_current_evaluation_occurrence on intrack.evaluation_versions(enrollment_id,(rubric_snapshot->>'requirementId')) where is_current and rubric_snapshot ? 'requirementId';
create or replace function public.intrack_evaluation_command(command_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<evaluation_command>>
declare e intrack.enrollments%rowtype;r intrack.enrollment_requirements%rowtype;v intrack.evaluation_versions%rowtype;rubric intrack.evaluation_templates%rowtype;criterion intrack.evaluation_criteria%rowtype;
 actor uuid;receipt jsonb;action text:=payload->>'action';id uuid;version integer;score jsonb;points integer;snapshot jsonb;decision text;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='submit' then 'student' else 'adviser' end);
 receipt:=intrack.begin_command(actor,command_id,'evaluation',payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Current active enrollment required' using errcode='40001';end if;
 if action='submit' then
  select * into r from intrack.enrollment_requirements where enrollment_requirements.id=(payload->>'requirementId')::uuid and enrollment_id=e.id;
  select * into rubric from intrack.evaluation_templates where evaluation_templates.id=(r.definition_snapshot->'recurrence'->>'rubricTemplateId')::uuid and policy_version_id=e.policy_version_id and published_at is not null;
  if r.id is null or rubric.id is null or r.definition_snapshot->>'evidence_type'<>'evaluation' or r.waived_at is not null or not (r.definition_snapshot->'allowed_submission_stages') ? e.lifecycle then raise exception 'Published scoped evaluation requirement and rubric required' using errcode='42501';end if;
  if coalesce(length(trim(payload->>'evaluatorName')),0) not between 1 and 240 or coalesce(length(trim(payload->>'evaluatorAffiliation')),0) not between 1 and 500 or (payload->>'evaluatedOn')::date is null or (payload->>'evaluatedOn')::date>(now() at time zone 'Asia/Manila')::date then raise exception 'Identified evaluator and historical date required' using errcode='22023';end if;
  if (r.definition_snapshot->'recurrence'->>'evaluationStartsOn') is null or (r.definition_snapshot->'recurrence'->>'evaluationEndsOn') is null or (payload->>'evaluatedOn')::date not between (r.definition_snapshot->'recurrence'->>'evaluationStartsOn')::date and (r.definition_snapshot->'recurrence'->>'evaluationEndsOn')::date then raise exception 'Confirmed evaluation window required' using errcode='22023';end if;
  if not exists(select 1 from intrack.documents where documents.id=(payload->>'documentId')::uuid and enrollment_id=e.id and requirement_id=r.id and uploaded_by=actor and status='attached') then raise exception 'Exact attached signed-evidence document required' using errcode='42501';end if;
  if jsonb_typeof(payload->'scores') is distinct from 'array' or jsonb_array_length(payload->'scores')<>(select count(*) from intrack.evaluation_criteria where template_id=rubric.id) then raise exception 'Exactly one score per criterion required' using errcode='22023';end if;
  select * into v from intrack.evaluation_versions where enrollment_id=e.id and kind=rubric.kind and is_current and rubric_snapshot->>'requirementId'=r.id::text for update;
  if v.id is not null and (v.status not in ('needs_revision','rejected','withdrawn') or (payload->>'expectedArtifactRevision')::integer is distinct from v.revision) then raise exception 'Resolve current evaluation first' using errcode='40001';end if;
  if v.id is not null then update intrack.evaluation_versions set is_current=false where evaluation_versions.id=v.id;end if;
  select coalesce(max(evaluation_versions.version),0)+1 into version from intrack.evaluation_versions where enrollment_id=e.id and kind=rubric.kind;
  select to_jsonb(rubric)||jsonb_build_object('requirementId',r.id,'criteria',jsonb_agg(to_jsonb(c) order by c.ordinal)) into snapshot from intrack.evaluation_criteria c where c.template_id=rubric.id;
  insert into intrack.evaluation_versions(enrollment_id,kind,version,template_id,rubric_snapshot,scores,evaluator_name,evaluator_affiliation,evaluated_on,created_by,document_id,status)
   values(e.id,rubric.kind,version,rubric.id,snapshot,payload->'scores',trim(payload->>'evaluatorName'),trim(payload->>'evaluatorAffiliation'),(payload->>'evaluatedOn')::date,actor,(payload->>'documentId')::uuid,'draft') returning evaluation_versions.id into id;
  for score in select value from jsonb_array_elements(payload->'scores') loop
   select * into criterion from intrack.evaluation_criteria where evaluation_criteria.id=(score->>'criterionId')::uuid and template_id=rubric.id;
   points:=(score->>'pointsHundredths')::integer;
   if criterion.id is null or points is null or points<0 or points>criterion.max_points*100 then raise exception 'Unknown, missing or out-of-range score' using errcode='22023';end if;
   insert into intrack.evaluation_scores(evaluation_id,criterion_id,template_id,max_points_snapshot,points) values(evaluation_command.id,criterion.id,rubric.id,criterion.max_points,points::numeric/100);
  end loop;
  select jsonb_build_object('rubric',snapshot,'evidenceDocumentId',payload->>'documentId','evaluator',payload->>'evaluatorName','affiliation',payload->>'evaluatorAffiliation','evaluatedOn',payload->>'evaluatedOn','scores',payload->'scores','earnedHundredths',sum(s.points*100),'possibleHundredths',sum(s.max_points_snapshot*100)) into snapshot from intrack.evaluation_scores s where s.evaluation_id=evaluation_command.id;
  update intrack.evaluation_versions set content_hash=intrack.json_hash(snapshot),status='submitted',submitted_at=now() where evaluation_versions.id=evaluation_command.id;
 elsif action in ('approve','request_revision','reject') then
  select * into v from intrack.evaluation_versions where evaluation_versions.id=(payload->>'artifactId')::uuid and enrollment_id=e.id for update;id:=v.id;
  if v.id is null or not v.is_current or v.status not in ('submitted','under_review') or actor=e.student_id or (payload->>'expectedArtifactRevision')::integer is distinct from v.revision then raise exception 'Current other-user evaluation required' using errcode='40001';end if;
  if coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 or (action='approve' and ((payload->>'signedEvidenceVerified')::boolean is distinct from true or (payload->>'scoresVerified')::boolean is distinct from true)) then raise exception 'Evidence/score verification and factual review note required' using errcode='22023';end if;
  if action='approve' and not exists(select 1 from intrack.documents where documents.id=v.document_id and status='attached') then raise exception 'Evidence is unavailable' using errcode='40001';end if;
  decision:=case action when 'approve' then 'approved' when 'reject' then 'rejected' else 'needs_revision' end;
  update intrack.evaluation_versions set status=decision,reviewed_by=actor,reviewed_at=now(),revision=revision+1 where evaluation_versions.id=v.id;
  insert into intrack.academic_review_events(enrollment_id,evaluation_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision,verification_snapshot) values(e.id,v.id,actor,'adviser',decision,trim(payload->>'reason'),command_id,v.revision+1,jsonb_build_object('signedEvidenceVerified',payload->'signedEvidenceVerified','scoresVerified',payload->'scoresVerified','contentHash',v.content_hash));
 else raise exception 'Unsupported evaluation action' using errcode='22023';end if;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'evaluation',payload,jsonb_build_object('id',id,'enrollmentRevision',e.revision+1),'evaluation',id,e.id,e.revision,e.revision+1);
end $$;

create or replace function public.intrack_publish_policy(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<publication>>
declare source intrack.policy_versions%rowtype; actor uuid; receipt jsonb; id uuid; version integer; item jsonb; recurrence jsonb; occurrence jsonb; settings jsonb; source_rubric intrack.evaluation_templates%rowtype; rubric_id uuid; rubric_copies jsonb:='{}'::jsonb;
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
    if item->>'evidenceType'='evaluation' then
 select * into source_rubric from intrack.evaluation_templates where evaluation_templates.id=(recurrence->>'rubricTemplateId')::uuid and policy_version_id=source.id and published_at is not null;
 if source_rubric.id is null or item->>'reviewer'<>'adviser' then raise exception 'Published source rubric and supported review plan required' using errcode='22023';end if;
 if rubric_copies ? source_rubric.id::text then rubric_id:=(rubric_copies->>source_rubric.id::text)::uuid;
 else
 insert into intrack.evaluation_templates(policy_version_id,kind,title,version,calculation_rule) values(publication.id,source_rubric.kind,source_rubric.title,(select coalesce(max(t.version),0)+1 from intrack.evaluation_templates t where t.policy_version_id=publication.id and t.kind=source_rubric.kind),source_rubric.calculation_rule) returning evaluation_templates.id into rubric_id;
 insert into intrack.evaluation_criteria(template_id,label,ordinal,max_points) select rubric_id,label,ordinal,max_points from intrack.evaluation_criteria where template_id=source_rubric.id;
 update intrack.evaluation_templates set published_at=now() where evaluation_templates.id=rubric_id;
 rubric_copies:=rubric_copies||jsonb_build_object(source_rubric.id::text,rubric_id);
 end if;
 recurrence:=recurrence||jsonb_build_object('rubricTemplateId',rubric_id);
end if;
    insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,mandatory,allowed_submission_stages,template_version_id,recurrence)
      values(id,trim(item->>'code'),trim(item->>'title'),item->>'stage',item->>'evidenceType',item->>'reviewer',coalesce((item->>'mandatory')::boolean,true),
        array(select jsonb_array_elements_text(item->'allowedStages')),(item->>'templateVersionId')::uuid,recurrence);
  end loop;
  update intrack.policy_versions set confirmed_by=actor,confirmed_at=now() where policy_versions.id=publication.id;
  return intrack.finish_command(actor,command_id,'publish_policy',payload,jsonb_build_object('policyId',id,'version',version),'policy',id);
end $$;
revoke all on function public.intrack_publish_policy(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_publish_policy(uuid,jsonb) to authenticated;



commit;