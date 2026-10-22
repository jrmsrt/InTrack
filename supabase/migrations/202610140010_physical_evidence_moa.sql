begin;
create function public.intrack_submit_physical_requirement(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; r intrack.enrollment_requirements%rowtype; d intrack.requirement_definitions%rowtype;
  s intrack.submission_versions%rowtype; actor uuid; receipt jsonb; id uuid; next_version integer; recipient uuid;
begin
  select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,'student');receipt:=intrack.begin_command(actor,command_id,'submit_physical',payload);if receipt is not null then return receipt;end if;
  select * into r from intrack.enrollment_requirements where enrollment_id=e.id and enrollment_requirements.id=(payload->>'requirementId')::uuid for update;
  if not found or r.waived_at is not null then raise exception 'Requirement unavailable' using errcode='42501';end if;
  select * into d from intrack.requirement_definitions where requirement_definitions.id=r.definition_id and policy_version_id=e.policy_version_id;
  if not found or d.evidence_type<>'staff_verification' or not exists(select 1 from intrack.policy_versions where policy_versions.id=e.policy_version_id and confirmed_at is not null) then raise exception 'Published physical requirement required' using errcode='42501';end if;
  select * into s from intrack.submission_versions where requirement_id=r.id and is_current for update;
  if e.outcome<>'active' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or (payload->>'expectedSubmissionRevision')::integer is distinct from s.revision then raise exception 'Closed or stale records' using errcode='40001';end if;
  if not e.lifecycle=any(d.allowed_submission_stages) or (s.id is not null and s.status not in ('needs_revision','rejected','withdrawn')) then raise exception 'Physical submission not available' using errcode='40001';end if;
  if coalesce(length(trim(payload->>'note')),0) not between 1 and 4000 then raise exception 'Describe the physical evidence request' using errcode='22023';end if;
  next_version:=coalesce(s.version,0)+1;
  if s.id is not null then update intrack.submission_versions set is_current=false where submission_versions.id=s.id;end if;
  insert into intrack.submission_versions(enrollment_id,requirement_id,version,submitted_by,evidence_note,status,submitted_at)
    values(e.id,r.id,next_version,actor,trim(payload->>'note'),'submitted',now()) returning submission_versions.id into id;
  update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
  for recipient in select distinct m.profile_id from intrack.memberships m where m.program_id=e.program_id and m.active
    and ((m.role='adviser' and d.reviewer in('adviser','both') and exists(select 1 from intrack.adviser_assignments a where a.enrollment_id=e.id and a.adviser_id=m.profile_id and a.ends_at is null and a.starts_at<=now())) or (m.role='coordinator' and d.reviewer='coordinator')) loop
    insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(recipient,e.id,command_id::text,jsonb_build_object('kind','physical_evidence_request','submissionId',id));
  end loop;
  return intrack.finish_command(actor,command_id,'submit_physical',payload,jsonb_build_object('submissionId',id,'version',next_version,'status','submitted','enrollmentRevision',e.revision+1),'requirement',r.id,e.id,s.revision,0);
