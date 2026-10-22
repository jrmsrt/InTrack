begin;
create function public.intrack_revoke_approval(command_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<revoke_approval>>
declare e intrack.enrollments%rowtype;s intrack.submission_versions%rowtype;j intrack.journal_versions%rowtype;v intrack.evaluation_versions%rowtype;t intrack.task_versions%rowtype;p intrack.portfolio_versions%rowtype;c intrack.clearance_events%rowtype;
 actor uuid;receipt jsonb;kind text:=payload->>'kind';id uuid:=(payload->>'artifactId')::uuid;reason text:=trim(payload->>'reason');session intrack.attendance_sessions%rowtype;before_clearance text;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,'coordinator');receipt:=intrack.begin_command(actor,command_id,'revoke_approval',payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or e.lifecycle='completed' or actor=e.student_id or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or coalesce(length(reason),0) not between 1 and 1000 then raise exception 'Reopen completed work first; current other-user enrollment and reason required' using errcode='40001';end if;
 if kind='requirement' then
  select * into s from intrack.submission_versions where submission_versions.id=revoke_approval.id and enrollment_id=e.id for update;
  if s.id is null or not s.is_current or s.status<>'approved' or s.submitted_by=actor or (payload->>'expectedArtifactRevision')::integer is distinct from s.revision then raise exception 'Current approved other-user requirement required' using errcode='40001';end if;
  update intrack.submission_versions set status='needs_revision',revision=revision+1 where submission_versions.id=s.id;
  insert into intrack.review_events(enrollment_id,submission_id,reviewer_id,reviewer_role,decision,remarks,command_id,submission_revision) values(e.id,s.id,actor,'coordinator','revoked',reason,command_id,s.revision+1);
 elsif kind='task' then
  select * into t from intrack.task_versions where task_versions.id=revoke_approval.id and enrollment_id=e.id for update;
  if t.id is null or not t.is_current or t.status<>'approved' or t.created_by=actor or (payload->>'expectedArtifactRevision')::integer is distinct from t.revision then raise exception 'Current approved other-user task required' using errcode='40001';end if;
  update intrack.task_versions set status='needs_revision',revision=revision+1 where task_versions.id=t.id;
  insert into intrack.academic_review_events(enrollment_id,task_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision) values(e.id,t.id,actor,'coordinator','revoked',reason,command_id,t.revision+1);
  for j in select journal.* from intrack.journal_versions journal join intrack.journal_tasks source on source.journal_id=journal.id where source.task_version_id=t.id and journal.is_current and journal.status in ('submitted','under_review','approved') for update of journal loop
   update intrack.journal_versions set status='needs_revision',reviewed_by=null,reviewed_at=null,revision=revision+1 where journal_versions.id=j.id;
   insert into intrack.academic_review_events(enrollment_id,journal_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision) values(e.id,j.id,actor,'coordinator','invalidated',reason,command_id,j.revision+1);
  end loop;
 elsif kind='journal' then
  select * into j from intrack.journal_versions where journal_versions.id=revoke_approval.id and enrollment_id=e.id for update;
  if j.id is null or not j.is_current or j.status<>'approved' or j.created_by=actor or (payload->>'expectedArtifactRevision')::integer is distinct from j.revision then raise exception 'Current approved other-user journal required' using errcode='40001';end if;
  update intrack.journal_versions set status='needs_revision',reviewed_by=null,reviewed_at=null,revision=revision+1 where journal_versions.id=j.id;
  insert into intrack.academic_review_events(enrollment_id,journal_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision) values(e.id,j.id,actor,'coordinator','revoked',reason,command_id,j.revision+1);
 elsif kind='evaluation' then
  select * into v from intrack.evaluation_versions where evaluation_versions.id=revoke_approval.id and enrollment_id=e.id for update;
  if v.id is null or not v.is_current or v.status<>'approved' or v.created_by=actor or (payload->>'expectedArtifactRevision')::integer is distinct from v.revision then raise exception 'Current approved other-user evaluation required' using errcode='40001';end if;
  update intrack.evaluation_versions set status='needs_revision',reviewed_by=null,reviewed_at=null,revision=revision+1 where evaluation_versions.id=v.id;
  insert into intrack.academic_review_events(enrollment_id,evaluation_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision) values(e.id,v.id,actor,'coordinator','revoked',reason,command_id,v.revision+1);
 elsif kind='dtr' then
  if not exists(select 1 from intrack.dtr_versions where dtr_versions.id=revoke_approval.id and enrollment_id=e.id and status='approved' and revision=(payload->>'expectedArtifactRevision')::integer) then raise exception 'Current approved DTR required' using errcode='40001';end if;
  perform intrack.invalidate_attendance(e.id,actor,command_id,reason);
 elsif kind='portfolio' then
  select * into p from intrack.portfolio_versions where portfolio_versions.id=revoke_approval.id and enrollment_id=e.id for update;
  if p.id is null or not p.is_current or p.status<>'approved' or p.created_by=actor or (payload->>'expectedArtifactRevision')::integer is distinct from p.revision then raise exception 'Current approved other-user portfolio required' using errcode='40001';end if;
  insert into intrack.academic_review_events(enrollment_id,portfolio_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision) values(e.id,p.id,actor,'coordinator','revoked',reason,command_id,p.revision+1);
 else raise exception 'Supported approved artifact required' using errcode='22023';end if;
 for p in select * from intrack.portfolio_versions where enrollment_id=e.id and is_current and status in ('submitted','under_review','approved') for update loop
  update intrack.portfolio_versions set status='needs_revision',adviser_reviewed_by=null,adviser_approved_at=null,coordinator_reviewed_by=null,coordinator_approved_at=null,revision=revision+1 where portfolio_versions.id=p.id;
  if kind<>'portfolio' then insert into intrack.academic_review_events(enrollment_id,portfolio_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision) values(e.id,p.id,actor,'coordinator','invalidated',reason,command_id,p.revision+1);end if;
 end loop;
 -- Any withdrawal of evidence in training pauses authority conservatively.
 before_clearance:=intrack.current_clearance(e.id);
 if before_clearance='active' then
  select * into c from intrack.clearance_events where enrollment_id=e.id order by enrollment_revision desc limit 1;
  if c.id is null then raise exception 'Recorded clearance basis missing' using errcode='40001';end if;
  insert into intrack.clearance_events(enrollment_id,placement_id,moa_submission_id,status,actor_id,reason,command_id,enrollment_revision,basis_snapshot) values(e.id,c.placement_id,c.moa_submission_id,'suspended',actor,reason,command_id,e.revision+1,c.basis_snapshot);
  insert into intrack.enrollment_events(enrollment_id,actor_id,action,reason,command_id,before_revision,after_revision,from_stage,to_stage,from_outcome,to_outcome,from_clearance,to_clearance,basis_snapshot) values(e.id,actor,'suspend_clearance',reason,command_id,e.revision,e.revision+1,e.lifecycle,e.lifecycle,e.outcome,e.outcome,'active','suspended',c.basis_snapshot);
  for session in select * from intrack.attendance_sessions where enrollment_id=e.id and clock_out_at is null and status<>'void' for update loop
   update intrack.attendance_sessions set status='disputed',revision=revision+1 where attendance_sessions.id=session.id returning * into session;
   insert into intrack.attendance_session_revisions(enrollment_id,session_id,revision,origin,actor_id,command_id,reason,frozen_snapshot) values(e.id,session.id,session.revision,'review',actor,command_id,reason,to_jsonb(session));
  end loop;
 end if;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'revoke_approval',payload,jsonb_build_object('artifactId',id,'kind',kind,'enrollmentRevision',e.revision+1),'approval',id,e.id,e.revision,e.revision+1);
end $$;
revoke all on function public.intrack_revoke_approval(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_revoke_approval(uuid,jsonb) to authenticated;
commit;
