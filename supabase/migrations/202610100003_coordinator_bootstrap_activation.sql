begin;

create table intrack.bootstrap_requests (
  command_id uuid primary key,
  email text not null,
  display_name text not null,
  program_codes text[] not null,
  reason text not null,
  profile_id uuid not null unique references intrack.profiles(id),
  invitation_id uuid not null unique references intrack.account_invitations(id),
  created_at timestamptz not null default now()
);
alter table intrack.bootstrap_requests enable row level security;
revoke all on intrack.bootstrap_requests from public, anon, authenticated;

-- Operator only. This reserves exactly the FIRST coordinator, never a general role API.
create function public.intrack_reserve_first_coordinator(
  command_id uuid, email text, display_name text, program_codes text[], reason text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request intrack.bootstrap_requests%rowtype;
  person uuid;
  membership uuid;
  invitation uuid := gen_random_uuid();
  codes text[];
  program record;
begin
  perform pg_advisory_xact_lock(hashtext('intrack-first-coordinator'));
  if command_id is null or nullif(trim(reason),'') is null or nullif(trim(display_name),'') is null
    or email is null or email <> lower(trim(email)) or email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Valid identity, command ID and operator reason required' using errcode='22023';
  end if;
  select array_agg(distinct c order by c) into codes from unnest(program_codes) c;
  if coalesce(cardinality(codes),0)=0 or exists (
    select 1 from unnest(codes) c where c is null or not exists(select 1 from intrack.programs p where p.code=c)
  ) then raise exception 'Choose existing program codes' using errcode='22023'; end if;
  select * into request from intrack.bootstrap_requests b where b.command_id=intrack_reserve_first_coordinator.command_id;
  if found then
    if request.email <> email or request.display_name <> display_name or request.program_codes <> codes or request.reason <> reason then
      raise exception 'Command ID payload conflict' using errcode='40001';
    end if;
    return jsonb_build_object('invitationId',request.invitation_id,'profileId',request.profile_id,
      'authUserId',(select p.auth_user_id from intrack.profiles p where p.id=request.profile_id),
      'reconciliationRequired',exists(select 1 from auth.users u where lower(u.email)=request.email));
  end if;
  if exists(select 1 from intrack.memberships m where m.role='coordinator') then
    raise exception 'First coordinator already reserved; use its original command ID or trusted administration' using errcode='42501';
  end if;
  if exists(select 1 from auth.users u where lower(u.email)=intrack_reserve_first_coordinator.email)
    or exists(select 1 from intrack.account_invitations i where i.email=intrack_reserve_first_coordinator.email) then
    raise exception 'Existing identity requires explicit operator reconciliation' using errcode='23505';
  end if;
  insert into intrack.profiles(display_name) values (display_name) returning id into person;
  for program in select p.id from intrack.programs p where p.code=any(codes) order by p.code loop
    insert into intrack.memberships(profile_id,program_id,role,granted_by,change_reason)
      values(person,program.id,'coordinator',null,reason) returning id into membership;
  end loop;
  insert into intrack.account_invitations(id,profile_id,membership_id,email,requested_by)
    values(invitation,person,membership,email,person);
  insert into intrack.bootstrap_requests values(command_id,email,display_name,codes,reason,person,invitation,now());
  insert into intrack.audit_events(actor_id,entity_type,entity_id,action,command_id,details)
    values(null,'profile',person,'operator_coordinator_reserved',command_id,jsonb_build_object('reason',reason,'programCodes',codes));
  return jsonb_build_object('invitationId',invitation,'profileId',person,'authUserId',null,'reconciliationRequired',false);
end $$;

create function public.intrack_link_first_coordinator(command_id uuid, auth_user_id uuid, reconciliation_reason text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  request intrack.bootstrap_requests%rowtype;
  person intrack.profiles%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('intrack-first-coordinator'));
  select * into request from intrack.bootstrap_requests b where b.command_id=intrack_link_first_coordinator.command_id for update;
  if not found then raise exception 'Reservation not found' using errcode='22023'; end if;
  select * into person from intrack.profiles p where p.id=request.profile_id for update;
  if person.auth_user_id is not null then
    if person.auth_user_id <> auth_user_id then raise exception 'Auth identity conflict' using errcode='40001'; end if;
    return jsonb_build_object('profileId',person.id,'linked',true);
  end if;
  if person.status <> 'invited' or not exists(
    select 1 from auth.users u where u.id=auth_user_id and lower(u.email)=request.email
      and u.created_at >= request.created_at and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
  ) then raise exception 'Auth identity does not match the reserved invitation' using errcode='42501'; end if;
  if not exists(select 1 from intrack.account_invitations i where i.id=request.invitation_id and i.state='reserved') then
    raise exception 'Invitation is not reserved' using errcode='42501'; end if;
  update intrack.profiles p set auth_user_id=intrack_link_first_coordinator.auth_user_id, revision=p.revision+1,updated_at=now()
    where p.id=person.id;
  update intrack.account_invitations i set state='sent',sent_at=request.created_at,expires_at=request.created_at+interval '1 hour',
    delivery_attempts=i.delivery_attempts+1, revision=i.revision+1 where i.id=request.invitation_id;
  insert into intrack.audit_events(actor_id,entity_type,entity_id,action,command_id,details)
    values(null,'profile',person.id,'operator_coordinator_linked',command_id,
      jsonb_build_object('reason',coalesce(nullif(trim(reconciliation_reason),''),request.reason)));
  return jsonb_build_object('profileId',person.id,'linked',true);
end $$;

-- Used by the verified server handler before it changes a password.
create function public.intrack_check_activation(subject uuid, notice_version text)
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
  if invitation.state <> 'sent' or invitation.expires_at is null or invitation.expires_at <= now() then
    raise exception 'Invitation expired or no longer valid' using errcode='42501'; end if;
  return jsonb_build_object('alreadyActive',false,'profileId',person.id);
end $$;

-- Server-only: called AFTER Supabase Auth confirms password setup. No password argument.
create function public.intrack_activate_account(subject uuid, notice_version text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  person intrack.profiles%rowtype;
  invitation intrack.account_invitations%rowtype;
  check_result jsonb;
begin
  select * into person from intrack.profiles p where p.auth_user_id=subject for update;
  if person.id is null then raise exception 'Identity not provisioned' using errcode='42501'; end if;
  select * into invitation from intrack.account_invitations i where i.profile_id=person.id
    and i.state in ('sent','accepted') order by i.created_at desc limit 1 for update;
  perform 1 from intrack.memberships m where m.profile_id=person.id for share;
  perform 1 from intrack.identity_configuration c where c.singleton for share;
  perform 1 from auth.users u where u.id=subject for share;
  check_result := public.intrack_check_activation(subject,notice_version);
  if (check_result->>'alreadyActive')::boolean then return check_result; end if;
  if not exists(select 1 from auth.users u where u.id=subject and nullif(u.encrypted_password,'') is not null) then
    raise exception 'Credential setup not complete' using errcode='42501'; end if;
  insert into intrack.privacy_acknowledgments(profile_id,notice_version) values(person.id,intrack_activate_account.notice_version)
    on conflict do nothing;
  update intrack.account_invitations i set state='accepted',accepted_at=now(),revision=i.revision+1 where i.id=invitation.id;
  update intrack.profiles p set status='active',activated_at=now(),revision=p.revision+1,updated_at=now() where p.id=person.id;
  insert into intrack.audit_events(actor_id,entity_type,entity_id,action,command_id,before_revision,after_revision,details)
    values(person.id,'profile',person.id,'account_activated',invitation.correlation_id,person.revision,person.revision+1,
      jsonb_build_object('noticeVersion',notice_version,'invitationId',invitation.id));
  return jsonb_build_object('alreadyActive',false,'profileId',person.id,'activated',true);
end $$;

revoke all on function public.intrack_reserve_first_coordinator(uuid,text,text,text[],text) from public,anon,authenticated;
revoke all on function public.intrack_link_first_coordinator(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.intrack_check_activation(uuid,text) from public,anon,authenticated;
revoke all on function public.intrack_activate_account(uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_reserve_first_coordinator(uuid,text,text,text[],text) to service_role;
grant execute on function public.intrack_link_first_coordinator(uuid,uuid,text) to service_role;
grant execute on function public.intrack_check_activation(uuid,text) to service_role;
grant execute on function public.intrack_activate_account(uuid,text) to service_role;
commit;
