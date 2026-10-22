begin;

-- Only a trusted successful password update can create this receipt. It is
-- bound to the still-live verified session, never to an email/browser flag.
create table intrack.password_change_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  changed_at timestamptz not null default now(),
  resume_until timestamptz not null default now() + interval '5 minutes',
  resumed_at timestamptz,
  access_until timestamptz not null default now() + interval '12 hours'
);
alter table intrack.password_change_sessions enable row level security;
revoke all on intrack.password_change_sessions from public, anon, authenticated;

create function public.intrack_record_password_change(subject uuid, verified_session uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    join intrack.profiles p on p.auth_user_id = u.id
    where s.id = verified_session and u.id = subject and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and p.status = 'active' and p.activated_at is not null
      and exists (select 1 from intrack.memberships m where m.profile_id = p.id and m.active)
  ) then raise exception 'Active verified session required' using errcode = '42501'; end if;
  insert into intrack.password_change_sessions(session_id, auth_user_id)
    values (verified_session, subject)
    on conflict (session_id) do update set changed_at = now(), resume_until = now() + interval '5 minutes',
      resumed_at = null, access_until = now() + interval '12 hours';
  update intrack.whitelist_login_setup w set requires_password_change = false, password_changed_at = now()
    from intrack.profiles p where p.id = w.profile_id and p.auth_user_id = subject;
end $$;
revoke all on function public.intrack_record_password_change(uuid,uuid) from public, anon, authenticated;
grant execute on function public.intrack_record_password_change(uuid,uuid) to service_role;

create function public.intrack_can_resume_password_change() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from intrack.password_change_sessions r
    join auth.sessions s on s.id = r.session_id and s.user_id = r.auth_user_id
    join auth.users u on u.id = r.auth_user_id
    join intrack.profiles p on p.auth_user_id = u.id
    where r.auth_user_id = auth.uid() and r.session_id::text = auth.jwt()->>'session_id'
      and r.resumed_at is null and r.resume_until > now()
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
      and p.status = 'active' and p.activated_at is not null
  );
$$;
revoke all on function public.intrack_can_resume_password_change() from public, anon;
grant execute on function public.intrack_can_resume_password_change() to authenticated;

-- The Edge handler first verifies the caller's existing session and a fresh
-- password-authenticated session for the same user. Consumption is atomic.
create function public.intrack_resume_password_change(subject uuid, verified_session uuid, password_session uuid) returns boolean
language plpgsql security definer set search_path = '' as $$
declare receipt intrack.password_change_sessions%rowtype;
begin
  select * into receipt from intrack.password_change_sessions r
    where r.session_id = verified_session and r.auth_user_id = subject for update;
  if not found or receipt.resumed_at is not null or receipt.resume_until <= now() then return false; end if;
  if password_session = verified_session or not exists (
    select 1 from auth.sessions s where s.id = password_session and s.user_id = subject
      and s.created_at >= receipt.changed_at - interval '5 seconds'
  ) or not exists (
    select 1 from auth.sessions s join auth.users u on u.id = s.user_id
    join intrack.profiles p on p.auth_user_id = u.id
    where s.id = verified_session and u.id = subject and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and p.status = 'active' and p.activated_at is not null
      and exists (select 1 from intrack.memberships m where m.profile_id = p.id and m.active)
  ) then raise exception 'Matching live sign-in sessions required' using errcode = '42501'; end if;
  update intrack.password_change_sessions set resumed_at = now() where session_id = verified_session;
  insert into intrack.login_email_checks(session_id, auth_user_id, expires_at)
    values (verified_session, subject, receipt.access_until)
    on conflict (session_id) do update set verified_at = now(), expires_at = excluded.expires_at;
  return true;
end $$;
revoke all on function public.intrack_resume_password_change(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.intrack_resume_password_change(uuid,uuid,uuid) to service_role;

create or replace function intrack.identity_with_whitelist() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare result jsonb; setup intrack.whitelist_login_setup%rowtype; sid text := auth.jwt()->>'session_id';
begin
  result := intrack.identity_before_whitelist();
  if not (result ? 'profile') then return result; end if;
  select * into setup from intrack.whitelist_login_setup where profile_id = (result->'profile'->>'id')::uuid;
  if found then result := result || jsonb_build_object('passwordChangeSuggested',setup.requires_password_change,'whitelisted',true); end if;
  if not exists (select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) method where method->>'method' = 'password')
    and not exists (
      select 1 from intrack.password_change_sessions r join auth.sessions s on s.id = r.session_id and s.user_id = r.auth_user_id
      where r.session_id::text = sid and r.auth_user_id = auth.uid() and r.resumed_at is not null and r.access_until > now()
    ) then
    return result || jsonb_build_object('state','setup_required','reason','password_login_required','usableRoles','[]'::jsonb);
  end if;
  if sid is null or sid !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or not exists (select 1 from intrack.login_email_checks c where c.session_id = sid::uuid and c.auth_user_id = auth.uid() and c.expires_at > now()) then
    return result || jsonb_build_object('state','setup_required','reason','email_otp_required','usableRoles','[]'::jsonb);
  end if;
  -- Keep Auth's actual MFA assurance; resuming never invents an AAL2 token.
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    return result || jsonb_build_object('state','mfa_required','reason','authenticator_required','usableRoles','[]'::jsonb);
  end if;
  return result;
end $$;
revoke all on function intrack.identity_with_whitelist() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
