begin;
create table intrack.account_invitation_commands (
  actor_id uuid not null references intrack.profiles(id),
  command_id uuid not null,
  invitation_id uuid not null unique references intrack.account_invitations(id),
  request_payload jsonb not null,
  primary key(actor_id,command_id),
  foreign key(actor_id,command_id) references intrack.command_receipts(actor_id,command_id) deferrable initially deferred
);
alter table intrack.account_invitation_commands enable row level security;
revoke all on intrack.account_invitation_commands from public,anon,authenticated;
create function public.intrack_reserve_account_invitation(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<reservation>>
declare actor uuid; receipt jsonb; target_role text; program uuid; email text; name text; person intrack.profiles%rowtype;
  eligible intrack.eligible_students%rowtype; subject uuid; membership uuid; invitation uuid; result jsonb;
begin
  if payload is null or jsonb_typeof(payload)<>'object' or exists(select 1 from jsonb_object_keys(payload) k where k not in ('role','eligibleStudentId','programId','email','name')) then raise exception 'Only invitation identity fields are accepted' using errcode='22023';end if;
  target_role:=payload->>'role';
  if target_role='student' then
    select * into eligible from intrack.eligible_students where id=(payload->>'eligibleStudentId')::uuid for update;
    if not found then raise exception 'Approved masterlist record required' using errcode='42501';end if;
    program:=eligible.program_id;email:=eligible.email;name:=eligible.display_name;
  elsif target_role='adviser' then
    program:=(payload->>'programId')::uuid;email:=lower(trim(payload->>'email'));name:=trim(payload->>'name');
  else raise exception 'Only Student/Adviser invitations are permitted' using errcode='42501';end if;
  actor:=intrack.authorized_actor('coordinator',program);receipt:=intrack.begin_command(actor,command_id,'reserve_account_invitation',payload);if receipt is not null then return receipt;end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('account:'||coalesce(email,''),0));
  if coalesce(length(name),0) not between 1 and 240 or coalesce(email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or not exists(
    select 1 from intrack.program_configuration c where c.program_id=program and split_part(email,'@',2)=any(case when target_role='student' then c.student_email_domains else c.staff_email_domains end)
  ) then raise exception 'Approved identity and email domain required' using errcode='22023';end if;
  select u.id into subject from auth.users u where lower(u.email)=reservation.email and u.deleted_at is null;
  if subject is not null then
    select * into person from intrack.profiles where auth_user_id=subject for update;
    if not found or person.id=actor or person.status<>'active' or (target_role='student' and person.student_number is distinct from eligible.student_number)
      or not exists(select 1 from auth.users where id=subject and email_confirmed_at is not null and (banned_until is null or banned_until<=now())) then
      raise exception 'Existing Auth identity requires explicit trusted reconciliation' using errcode='40001';end if;
    insert into intrack.memberships(profile_id,program_id,role,granted_by,change_reason)
      values(person.id,program,target_role,actor,'Approved additional membership') on conflict(profile_id,program_id,role) do nothing;
    if not exists(select 1 from intrack.memberships where profile_id=person.id and program_id=program and role=target_role and active) then raise exception 'Restore an existing revoked membership explicitly' using errcode='40001';end if;
    if target_role='student' then update intrack.eligible_students set invited_profile_id=person.id where id=eligible.id;end if;
    return intrack.finish_command(actor,command_id,'reserve_account_invitation',payload,jsonb_build_object('state','membership_granted','profileId',person.id),'profile',person.id);
  end if;
  if (eligible.invited_profile_id is not null) or exists(select 1 from intrack.account_invitations i where i.email=reservation.email and i.state in('reserved','sent','delivery_failed')) then
    raise exception 'Invitation already reserved; use its original command ID or explicit resend/reconciliation' using errcode='40001';end if;
  insert into intrack.profiles(display_name,student_number) values(name,case when target_role='student' then eligible.student_number else null end) returning * into person;
  insert into intrack.memberships(profile_id,program_id,role,granted_by,change_reason) values(person.id,program,target_role,actor,'Approved account invitation') returning id into membership;
  insert into intrack.account_invitations(profile_id,membership_id,eligible_student_id,email,requested_by)
    values(person.id,membership,eligible.id,email,actor) returning id into invitation;
  insert into intrack.account_invitation_commands(actor_id,command_id,invitation_id,request_payload) values(actor,command_id,invitation,payload);
  if target_role='student' then update intrack.eligible_students set invited_profile_id=person.id where id=eligible.id;end if;
  result:=jsonb_build_object('state','reserved','invitationId',invitation,'profileId',person.id);
  return intrack.finish_command(actor,command_id,'reserve_account_invitation',payload,result,'invitation',invitation);
end $$;
revoke all on function public.intrack_reserve_account_invitation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_reserve_account_invitation(uuid,jsonb) to authenticated;

create function public.intrack_account_invitation_context(invitation_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation intrack.account_invitations%rowtype; membership intrack.memberships%rowtype; actor uuid;
begin
  select * into invitation from intrack.account_invitations where id=invitation_id;
  if not found then raise exception 'Invitation unavailable' using errcode='42501';end if;
  select * into membership from intrack.memberships where id=invitation.membership_id;
  actor:=intrack.authorized_actor('coordinator',membership.program_id);
  if invitation.requested_by<>actor or membership.role='coordinator' or not membership.active or not exists(
    select 1 from intrack.program_configuration c where c.program_id=membership.program_id and split_part(invitation.email,'@',2)=any(case when membership.role='student' then c.student_email_domains else c.staff_email_domains end)
  ) then raise exception 'Invitation requester, membership and approved domain required' using errcode='42501';end if;
  return jsonb_build_object('invitationId',invitation.id,'state',invitation.state,'email',invitation.email,'createdAt',invitation.created_at,
    'authUserId',(select auth_user_id from intrack.profiles where id=invitation.profile_id),
    'reconciliationRequired',exists(select 1 from auth.users where lower(email)=invitation.email));
end $$;
revoke all on function public.intrack_account_invitation_context(uuid) from public,anon,authenticated;
grant execute on function public.intrack_account_invitation_context(uuid) to authenticated;

create function public.intrack_link_account_invitation(invitation_id uuid, auth_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation intrack.account_invitations%rowtype; membership intrack.memberships%rowtype; person intrack.profiles%rowtype; actor uuid;
begin
  select * into invitation from intrack.account_invitations where id=invitation_id for update;
  if not found then raise exception 'Invitation unavailable' using errcode='42501';end if;
  select * into membership from intrack.memberships where id=invitation.membership_id for share;
  actor:=intrack.authorized_actor('coordinator',membership.program_id);
  if invitation.requested_by<>actor or membership.role='coordinator' or not membership.active or not exists(
    select 1 from intrack.program_configuration c where c.program_id=membership.program_id and split_part(invitation.email,'@',2)=any(case when membership.role='student' then c.student_email_domains else c.staff_email_domains end)
  ) then raise exception 'Invitation requester, membership and approved domain required' using errcode='42501';end if;
  select * into person from intrack.profiles where id=invitation.profile_id for update;
  if person.auth_user_id is not null then
    if person.auth_user_id<>auth_user_id then raise exception 'Auth linkage conflict' using errcode='40001';end if;
    return jsonb_build_object('linked',true,'profileId',person.id);
  end if;
  if person.status<>'invited' or invitation.state<>'reserved' or invitation.created_at+interval '1 hour'<=now() or not exists(
    select 1 from auth.users u where u.id=auth_user_id and lower(u.email)=invitation.email and u.created_at>=invitation.created_at
      and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now())
  ) then raise exception 'New reserved Auth identity required; expired attempts need trusted reconciliation' using errcode='42501';end if;
  update intrack.profiles set auth_user_id=intrack_link_account_invitation.auth_user_id,revision=revision+1,updated_at=now() where id=person.id;
  update intrack.account_invitations set state='sent',sent_at=created_at,expires_at=created_at+interval '1 hour',delivery_attempts=delivery_attempts+1,revision=revision+1 where id=invitation.id;
  insert into intrack.audit_events(actor_id,entity_type,entity_id,action,command_id,details)
    values(actor,'invitation',invitation.id,'account_invitation_linked',invitation.correlation_id,jsonb_build_object('profileId',person.id));
  return jsonb_build_object('linked',true,'profileId',person.id);
end $$;
revoke all on function public.intrack_link_account_invitation(uuid,uuid) from public,anon,authenticated;
grant execute on function public.intrack_link_account_invitation(uuid,uuid) to authenticated;
commit;
