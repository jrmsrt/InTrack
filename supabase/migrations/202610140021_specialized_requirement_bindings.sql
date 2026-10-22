begin;
create table intrack.specialized_requirement_bindings(
 id uuid primary key default gen_random_uuid(),enrollment_id uuid not null references intrack.enrollments(id),requirement_id uuid not null,
 dtr_id uuid,journal_id uuid,evaluation_id uuid,portfolio_id uuid,source_revision integer not null check(source_revision>=0),
 bound_by uuid not null references intrack.profiles(id),enrollment_revision integer not null,created_at timestamptz not null default now(),
 check(num_nonnulls(dtr_id,journal_id,evaluation_id,portfolio_id)=1),
 foreign key(requirement_id,enrollment_id) references intrack.enrollment_requirements(id,enrollment_id),
 foreign key(dtr_id,enrollment_id) references intrack.dtr_versions(id,enrollment_id),
 foreign key(journal_id,enrollment_id) references intrack.journal_versions(id,enrollment_id),
 foreign key(evaluation_id,enrollment_id) references intrack.evaluation_versions(id,enrollment_id),
 foreign key(portfolio_id,enrollment_id) references intrack.portfolio_versions(id,enrollment_id),
 unique(requirement_id,enrollment_revision));
alter table intrack.specialized_requirement_bindings enable row level security;
revoke all on intrack.specialized_requirement_bindings from public,anon,authenticated;
create trigger preserve_specialized_binding before update or delete on intrack.specialized_requirement_bindings for each row execute function intrack.guard_append_only();
create function intrack.specialized_requirement_ready(target uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce((select case
 when b.dtr_id is not null then exists(select 1 from intrack.dtr_versions d where d.id=b.dtr_id and d.status='approved' and d.revision=b.source_revision)
 when b.journal_id is not null then exists(select 1 from intrack.journal_versions j where j.id=b.journal_id and j.is_current and j.status='approved' and j.revision=b.source_revision)
 when b.evaluation_id is not null then exists(select 1 from intrack.evaluation_versions v where v.id=b.evaluation_id and v.is_current and v.status='approved' and v.revision=b.source_revision)
 else exists(select 1 from intrack.portfolio_versions p where p.id=b.portfolio_id and p.is_current and p.status='approved' and p.revision=b.source_revision) end
 from intrack.specialized_requirement_bindings b where b.requirement_id=target order by b.enrollment_revision desc limit 1),false)
$$;
create function public.intrack_bind_specialized_requirement(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<binding_command>>
declare e intrack.enrollments%rowtype;r intrack.enrollment_requirements%rowtype;actor uuid;receipt jsonb;kind text;id uuid;version integer;binding uuid;source jsonb;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,'student');receipt:=intrack.begin_command(actor,command_id,'bind_specialized',payload);if receipt is not null then return receipt;end if;
 select * into r from intrack.enrollment_requirements where enrollment_requirements.id=(payload->>'requirementId')::uuid and enrollment_id=e.id for update;
 if e.outcome<>'active' or r.id is null or r.waived_at is not null or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or (payload->>'expectedRequirementRevision')::integer is distinct from r.revision or not (r.definition_snapshot->'allowed_submission_stages') ? e.lifecycle then raise exception 'Current unresolved requirement and allowed stage required' using errcode='40001';end if;
 kind:=r.definition_snapshot->>'evidence_type';id:=(payload->>'artifactId')::uuid;
 if kind='dtr' then select to_jsonb(d) into source from intrack.dtr_versions d where d.id=binding_command.id and d.enrollment_id=e.id and d.period_key=r.instance_key;
 elsif kind='journal' then select to_jsonb(j) into source from intrack.journal_versions j where j.id=binding_command.id and j.enrollment_id=e.id and j.is_current and j.period_key=r.id::text;
 elsif kind='evaluation' then select to_jsonb(v) into source from intrack.evaluation_versions v where v.id=binding_command.id and v.enrollment_id=e.id and v.is_current and v.rubric_snapshot->>'requirementId'=r.id::text;
 elsif kind='portfolio' then select to_jsonb(p) into source from intrack.portfolio_versions p where p.id=binding_command.id and p.enrollment_id=e.id and p.is_current;
 else raise exception 'Specialized requirement required' using errcode='22023';end if;
 if source is null or source->>'status'<>'approved' or (kind<>'portfolio' and r.definition_snapshot->>'reviewer'<>'adviser') or (kind='portfolio' and r.definition_snapshot->>'reviewer'<>'both') then raise exception 'Approved exact artifact and matching complete review plan required' using errcode='42501';end if;
 version:=(source->>'revision')::integer;
 insert into intrack.specialized_requirement_bindings(enrollment_id,requirement_id,dtr_id,journal_id,evaluation_id,portfolio_id,source_revision,bound_by,enrollment_revision)
 values(e.id,r.id,case when kind='dtr' then id end,case when kind='journal' then id end,case when kind='evaluation' then id end,case when kind='portfolio' then id end,version,actor,e.revision+1) returning specialized_requirement_bindings.id into binding;
 update intrack.enrollment_requirements set revision=revision+1 where enrollment_requirements.id=r.id;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'bind_specialized',payload,jsonb_build_object('bindingId',binding,'enrollmentRevision',e.revision+1),'requirement',r.id,e.id,e.revision,e.revision+1);
end $$;
create or replace function intrack.requirement_gate(target uuid,stage text,accepted_moa uuid default null)
returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('ready',count(*)>0 and coalesce(bool_and(coalesce(
 (r.waived_at is not null and r.waiver_actor is not null and length(trim(r.waiver_reason))>0)
 or (d.evidence_type='moa' and accepted_moa is not null and exists(select 1 from intrack.submission_versions ms where ms.id=accepted_moa and ms.requirement_id=r.id))
 or (d.evidence_type in ('file','staff_verification') and s.status='approved')
 or (d.evidence_type in ('dtr','journal','evaluation','portfolio') and intrack.specialized_requirement_ready(r.id)),false)),false),
 'basis',coalesce(jsonb_agg(jsonb_build_object('requirementId',r.id,'submissionId',case when d.evidence_type='moa' then accepted_moa else s.id end,'bindingId',
 (select b.id from intrack.specialized_requirement_bindings b where b.requirement_id=r.id order by b.enrollment_revision desc limit 1),'waiverActor',r.waiver_actor,'waiverReason',r.waiver_reason) order by r.id),'[]'))
 from intrack.enrollment_requirements r join intrack.requirement_definitions d on d.id=r.definition_id left join intrack.submission_versions s on s.requirement_id=r.id and s.is_current
 where r.enrollment_id=target and d.stage=requirement_gate.stage and d.mandatory
$$;
revoke all on function intrack.specialized_requirement_ready(uuid),intrack.requirement_gate(uuid,text,uuid) from public,anon,authenticated;
revoke all on function public.intrack_bind_specialized_requirement(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_bind_specialized_requirement(uuid,jsonb) to authenticated;
commit;
