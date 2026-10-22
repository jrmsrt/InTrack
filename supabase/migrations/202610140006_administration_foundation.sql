begin;
-- Owner confirmation on 2026-10-14. Applied baseline and published policies are
-- immutable; only the original, unconfirmed BSOA records receive this label.
update intrack.policy_versions v set semester='2'
from intrack.programs p where v.program_id=p.id and p.code='BSOA' and v.semester is null and v.confirmed_at is null;

create table intrack.program_configuration (
  program_id uuid primary key references intrack.programs(id),
  student_email_domains text[] not null default '{}',
  staff_email_domains text[] not null default '{}',
  approval_reference text not null check(length(trim(approval_reference)) between 1 and 1000),
  updated_at timestamptz not null default now()
);
alter table intrack.program_configuration enable row level security;
revoke all on intrack.program_configuration from public,anon,authenticated;

create function intrack.authorized_actor(actor_role text, target_program uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare identity jsonb; actor uuid;
begin
  if actor_role is null or actor_role not in ('student','adviser','coordinator') then raise exception 'Role required' using errcode='42501'; end if;
  identity:=public.intrack_get_my_identity();
  if identity->>'state' is distinct from 'ready' or not coalesce((identity->'usableRoles') ? actor_role,false) then
    raise exception 'Active account, notice and staff MFA required' using errcode='42501';
  end if;
  actor:=(identity->'profile'->>'id')::uuid;
  perform 1 from auth.users where id=auth.uid() for share;
  perform 1 from intrack.profiles where id=actor for share;
  perform 1 from intrack.identity_configuration where singleton for share;
  perform 1 from intrack.memberships where profile_id=actor and role=actor_role and active and (target_program is null or program_id=target_program) for share;
  if not found then raise exception 'Program scope denied' using errcode='42501'; end if;
  identity:=public.intrack_get_my_identity();
  if identity->>'state' is distinct from 'ready' or not coalesce((identity->'usableRoles') ? actor_role,false) then raise exception 'Account access changed' using errcode='42501'; end if;
  return actor;
end $$;
revoke all on function intrack.authorized_actor(text,uuid) from public,anon,authenticated;

-- Shared command receipt discipline, used only from caller-authorized wrappers.
create function intrack.begin_command(actor uuid, command_id uuid, action text, payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare receipt intrack.command_receipts%rowtype; fingerprint text;
begin
  if command_id is null or payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>524288 then raise exception 'Invalid or oversized command' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||command_id::text,0));
  fingerprint:=md5(jsonb_build_object('action',action,'payload',payload)::text);
  select * into receipt from intrack.command_receipts r where r.actor_id=actor and r.command_id=begin_command.command_id;
  if found then
    if receipt.payload_hash<>fingerprint then raise exception 'Command ID payload conflict' using errcode='40001'; end if;
    return receipt.result;
  end if;
  return null;
end $$;
create function intrack.finish_command(actor uuid, command_id uuid, action text, payload jsonb, result jsonb,
  entity_type text, entity_id uuid, enrollment_id uuid default null, before_revision integer default null, after_revision integer default null)
returns jsonb language plpgsql set search_path='' as $$
begin
  insert into intrack.audit_events(actor_id,enrollment_id,entity_type,entity_id,action,command_id,before_revision,after_revision,details)
    values(actor,enrollment_id,entity_type,entity_id,action,command_id,before_revision,after_revision,result);
  insert into intrack.command_receipts(actor_id,command_id,payload_hash,result)
    values(actor,command_id,md5(jsonb_build_object('action',action,'payload',payload)::text),result);
  return result;
end $$;
revoke all on function intrack.begin_command(uuid,uuid,text,jsonb) from public,anon,authenticated;
revoke all on function intrack.finish_command(uuid,uuid,text,jsonb,jsonb,text,uuid,uuid,integer,integer) from public,anon,authenticated;

-- Trusted administration supplies institution-approved domains. An empty list
-- remains fail-closed; editable Auth metadata is never configuration.
create function public.intrack_configure_email_domains(program_code text, student_domains text[], staff_domains text[], approval_reference text)
returns void language plpgsql security definer set search_path='' as $$
declare program uuid; domain text;
begin
  select id into program from intrack.programs where code=program_code;
  if program is null or coalesce(length(trim(approval_reference)),0) not between 1 and 1000 then raise exception 'Program and approval reference required' using errcode='22023'; end if;
  if student_domains is null or staff_domains is null then raise exception 'Explicit domain lists required' using errcode='22023'; end if;
  foreach domain in array student_domains||staff_domains loop
    if domain is null or domain<>lower(trim(domain)) or domain !~ '^[a-z0-9]([a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$' or domain like '%..%' then raise exception 'Exact email domains required; no wildcards' using errcode='22023'; end if;
  end loop;
  insert into intrack.program_configuration(program_id,student_email_domains,staff_email_domains,approval_reference)
    values(program,student_domains,staff_domains,approval_reference)
    on conflict(program_id) do update set student_email_domains=excluded.student_email_domains,staff_email_domains=excluded.staff_email_domains,approval_reference=excluded.approval_reference,updated_at=now();
  insert into intrack.audit_events(entity_type,entity_id,action,command_id,details)
    values('program',program,'approved_email_domains',gen_random_uuid(),jsonb_build_object('approvalReference',approval_reference));
