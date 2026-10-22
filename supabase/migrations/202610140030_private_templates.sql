begin;
-- Upload reservations are separate from published assets: no invented hashes.
create table intrack.template_uploads (
 id uuid primary key default gen_random_uuid(), program_id uuid not null references intrack.programs(id),
 reserved_by uuid not null references intrack.profiles(id), code text not null, title text not null,
 stage text not null check(stage in ('pre','during','post','portfolio','evaluation')),
 original_name text not null, object_path text not null unique,
 byte_count bigint not null check(byte_count between 1 and 10485760),
 measured_hash text check(measured_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'pending' check(state in ('pending','validated','published')),
 expires_at timestamptz not null default now()+interval '30 minutes',
 template_id uuid references intrack.template_versions(id)
);
alter table intrack.template_uploads enable row level security;
revoke all on intrack.template_uploads from public,anon,authenticated;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('ojt-templates','ojt-templates',false,10485760,array['application/pdf'])
 on conflict(id) do nothing;

create function public.intrack_template_command(command_id uuid,action text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; program uuid; receipt jsonb; upload intrack.template_uploads%rowtype;
 asset intrack.template_versions%rowtype; key uuid; next_version integer; result jsonb;
begin
 select id into program from intrack.programs where code=payload->>'programCode';
 actor:=intrack.authorized_actor('coordinator',program);
 if program is null then raise exception 'Program required' using errcode='22023';end if;
 receipt:=intrack.begin_command(actor,command_id,'template:'||action,payload);
 if receipt is not null then return receipt;end if;
 if action='reserve' then
  if coalesce(payload->>'code','') !~ '^[A-Z0-9][A-Z0-9_-]{0,79}$'
   or coalesce(length(trim(payload->>'title')),0) not between 1 and 240
   or coalesce(length(trim(payload->>'name')),0) not between 1 and 240
   or payload->>'stage' not in ('pre','during','post','portfolio','evaluation')
   or payload->>'mimeType' is distinct from 'application/pdf'
   or coalesce((payload->>'bytes')::bigint,0) not between 1 and 10485760 then
   raise exception 'Bounded PDF template metadata required' using errcode='22023';end if;
  if (select count(*) from intrack.template_uploads where reserved_by=actor and state<>'published' and expires_at>now())>=20 then
   raise exception 'Resolve existing template uploads first' using errcode='40001';end if;
  insert into intrack.template_uploads(program_id,reserved_by,code,title,stage,original_name,object_path,byte_count)
   values(program,actor,payload->>'code',trim(payload->>'title'),payload->>'stage',trim(payload->>'name'),program::text||'/'||gen_random_uuid()::text,(payload->>'bytes')::bigint) returning * into upload;
  result:=jsonb_build_object('uploadId',upload.id,'path',upload.object_path,'expiresAt',upload.expires_at);
 elsif action='publish' then
  select * into upload from intrack.template_uploads where id=(payload->>'uploadId')::uuid and program_id=program and reserved_by=actor for update;
  if upload.id is null or upload.state<>'validated' or upload.expires_at<=now()
   or coalesce(length(trim(payload->>'approvalReference')),0) not between 1 and 1000 then
   raise exception 'Current validated upload and approval reference required' using errcode='40001';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(program::text||upload.code,0));
  select template_key,version+1 into key,next_version from intrack.template_versions where program_id=program and code=upload.code order by version desc limit 1;
  insert into intrack.template_versions(program_id,template_key,code,title,stage,version,object_path,status,mime_type,byte_count,sha256,published_by,published_at)
   values(program,coalesce(key,gen_random_uuid()),upload.code,upload.title,upload.stage,coalesce(next_version,1),upload.object_path,'published','application/pdf',upload.byte_count,upload.measured_hash,actor,now()) returning * into asset;
  update intrack.template_uploads set state='published',template_id=asset.id where id=upload.id;
  result:=jsonb_build_object('templateId',asset.id,'version',asset.version,'approvalReference',trim(payload->>'approvalReference'));
 elsif action='archive' then
  select * into asset from intrack.template_versions where id=(payload->>'templateId')::uuid and program_id=program for update;
  if asset.id is null or asset.status<>'published' or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Published template and reason required' using errcode='40001';end if;
  update intrack.template_versions set status='archived' where id=asset.id;
  result:=jsonb_build_object('templateId',asset.id,'status','archived','reason',trim(payload->>'reason'));
 else raise exception 'Unsupported template action' using errcode='22023';end if;
 return intrack.finish_command(actor,command_id,'template:'||action,payload,result,'template',coalesce(asset.id,upload.id));
end $$;

create function public.intrack_template_upload_context(upload_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u intrack.template_uploads%rowtype; actor uuid;
begin
 select * into u from intrack.template_uploads where id=upload_id;
 if u.id is null then raise exception 'Upload unavailable' using errcode='42501';end if;
 actor:=intrack.authorized_actor('coordinator',u.program_id);
 if actor<>u.reserved_by or (u.state<>'published' and u.expires_at<=now()) then raise exception 'Upload unavailable' using errcode='42501';end if;
 return jsonb_build_object('path',u.object_path,'bytes',u.byte_count,'state',u.state,'templateId',u.template_id);
end $$;

create function public.intrack_can_upload_template(object_name text)
returns boolean language plpgsql security definer set search_path='' as $$
declare u intrack.template_uploads%rowtype;
begin
 select * into u from intrack.template_uploads where object_path=object_name and state='pending' and expires_at>now();
 if u.id is null then return false;end if;
 return intrack.authorized_actor('coordinator',u.program_id)=u.reserved_by;
exception when insufficient_privilege then return false;
end $$;
create policy insert_reserved_template on storage.objects for insert to authenticated
 with check(bucket_id='ojt-templates' and public.intrack_can_upload_template(name));

create function public.intrack_attest_template(upload_id uuid,measured_bytes bigint,measured_mime text,content_hash text)
returns void language plpgsql security definer set search_path='' as $$
declare u intrack.template_uploads%rowtype;
begin
 select * into u from intrack.template_uploads where id=upload_id for update;
 if u.id is null or u.state<>'pending' or u.expires_at<=now() or measured_bytes is distinct from u.byte_count
  or measured_mime is distinct from 'application/pdf' or coalesce(content_hash,'') !~ '^[a-f0-9]{64}$'
  or not exists(select 1 from storage.objects where bucket_id='ojt-templates' and name=u.object_path) then
  raise exception 'Stored measured PDF required' using errcode='22023';end if;
 update intrack.template_uploads set measured_hash=content_hash,state='validated' where id=u.id;
end $$;

create function public.intrack_list_templates(program_code text,actor_role text,page_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare program uuid; actor uuid; result jsonb;
begin
 select id into program from intrack.programs where code=program_code;
 actor:=intrack.authorized_actor(actor_role,program);
 if program is null or page_offset is null or page_offset<0 then raise exception 'Program and offset required' using errcode='22023';end if;
 select coalesce(jsonb_agg(to_jsonb(t)),'[]') into result from (
  select id,code,title,stage,version,status,byte_count,published_at from intrack.template_versions
  where program_id=program and (status='published' or actor_role='coordinator') order by code,version desc limit 100 offset page_offset)t;
 return result;
end $$;
create function public.intrack_template_file(template_id uuid,actor_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t intrack.template_versions%rowtype; actor uuid;
begin
 select * into t from intrack.template_versions where id=template_id;
 if t.id is null or t.published_at is null then raise exception 'Template unavailable' using errcode='42501';end if;
 actor:=intrack.authorized_actor(actor_role,t.program_id);
 if t.status<>'published' and actor_role<>'coordinator' then raise exception 'Template archived' using errcode='42501';end if;
 insert into intrack.audit_events(actor_id,entity_type,entity_id,action,command_id,details)
 values(actor,'template',t.id,'template_download_grant',gen_random_uuid(),jsonb_build_object('expiresIn',60));
 return jsonb_build_object('path',t.object_path,'name',t.code||'-v'||t.version||'.pdf');
end $$;
revoke all on function public.intrack_template_command(uuid,text,jsonb),public.intrack_template_upload_context(uuid),public.intrack_can_upload_template(text),public.intrack_list_templates(text,text,integer),public.intrack_template_file(uuid,text),public.intrack_attest_template(uuid,bigint,text,text) from public,anon,authenticated;
grant execute on function public.intrack_template_command(uuid,text,jsonb),public.intrack_template_upload_context(uuid),public.intrack_can_upload_template(text),public.intrack_list_templates(text,text,integer),public.intrack_template_file(uuid,text) to authenticated;
grant execute on function public.intrack_attest_template(uuid,bigint,text,text) to service_role;
commit;
