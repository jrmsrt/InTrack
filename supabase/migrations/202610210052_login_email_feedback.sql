begin;

-- Only used after Auth reports invalid credentials so the login form can
-- identify whether the email or password needs correction.
create function public.intrack_login_email_exists(address text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare normalized text := lower(trim(address));
begin
  if length(normalized) > 254 or normalized !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return false;
  end if;
  return exists (
    select 1 from auth.users u
    join intrack.profiles p on p.auth_user_id = u.id
    where lower(u.email) = normalized and u.deleted_at is null
      and p.status in ('invited', 'active')
  );
end $$;

revoke all on function public.intrack_login_email_exists(text) from public;
grant execute on function public.intrack_login_email_exists(text) to anon, authenticated;
notify pgrst, 'reload schema';
commit;