end $$;
revoke all on function public.intrack_configure_email_domains(text,text[],text[],text) from public,anon,authenticated;
grant execute on function public.intrack_configure_email_domains(text,text[],text[],text) to service_role;

-- Check profile/email association again on commit; normalized preview data is
-- private and actor-bound, not a browser-issued authorization token.
create function intrack.validate_masterlist(actor uuid, rows jsonb)
returns jsonb language plpgsql set search_path='' as $$
<<validation>>
declare row jsonb; clean jsonb:='[]'; issues jsonb:='[]'; index integer:=0;
  number text; email text; name text; section text; program uuid; reason text;
  numbers text[]:='{}'; emails text[]:='{}'; existing intrack.eligible_students%rowtype;
begin
  if rows is null or jsonb_typeof(rows)<>'array' or jsonb_array_length(rows) not between 1 and 500 or octet_length(rows::text)>524288 then raise exception 'Import must contain 1–500 bounded rows' using errcode='22023'; end if;
  for row in select value from jsonb_array_elements(rows) loop
    index:=index+1;reason:=null;
    number:=upper(trim(row->>'studentNumber'));email:=lower(trim(row->>'email'));name:=trim(row->>'name');section:=trim(row->>'section');
    select id into program from intrack.programs where code=upper(trim(row->>'programCode'));
    if program is null or not exists(select 1 from intrack.memberships where profile_id=actor and role='coordinator' and active and program_id=program) then
      reason:='Program is outside coordinator scope';
    elsif coalesce(length(number),0) not between 1 and 40 or coalesce(length(name),0) not between 1 and 240 or coalesce(length(section),0) not between 1 and 80 then
      reason:='Student number, complete name and section required';
    elsif coalesce(email,'') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or not exists(select 1 from intrack.program_configuration c where c.program_id=program and split_part(email,'@',2)=any(c.student_email_domains)) then
      reason:='Institution-approved student email domain required';
    elsif number=any(numbers) or email=any(emails) then reason:='Duplicate identity in batch';
    else
      select * into existing from intrack.eligible_students where student_number=number or eligible_students.email=validation.email;
      if found and (existing.student_number<>number or existing.email<>email or existing.program_id<>program or existing.display_name<>name or existing.section<>section) then
        reason:='Existing identity or masterlist data conflicts; explicit correction required';
      elsif exists(select 1 from intrack.profiles p join auth.users u on u.id=p.auth_user_id where
        (p.student_number=number and u.email is distinct from validation.email) or (u.email=validation.email and p.student_number is distinct from number)) then
        reason:='Existing account association conflicts';
      end if;
    end if;
    numbers:=array_append(numbers,number);emails:=array_append(emails,email);
    if reason is not null then issues:=issues||jsonb_build_array(jsonb_build_object('row',index,'message',reason));
    else clean:=clean||jsonb_build_array(jsonb_build_object('studentNumber',number,'email',email,'name',name,'section',section,'programId',program));end if;
  end loop;
  return jsonb_build_object('rows',clean,'issues',issues);
end $$;
revoke all on function intrack.validate_masterlist(uuid,jsonb) from public,anon,authenticated;

