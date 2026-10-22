begin;

-- Trusted administration configures the approved notice; no browser writes.
create table intrack.identity_configuration (
  singleton boolean primary key default true check (singleton),
  current_notice_version text check (current_notice_version is null or nullif(trim(current_notice_version), '') is not null)
);
insert into intrack.identity_configuration(singleton) values (true);
alter table intrack.identity_configuration enable row level security;
revoke all on intrack.identity_configuration from public, anon, authenticated;

-- A deliberately narrow setup RPC. It does not grant domain-record access.
-- SECURITY DEFINER is required because clients have no intrack/Auth table grants.
-- Fixed search path and qualified relations prevent object-name substitution.
create function public.intrack_get_my_identity()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  subject uuid := auth.uid();
  person intrack.profiles%rowtype;
  notice text;
  acknowledgment timestamptz;
  memberships jsonb;
  usable_roles jsonb;
  has_student boolean;
  has_staff boolean;
  assurance text := coalesce(auth.jwt()->>'aal', 'aal1');
  access_state text;
  reason text;
begin
  if subject is null then
    raise exception 'Authentication required' using errcode = '28000';
  end if;
  -- Check the current Auth row, not editable user metadata or token email.
  if not exists (
    select 1 from auth.users u where u.id = subject
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  ) then
    return jsonb_build_object('state', 'disabled');
  end if;
  select * into person from intrack.profiles p where p.auth_user_id = subject;
  if found and person.status in ('suspended', 'archived') then
    return jsonb_build_object('state', 'disabled');
  end if;
  if not exists (select 1 from auth.users u where u.id = subject and u.email_confirmed_at is not null) then
    return jsonb_build_object('state', 'email_verification_required');
  end if;
  if person.id is null then
    return jsonb_build_object('state', 'unprovisioned');
  end if;

  select c.current_notice_version into notice from intrack.identity_configuration c where c.singleton;
  select a.acknowledged_at into acknowledgment from intrack.privacy_acknowledgments a
    where a.profile_id = person.id and a.notice_version = notice;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', m.id, 'programId', m.program_id, 'programCode', p.code, 'role', m.role
  ) order by p.code, m.role), '[]'::jsonb),
    coalesce(bool_or(m.role = 'student'), false),
    coalesce(bool_or(m.role in ('adviser', 'coordinator')), false)
  into memberships, has_student, has_staff
  from intrack.memberships m join intrack.programs p on p.id = m.program_id
  where m.profile_id = person.id and m.active;

  if person.status <> 'active' or person.activated_at is null then
    access_state := 'setup_required'; reason := 'activation_required';
  elsif jsonb_array_length(memberships) = 0 then
    access_state := 'setup_required'; reason := 'membership_required';
  elsif notice is null then
    access_state := 'setup_required'; reason := 'notice_not_configured';
  elsif acknowledgment is null then
    access_state := 'setup_required'; reason := 'notice_acknowledgment_required';
  elsif has_staff and not has_student and assurance <> 'aal2' then
    access_state := 'mfa_required'; reason := 'staff_mfa_required';
  else
    access_state := 'ready';
  end if;
  select coalesce(jsonb_agg(r.role order by r.role), '[]'::jsonb) into usable_roles
  from (
    select distinct m.role from intrack.memberships m
    where m.profile_id = person.id and m.active and access_state = 'ready'
      and (m.role = 'student' or assurance = 'aal2')
  ) r;

  return jsonb_build_object(
    'state', access_state, 'reason', reason,
    'profile', jsonb_build_object('id', person.id, 'displayName', person.display_name,
      'studentNumber', person.student_number, 'status', person.status,
      'activatedAt', person.activated_at, 'revision', person.revision),
    'memberships', memberships, 'usableRoles', usable_roles,
    'staffMfaRequired', has_staff and assurance <> 'aal2',
    'privacy', jsonb_build_object('currentVersion', notice, 'acknowledgedAt', acknowledgment)
  );
end;
$$;
revoke all on function public.intrack_get_my_identity() from public, anon, authenticated;
grant execute on function public.intrack_get_my_identity() to authenticated;
comment on function public.intrack_get_my_identity() is
  'Own-identity setup projection only. No client arguments, authority changes, or domain access.';

commit;
