begin;
-- No credentials are stored here. This tracks only coordinator provisioning and
-- whether the user elected to keep or replace the supplied default password.
create table intrack.whitelist_login_setup (
  profile_id uuid primary key references intrack.profiles(id),
  invitation_id uuid not null unique references intrack.account_invitations(id),
  requires_password_change boolean not null default true,
  decided_at timestamptz,
  password_changed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table intrack.whitelist_login_setup enable row level security;
revoke all on intrack.whitelist_login_setup from public,anon,authenticated;

create function public.intrack_register_whitelist(invitation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare invitation intrack.account_invitations%rowtype; person intrack.profiles%rowtype; membership intrack.memberships%rowtype; actor uuid;
begin
  select * into invitation from intrack.account_invitations where id=invitation_id for update;
  if not found then raise exception 'Whitelist reservation required' using errcode='42501';end if;
  select * into membership from intrack.memberships where id=invitation.membership_id for share;
  actor:=intrack.authorized_actor('coordinator',membership.program_id);
  select * into person from intrack.profiles where id=invitation.profile_id for update;
  if invitation.requested_by<>actor or membership.role not in ('student','adviser') or not membership.active
    or invitation.state not in ('sent','accepted') or person.status not in ('invited','active')
    or not exists(select 1 from auth.users u where u.id=person.auth_user_id and lower(u.email)=invitation.email
      and nullif(u.encrypted_password,'') is not null and u.deleted_at is null
      and (u.banned_until is null or u.banned_until<=now())) then
    raise exception 'Linked coordinator-approved credential required' using errcode='42501';end if;
  if not exists(select 1 from intrack.program_configuration c where c.program_id=membership.program_id
    and split_part(invitation.email,'@',2)=any(case when membership.role='student' then c.student_email_domains else c.staff_email_domains end)) then
    raise exception 'Approved email domain required' using errcode='42501';end if;
  if exists(select 1 from intrack.whitelist_login_setup w where w.profile_id=person.id and w.invitation_id=invitation.id) then
    return jsonb_build_object('whitelisted',true,'profileId',person.id);end if;
  if person.status<>'invited' or invitation.state<>'sent' then raise exception 'Do not replace an active account default password' using errcode='42501';end if;
  insert into intrack.whitelist_login_setup(profile_id,invitation_id) values(person.id,invitation.id);
  insert into intrack.audit_events(actor_id,entity_type,entity_id,action,command_id,details)
    values(actor,'profile',person.id,'account_whitelisted',invitation.correlation_id,jsonb_build_object('invitationId',invitation.id));
  return jsonb_build_object('whitelisted',true,'profileId',person.id);
end $$;
revoke all on function public.intrack_register_whitelist(uuid) from public,anon,authenticated;
grant execute on function public.intrack_register_whitelist(uuid) to authenticated;

create function public.intrack_link_whitelist(invitation_id uuid, auth_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.intrack_link_account_invitation(invitation_id,auth_user_id);
  return public.intrack_register_whitelist(invitation_id);
end $$;
revoke all on function public.intrack_link_whitelist(uuid,uuid) from public,anon,authenticated;
grant execute on function public.intrack_link_whitelist(uuid,uuid) to authenticated;

-- Preserve the existing projection, adding a server-owned password suggestion.
create function intrack.identity_before_whitelist()
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
revoke all on function intrack.identity_before_whitelist() from public,anon,authenticated;
create or replace function public.intrack_get_my_identity() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; setup intrack.whitelist_login_setup%rowtype;
begin
  result:=intrack.identity_before_whitelist();
  if not (result ? 'profile') then return result;end if;
  select * into setup from intrack.whitelist_login_setup where profile_id=(result->'profile'->>'id')::uuid;
  if not found then return result;end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) method where method->>'method'='otp') then
    result:=result||jsonb_build_object('state','setup_required','reason','email_otp_required','usableRoles','[]'::jsonb);
  end if;
  return result||jsonb_build_object('passwordChangeSuggested',setup.requires_password_change,'whitelisted',true);
end $$;
revoke all on function public.intrack_get_my_identity() from public,anon,authenticated;
grant execute on function public.intrack_get_my_identity() to authenticated;
create or replace function public.intrack_check_activation(subject uuid, notice_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  person intrack.profiles%rowtype;
  invitation intrack.account_invitations%rowtype;
  configured_notice text;
begin
  select * into person from intrack.profiles p where p.auth_user_id=subject;
  if not found or person.status not in ('invited','active') or not exists(
    select 1 from auth.users u where u.id=subject and u.email_confirmed_at is not null
      and u.deleted_at is null and (u.banned_until is null or u.banned_until <= now())
  ) then raise exception 'Verified invited identity required' using errcode='42501'; end if;
  select c.current_notice_version into configured_notice from intrack.identity_configuration c where c.singleton;
  if configured_notice is null or notice_version is distinct from configured_notice then
    raise exception 'Current approved notice acknowledgment required' using errcode='22023'; end if;
  if not exists(select 1 from intrack.memberships m where m.profile_id=person.id and m.active) then
    raise exception 'Active membership required' using errcode='42501'; end if;
  select * into invitation from intrack.account_invitations i where i.profile_id=person.id
    and i.state in ('sent','accepted') order by i.created_at desc limit 1;
  if invitation.id is null or not exists(
    select 1 from auth.users u where u.id=subject and lower(u.email)=invitation.email
  ) or not exists(
    select 1 from intrack.memberships m where m.id=invitation.membership_id and m.profile_id=person.id and m.active
  ) then raise exception 'Matching active invitation required' using errcode='42501'; end if;
  if person.status='active' then
    if invitation.state <> 'accepted' or not exists(select 1 from intrack.privacy_acknowledgments a
      where a.profile_id=person.id and a.notice_version=configured_notice) then
      raise exception 'Account activation is not retryable' using errcode='42501'; end if;
    return jsonb_build_object('alreadyActive',true,'profileId',person.id);
  end if;
  if invitation.state <> 'sent' or invitation.expires_at is null or (invitation.expires_at <= now() and not exists(select 1 from intrack.whitelist_login_setup w where w.profile_id=person.id and w.invitation_id=invitation.id)) then
    raise exception 'Invitation expired or no longer valid' using errcode='42501'; end if;
  return jsonb_build_object('alreadyActive',false,'profileId',person.id);
end $$;


-- Only the verified server can commit a decision. Caller-controlled booleans
-- never prove a credential change; the Edge handler verifies Auth first.
create function public.intrack_finish_password_decision(subject uuid, notice_version text, password_changed boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare person intrack.profiles%rowtype; setup intrack.whitelist_login_setup%rowtype; activated jsonb;
begin
  select * into person from intrack.profiles where auth_user_id=subject for update;
  if not found then raise exception 'Whitelisted account required' using errcode='42501';end if;
  select * into setup from intrack.whitelist_login_setup where profile_id=person.id for update;
  if not found then raise exception 'Whitelisted account required' using errcode='42501';end if;
  activated:=public.intrack_activate_account(subject,notice_version);
  update intrack.whitelist_login_setup set decided_at=coalesce(decided_at,now()),
    requires_password_change=case when password_changed then false else requires_password_change end,
    password_changed_at=case when password_changed then coalesce(password_changed_at,now()) else password_changed_at end
    where profile_id=person.id;
  if setup.decided_at is null or (password_changed and setup.requires_password_change) then
    insert into intrack.audit_events(actor_id,entity_type,entity_id,action,command_id,details)
      values(person.id,'profile',person.id,'password_decision_completed',(select correlation_id from intrack.account_invitations where id=setup.invitation_id),
        jsonb_build_object('passwordChanged',password_changed,'noticeVersion',notice_version));
  end if;
  return jsonb_build_object('activated',true,'passwordChangeSuggested',case when password_changed then false else setup.requires_password_change end);
end $$;
revoke all on function public.intrack_finish_password_decision(uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.intrack_finish_password_decision(uuid,text,boolean) to service_role;
commit;

