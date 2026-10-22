begin;
create function public.intrack_list_account_invitations()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
  actor:=intrack.authorized_actor('coordinator');
  select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'profileId',i.profile_id,'state',i.state,'expiresAt',i.expires_at,
    'expired',i.expires_at is not null and i.expires_at<=now(),'commandId',c.command_id,'payload',c.request_payload) order by i.created_at desc),'[]') into result
  from intrack.account_invitations i join intrack.account_invitation_commands c on c.invitation_id=i.id and c.actor_id=actor
    join intrack.memberships m on m.id=i.membership_id
  where i.requested_by=actor and exists(select 1 from intrack.memberships scope where scope.profile_id=actor and scope.program_id=m.program_id and scope.role='coordinator' and scope.active);
  return result;
end $$;
revoke all on function public.intrack_list_account_invitations() from public,anon,authenticated;
grant execute on function public.intrack_list_account_invitations() to authenticated;
commit;
