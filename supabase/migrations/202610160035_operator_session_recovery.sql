begin;
create table intrack.account_session_guards (
 profile_id uuid primary key references intrack.profiles(id),
 not_before_epoch bigint not null,
 updated_at timestamptz not null default now()
);
alter table intrack.account_session_guards enable row level security;
revoke all on intrack.account_session_guards from public,anon,authenticated;
create function intrack.identity_with_whitelist() returns jsonb language plpgsql stable security definer set search_path='' as $$
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

revoke all on function intrack.identity_with_whitelist() from public,anon,authenticated;
create or replace function public.intrack_get_my_identity() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare cutoff bigint; issued text:=auth.jwt()->>'iat';
begin
 select g.not_before_epoch into cutoff from intrack.account_session_guards g join intrack.profiles p on p.id=g.profile_id where p.auth_user_id=auth.uid();
 if found and (issued is null or issued !~ '^[0-9]{1,12}$' or issued::bigint<=cutoff) then return jsonb_build_object('state','disabled');end if;
 return intrack.identity_with_whitelist();
end $$;
revoke all on function public.intrack_get_my_identity() from public,anon,authenticated;
grant execute on function public.intrack_get_my_identity() to authenticated;
create function public.intrack_invalidate_coordinator_sessions(subject uuid,reason text) returns void language plpgsql security definer set search_path='' as $$
declare person intrack.profiles%rowtype;
begin
 select * into person from intrack.profiles where auth_user_id=subject for update;
 if not found or not exists(select 1 from intrack.bootstrap_requests where profile_id=person.id) or not exists(select 1 from intrack.memberships where profile_id=person.id and role='coordinator' and active) then raise exception 'Bootstrapped coordinator required' using errcode='42501';end if;
 if coalesce(length(trim(reason)),0) not between 1 and 1000 then raise exception 'Recovery reason required' using errcode='22023';end if;
 insert into intrack.account_session_guards(profile_id,not_before_epoch) values(person.id,floor(extract(epoch from clock_timestamp()))::bigint)
  on conflict(profile_id) do update set not_before_epoch=excluded.not_before_epoch,updated_at=now();
 delete from auth.sessions where user_id=subject;
 insert into intrack.audit_events(entity_type,entity_id,action,command_id,details) values('profile',person.id,'operator_coordinator_sessions_invalidated',gen_random_uuid(),jsonb_build_object('reason',reason));
end $$;
revoke all on function public.intrack_invalidate_coordinator_sessions(uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_invalidate_coordinator_sessions(uuid,text) to service_role;
commit;
