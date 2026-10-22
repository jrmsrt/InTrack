begin;
-- Bind email verification to the actual password-authenticated session, never an OTP-only session.
create table intrack.login_email_checks (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  email_session_id uuid unique,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null default now()+interval '12 hours'
);
alter table intrack.login_email_checks enable row level security;
revoke all on intrack.login_email_checks from public,anon,authenticated;
create function public.intrack_record_login_email(subject uuid,password_session uuid,email_session uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    join intrack.profiles p on p.auth_user_id=u.id
    where s.id=password_session and u.id=subject and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now()) and p.status in ('invited','active')
      and exists(select 1 from intrack.memberships m where m.profile_id=p.id and m.active)) then
    raise exception 'Active linked password session required' using errcode='42501';
  end if;
  if email_session=password_session or not exists(select 1 from auth.sessions s where s.id=email_session and s.user_id=subject) then
    raise exception 'Separate matching email session required' using errcode='42501';
  end if;
  insert into intrack.login_email_checks(session_id,auth_user_id,email_session_id) values(password_session,subject,email_session) on conflict(session_id) do nothing;
end $$;
revoke all on function public.intrack_record_login_email(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.intrack_record_login_email(uuid,uuid,uuid) to service_role;
create or replace function intrack.identity_with_whitelist() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; setup intrack.whitelist_login_setup%rowtype; sid text:=auth.jwt()->>'session_id';
begin
  result:=intrack.identity_before_whitelist();
  if not (result ? 'profile') then return result;end if;
  select * into setup from intrack.whitelist_login_setup where profile_id=(result->'profile'->>'id')::uuid;
  if found then result:=result||jsonb_build_object('passwordChangeSuggested',setup.requires_password_change,'whitelisted',true);end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) method where method->>'method'='password') then
    return result||jsonb_build_object('state','setup_required','reason','password_login_required','usableRoles','[]'::jsonb);
  end if;
  if sid is null or sid!~*'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    or not exists(select 1 from intrack.login_email_checks c where c.session_id=sid::uuid and c.auth_user_id=auth.uid() and c.expires_at>now()) then
    return result||jsonb_build_object('state','setup_required','reason','email_otp_required','usableRoles','[]'::jsonb);
  end if;
  if coalesce(auth.jwt()->>'aal','aal1')<>'aal2' then
    return result||jsonb_build_object('state','mfa_required','reason','authenticator_required','usableRoles','[]'::jsonb);
  end if;
  return result;
end $$;
revoke all on function intrack.identity_with_whitelist() from public,anon,authenticated;
notify pgrst,'reload schema';
commit;
