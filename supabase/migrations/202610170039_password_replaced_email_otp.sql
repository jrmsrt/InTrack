begin;
-- Owner-approved policy: replaced default permits student/adviser OTP-only sign-in.
-- Coordinator administrative access continues to require MFA.
create or replace function intrack.identity_before_whitelist()
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
  password_replaced boolean;
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

  select exists(select 1 from intrack.whitelist_login_setup w
    where w.profile_id=person.id and not w.requires_password_change and w.password_changed_at is not null)
    and not exists(select 1 from intrack.memberships m where m.profile_id=person.id and m.role='coordinator' and m.active)
  into password_replaced;

  if person.status <> 'active' or person.activated_at is null then
    access_state := 'setup_required'; reason := 'activation_required';
  elsif jsonb_array_length(memberships) = 0 then
    access_state := 'setup_required'; reason := 'membership_required';
  elsif notice is null then
    access_state := 'setup_required'; reason := 'notice_not_configured';
  elsif acknowledgment is null then
    access_state := 'setup_required'; reason := 'notice_acknowledgment_required';
  elsif has_staff and not has_student and assurance <> 'aal2' and not password_replaced then
    access_state := 'mfa_required'; reason := 'staff_mfa_required';
  else
    access_state := 'ready';
  end if;
  select coalesce(jsonb_agg(r.role order by r.role), '[]'::jsonb) into usable_roles
  from (
    select distinct m.role from intrack.memberships m
    where m.profile_id = person.id and m.active and access_state = 'ready'
      and (m.role = 'student' or assurance = 'aal2' or (m.role='adviser' and password_replaced))
  ) r;

  return jsonb_build_object(
    'state', access_state, 'reason', reason,
    'profile', jsonb_build_object('id', person.id, 'displayName', person.display_name,
      'studentNumber', person.student_number, 'status', person.status,
      'activatedAt', person.activated_at, 'revision', person.revision),
    'memberships', memberships, 'usableRoles', usable_roles,
    'staffMfaRequired', has_staff and assurance <> 'aal2' and not password_replaced,
    'privacy', jsonb_build_object('currentVersion', notice, 'acknowledgedAt', acknowledgment)
  );
end;
$$;
revoke all on function intrack.identity_before_whitelist() from public,anon,authenticated;

create or replace function intrack.identity_with_whitelist() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; setup intrack.whitelist_login_setup%rowtype;
begin
  result:=intrack.identity_before_whitelist();
  if not (result ? 'profile') then return result;end if;
  select * into setup from intrack.whitelist_login_setup where profile_id=(result->'profile'->>'id')::uuid;
  if not found then return result;end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) method where method->>'method'='otp') then
    result:=result||jsonb_build_object('state','setup_required','reason','email_otp_required','usableRoles','[]'::jsonb);
  elsif coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' and
    (setup.requires_password_change or setup.password_changed_at is null or exists(
      select 1 from intrack.memberships m where m.profile_id=setup.profile_id and m.role='coordinator' and m.active)) then
    result:=result||jsonb_build_object('state','mfa_required','reason','authenticator_required','usableRoles','[]'::jsonb);
  end if;
  return result||jsonb_build_object('passwordChangeSuggested',setup.requires_password_change,'whitelisted',true);
end $$;

revoke all on function intrack.identity_with_whitelist() from public,anon,authenticated;


notify pgrst,'reload schema';
commit;