create function public.intrack_preview_masterlist(rows jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; checked jsonb; token uuid; expires timestamptz; existing integer;
begin
  actor:=intrack.authorized_actor('coordinator');checked:=intrack.validate_masterlist(actor,rows);
  if jsonb_array_length(checked->'issues')>0 then return jsonb_build_object('issues',checked->'issues','validationToken',null);end if;
  select count(*) into existing from jsonb_array_elements(checked->'rows') r
    where exists(select 1 from intrack.eligible_students s where s.student_number=r->>'studentNumber' and s.email=r->>'email');
  insert into intrack.import_previews(actor_id,content_hash,normalized_rows,expires_at)
    values(actor,md5((checked->'rows')::text),checked->'rows',now()+interval '15 minutes') returning id,expires_at into token,expires;
  return jsonb_build_object('validationToken',token,'expiresAt',expires,'newCount',jsonb_array_length(rows)-existing,'existingCount',existing,'issues','[]'::jsonb);
end $$;
revoke all on function public.intrack_preview_masterlist(jsonb) from public,anon,authenticated;
grant execute on function public.intrack_preview_masterlist(jsonb) to authenticated;

create function public.intrack_commit_masterlist(command_id uuid, validation_token uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; preview intrack.import_previews%rowtype; receipt jsonb; payload jsonb; checked jsonb; row jsonb; batch uuid;
  imported integer:=0; unchanged integer:=0; reconstructed jsonb;
begin
  actor:=intrack.authorized_actor('coordinator');payload:=jsonb_build_object('validationToken',validation_token);
  receipt:=intrack.begin_command(actor,command_id,'commit_masterlist',payload);if receipt is not null then return receipt;end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('intrack-masterlist-identities',0));
  select * into preview from intrack.import_previews where id=validation_token and actor_id=actor for update;
  if not found or preview.expires_at<=now() or preview.consumed_at is not null then raise exception 'Preview expired or consumed; repeat dry run' using errcode='40001';end if;
  select jsonb_agg(jsonb_build_object('studentNumber',r->>'studentNumber','email',r->>'email','name',r->>'name','section',r->>'section','programCode',p.code))
    into reconstructed from jsonb_array_elements(preview.normalized_rows) r join intrack.programs p on p.id=(r->>'programId')::uuid;
  checked:=intrack.validate_masterlist(actor,reconstructed);
  if jsonb_array_length(checked->'issues')>0 then raise exception 'Masterlist changed or scope revoked; repeat dry run' using errcode='40001';end if;
  for row in select value from jsonb_array_elements(preview.normalized_rows) loop
    perform intrack.authorized_actor('coordinator',(row->>'programId')::uuid);
    if exists(select 1 from intrack.eligible_students s where s.student_number=row->>'studentNumber') then unchanged:=unchanged+1;else imported:=imported+1;end if;
  end loop;
  insert into intrack.import_batches(imported_by,content_hash,row_count,imported_count,unchanged_count)
    values(actor,preview.content_hash,imported+unchanged,imported,unchanged) returning id into batch;
  for row in select value from jsonb_array_elements(preview.normalized_rows) loop
    insert into intrack.eligible_students(program_id,student_number,email,display_name,section,import_batch_id,imported_by)
      values((row->>'programId')::uuid,row->>'studentNumber',row->>'email',row->>'name',row->>'section',batch,actor)
      on conflict(student_number) do nothing;
  end loop;
  update intrack.import_previews set consumed_at=now(),normalized_rows='[]'::jsonb where id=preview.id;
  return intrack.finish_command(actor,command_id,'commit_masterlist',payload,jsonb_build_object('batchId',batch,'imported',imported,'unchanged',unchanged),'import',batch);
end $$;
revoke all on function public.intrack_commit_masterlist(uuid,uuid) from public,anon,authenticated;
grant execute on function public.intrack_commit_masterlist(uuid,uuid) to authenticated;

create function public.intrack_set_membership(command_id uuid, membership_id uuid, expected_revision integer, make_active boolean, reason text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m intrack.memberships%rowtype; actor uuid; payload jsonb; receipt jsonb;
begin
  select * into m from intrack.memberships where id=membership_id for update;
  if not found then raise exception 'Membership unavailable' using errcode='42501';end if;
  actor:=intrack.authorized_actor('coordinator',m.program_id);
  if m.profile_id=actor or m.role='coordinator' then raise exception 'Trusted operator required for self/coordinator changes' using errcode='42501';end if;
  payload:=jsonb_build_object('membershipId',membership_id,'expectedRevision',expected_revision,'active',make_active,'reason',reason);
  receipt:=intrack.begin_command(actor,command_id,'set_membership',payload);if receipt is not null then return receipt;end if;
  if expected_revision is distinct from m.revision then raise exception 'Membership stale' using errcode='40001';end if;
  if make_active is null or coalesce(length(trim(reason)),0) not between 1 and 1000 then raise exception 'State and reason required' using errcode='22023';end if;
  update intrack.memberships set active=make_active,revision=revision+1,change_reason=trim(reason),
    revoked_by=case when make_active then null else actor end,revoked_at=case when make_active then null else now() end,
    granted_by=case when make_active then actor else granted_by end where id=m.id;
  return intrack.finish_command(actor,command_id,'set_membership',payload,jsonb_build_object('membershipId',m.id,'active',make_active,'revision',m.revision+1),'membership',m.id,null,m.revision,m.revision+1);
end $$;
revoke all on function public.intrack_set_membership(uuid,uuid,integer,boolean,text) from public,anon,authenticated;
grant execute on function public.intrack_set_membership(uuid,uuid,integer,boolean,text) to authenticated;

create function public.intrack_acknowledge_notice(notice_version text)
returns void language plpgsql security definer set search_path='' as $$
declare person intrack.profiles%rowtype; current_version text;
begin
  select * into person from intrack.profiles where auth_user_id=auth.uid() for share;
  if not found or person.status<>'active' or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and deleted_at is null and (banned_until is null or banned_until<=now())) then raise exception 'Active verified identity required' using errcode='42501';end if;
  select current_notice_version into current_version from intrack.identity_configuration where singleton for share;
  if current_version is null or current_version is distinct from notice_version then raise exception 'Current notice required' using errcode='40001';end if;
  insert into intrack.privacy_acknowledgments(profile_id,notice_version) values(person.id,notice_version) on conflict do nothing;
end $$;
revoke all on function public.intrack_acknowledge_notice(text) from public,anon,authenticated;
grant execute on function public.intrack_acknowledge_notice(text) to authenticated;
commit;
