begin;

-- A trusted password update already established knowledge of the new password.
-- Reuse its verified recovery session immediately, including Auth's real MFA.
create function public.intrack_finish_recovery_session(subject uuid, verified_session uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare receipt intrack.password_change_sessions%rowtype;
begin
  select * into receipt from intrack.password_change_sessions r
    where r.session_id = verified_session and r.auth_user_id = subject for update;
  if not found or receipt.access_until <= now()
    or (receipt.resumed_at is null and receipt.resume_until <= now()) then return false; end if;
  if not exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    join intrack.profiles p on p.auth_user_id = u.id
    where s.id = verified_session and u.id = subject and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and p.status = 'active' and p.activated_at is not null
      and exists (select 1 from intrack.memberships m where m.profile_id = p.id and m.active)
  ) then raise exception 'Active verified recovery session required' using errcode = '42501'; end if;
  update intrack.password_change_sessions set resumed_at = coalesce(resumed_at, now()) where session_id = verified_session;
  insert into intrack.login_email_checks(session_id, auth_user_id, expires_at)
    values (verified_session, subject, receipt.access_until)
    on conflict (session_id) do update set verified_at = now(), expires_at = excluded.expires_at;
  return true;
end $$;
revoke all on function public.intrack_finish_recovery_session(uuid,uuid) from public, anon, authenticated;
grant execute on function public.intrack_finish_recovery_session(uuid,uuid) to service_role;
notify pgrst, 'reload schema';
commit;
