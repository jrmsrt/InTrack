begin;
-- Email OTP must precede authenticator enrollment/challenge and password decision.
create or replace function intrack.identity_with_whitelist() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb; setup intrack.whitelist_login_setup%rowtype;
begin
  result:=intrack.identity_before_whitelist();
  if not (result ? 'profile') then return result;end if;
  select * into setup from intrack.whitelist_login_setup where profile_id=(result->'profile'->>'id')::uuid;
  if not found then return result;end if;
  if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) method where method->>'method'='otp') then
    result:=result||jsonb_build_object('state','setup_required','reason','email_otp_required','usableRoles','[]'::jsonb);
  elsif coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    result:=result||jsonb_build_object('state','mfa_required','reason','authenticator_required','usableRoles','[]'::jsonb);
  end if;
  return result||jsonb_build_object('passwordChangeSuggested',setup.requires_password_change,'whitelisted',true);
end $$;

revoke all on function intrack.identity_with_whitelist() from public,anon,authenticated;

notify pgrst,'reload schema';
commit;
