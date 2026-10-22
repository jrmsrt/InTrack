begin;

-- Return only the status needed by Forgot Password, never account identifiers.
create function public.intrack_password_recovery_status(address text) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select case
      when p.status = 'active' and p.activated_at is not null then 'ready'
      else 'activation_required'
    end
    from auth.users u join intrack.profiles p on p.auth_user_id = u.id
    where lower(u.email) = lower(trim(address))
      and length(trim(address)) <= 254
      and u.deleted_at is null
      and (u.banned_until is null or u.banned_until <= now())
      and p.status in ('invited', 'active')
  ), 'unavailable');
$$;

revoke all on function public.intrack_password_recovery_status(text) from public;
grant execute on function public.intrack_password_recovery_status(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
