begin;
create or replace function public.intrack_list_enrollments(actor_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
  actor:=intrack.authorized_actor(actor_role);
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'studentId',e.student_id,'studentName',p.display_name,
    'programId',e.program_id,'programCode',program.code,'policyVersionId',e.policy_version_id,'component',e.component,
    'termId',e.term_id,'lifecycle',e.lifecycle,'outcome',e.outcome,'revision',e.revision,
    'requiredMinutes',e.required_minutes,'creditedMinutes',coalesce(credit.minutes,0),'remainingMinutes',greatest(0,e.required_minutes-coalesce(credit.minutes,0)),
    'adviserId',a.adviser_id,'clearance',case when e.outcome<>'active' then 'revoked' else coalesce(life.to_clearance,c.status,'not_issued') end,'clearanceBasis',c.basis_snapshot,
    'moaStatus',coalesce(m.status,'NO MOA'),'moaVersionId',m.submission_id,
    'openSessions',(select count(*) from intrack.attendance_sessions s where s.enrollment_id=e.id and s.clock_out_at is null and s.status<>'void')
  ) order by e.created_at desc,e.id),'[]'::jsonb) into result
  from intrack.enrollments e join intrack.profiles p on p.id=e.student_id join intrack.programs program on program.id=e.program_id
  left join intrack.adviser_assignments a on a.enrollment_id=e.id and a.ends_at is null and a.starts_at<=now()
  left join lateral(select sum(h.minutes)::integer minutes from intrack.hour_credits h where h.enrollment_id=e.id and h.invalidated_at is null) credit on true
  left join lateral(select * from intrack.clearance_events c where c.enrollment_id=e.id order by c.enrollment_revision desc,c.created_at desc,c.id desc limit 1)c on true
  left join lateral(select * from intrack.moa_routing_events m where m.enrollment_id=e.id order by m.enrollment_revision desc,m.created_at desc,m.id desc limit 1)m on true
  left join lateral(select to_clearance from intrack.enrollment_events where enrollment_id=e.id order by after_revision desc limit 1) life on true
  where exists(select 1 from intrack.memberships mem where mem.profile_id=actor and mem.program_id=e.program_id and mem.role=actor_role and mem.active)
    and (actor_role='coordinator' or (actor_role='student' and e.student_id=actor) or (actor_role='adviser' and a.adviser_id=actor));
  return result;
end $$;

revoke all on function public.intrack_list_enrollments(text) from public,anon,authenticated;
grant execute on function public.intrack_list_enrollments(text) to authenticated;
commit;
