begin;
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
    'id',r.id,'requirementRevision',r.revision,'title',d.title,'code',d.code,'reviewer',d.reviewer,'evidenceType',d.evidence_type,
    'allowedStages',d.allowed_submission_stages,'dueAt',r.due_at,'waived',r.waived_at is not null,
    'enrollmentId',e.id,'enrollmentRevision',e.revision,'lifecycle',e.lifecycle,'outcome',e.outcome,
    'studentName',p.display_name,'programCode',pr.code,
    'submission',case when s.id is null then null else jsonb_build_object(
      'id',s.id,'version',s.version,'revision',s.revision,'status',s.status,'submittedAt',s.submitted_at,
      'documentId',s.document_id,'reviewStartedAt',s.review_started_at) end,
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

revoke all on function public.intrack_list_requirements(text) from public,anon,authenticated;
grant execute on function public.intrack_list_requirements(text) to authenticated;
commit;