end $$;
revoke all on function public.intrack_submit_physical_requirement(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_submit_physical_requirement(uuid,jsonb) to authenticated;

create function public.intrack_verify_physical_requirement(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; s intrack.submission_versions%rowtype; actor uuid; receipt jsonb; id uuid;
begin
  select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  if coalesce(payload->>'role','') not in ('adviser','coordinator') then raise exception 'Staff role required' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,payload->>'role');receipt:=intrack.begin_command(actor,command_id,'verify_physical',payload);if receipt is not null then return receipt;end if;
  select * into s from intrack.submission_versions where submission_versions.id=(payload->>'submissionId')::uuid and enrollment_id=e.id and is_current for update;
  if not found or actor=e.student_id or actor=s.submitted_by then raise exception 'Other student current submission required' using errcode='42501';end if;
  if e.outcome<>'active' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or (payload->>'expectedSubmissionRevision')::integer is distinct from s.revision then raise exception 'Closed or stale record' using errcode='40001';end if;
  if s.status not in ('submitted','under_review') or not exists(select 1 from intrack.enrollment_requirements r join intrack.requirement_definitions d on d.id=r.definition_id where r.id=s.requirement_id and d.evidence_type='staff_verification' and d.policy_version_id=e.policy_version_id) then raise exception 'Submitted physical evidence required' using errcode='42501';end if;
  if coalesce(length(trim(payload->>'note')),0) not between 1 and 4000 then raise exception 'Actual observation note required' using errcode='22023';end if;
  insert into intrack.staff_verification_events(enrollment_id,submission_id,verified_by,note,command_id,submission_revision)
    values(e.id,s.id,actor,trim(payload->>'note'),command_id,s.revision) returning staff_verification_events.id into id;
  update intrack.submission_versions set review_started_at=coalesce(review_started_at,now()),revision=revision+1 where submission_versions.id=s.id;
  update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
  return intrack.finish_command(actor,command_id,'verify_physical',payload,jsonb_build_object('verificationId',id,'enrollmentRevision',e.revision+1,'submissionRevision',s.revision+1),'submission',s.id,e.id,s.revision,s.revision+1);
end $$;
revoke all on function public.intrack_verify_physical_requirement(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_verify_physical_requirement(uuid,jsonb) to authenticated;

create function public.intrack_route_moa(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; s intrack.submission_versions%rowtype; previous intrack.moa_routing_events%rowtype;
  actor uuid; receipt jsonb; id uuid; target text; note text; next_status text;
begin
  select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,'coordinator');receipt:=intrack.begin_command(actor,command_id,'route_moa',payload);if receipt is not null then return receipt;end if;
  if e.student_id=actor then raise exception 'Self routing prohibited' using errcode='42501';end if;
  if e.outcome<>'active' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Closed or stale enrollment' using errcode='40001';end if;
  target:=payload->>'status';note:=trim(payload->>'evidenceNote');
  if coalesce(target,'') not in ('NO MOA','FOR COMPANY REVIEW','IN-PROCESS FOR REVISION','IN-PROCESS FOR REVIEW OF ULCO','FOR NOTARIZATION','SIGNED AND NOTARIZED','SAS COPY SUBMITTED') or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Supported MOA status and reason required' using errcode='22023';end if;
  if target<>'NO MOA' then
    select * into s from intrack.submission_versions where submission_versions.id=(payload->>'submissionId')::uuid and enrollment_id=e.id and is_current for update;
    if not found or s.status in ('draft','withdrawn','rejected','superseded') or not exists(
      select 1 from intrack.enrollment_requirements r join intrack.requirement_definitions d on d.id=r.definition_id
        join intrack.documents doc on doc.id=s.document_id where r.id=s.requirement_id and d.evidence_type='moa' and d.policy_version_id=e.policy_version_id and doc.status='attached' and doc.sha256 is not null and doc.validated_at is not null
    ) then raise exception 'Current validated MOA evidence required' using errcode='42501';end if;
  elsif payload->>'submissionId' is not null then raise exception 'NO MOA does not attach a file' using errcode='22023';end if;
  select * into previous from intrack.moa_routing_events where enrollment_id=e.id order by enrollment_revision desc limit 1;
  if target in ('SIGNED AND NOTARIZED','SAS COPY SUBMITTED') and coalesce(length(note),0) not between 1 and 4000 then raise exception 'Factual notarization/SAS submission evidence required' using errcode='22023';end if;
  if target='SAS COPY SUBMITTED' and (previous.id is null or previous.status not in ('SIGNED AND NOTARIZED','SAS COPY SUBMITTED') or previous.submission_id is distinct from s.id) then raise exception 'SAS submission requires this same signed and notarized copy' using errcode='40001';end if;
  insert into intrack.moa_routing_events(enrollment_id,submission_id,actor_id,status,remarks,evidence_note,command_id,enrollment_revision)
    values(e.id,s.id,actor,target,trim(payload->>'reason'),note,command_id,e.revision+1) returning moa_routing_events.id into id;
  if s.id is not null then
    next_status:=case when target in ('SIGNED AND NOTARIZED','SAS COPY SUBMITTED') then 'approved' when target='IN-PROCESS FOR REVISION' then 'needs_revision' else 'under_review' end;
    update intrack.submission_versions set status=next_status,review_started_at=coalesce(review_started_at,now()),revision=revision+1 where submission_versions.id=s.id;
  end if;
  update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
  insert into intrack.notifications(recipient_id,enrollment_id,event_key,content) values(e.student_id,e.id,command_id::text,jsonb_build_object('kind','moa_status','status',target));
  return intrack.finish_command(actor,command_id,'route_moa',payload,jsonb_build_object('routingEventId',id,'status',target,'revision',e.revision+1),'enrollment',e.id,e.id,e.revision,e.revision+1);
end $$;
revoke all on function public.intrack_route_moa(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_route_moa(uuid,jsonb) to authenticated;
commit;
