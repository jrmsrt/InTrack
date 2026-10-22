begin;
create table intrack.command_rate_windows (
 actor_id uuid primary key references intrack.profiles(id),
 window_start timestamptz not null, accepted integer not null check(accepted between 1 and 300)
);
alter table intrack.command_rate_windows enable row level security;
revoke all on intrack.command_rate_windows from public,anon,authenticated;
-- A technical burst ceiling, independent of institutional attendance policy.
-- Rolls back with failed commands. Auth/edge request throttling is separate.
create or replace function intrack.begin_command(actor uuid,command_id uuid,action text,payload jsonb)
returns jsonb language plpgsql set search_path='' as $$
declare receipt intrack.command_receipts%rowtype; fingerprint text; accepted integer;
begin
 if actor is null or command_id is null or payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>524288 then raise exception 'Invalid or oversized command' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(actor::text||command_id::text,0));
 fingerprint:=md5(jsonb_build_object('action',action,'payload',payload)::text);
 select * into receipt from intrack.command_receipts r where r.actor_id=actor and r.command_id=begin_command.command_id;
 if found then
  if receipt.payload_hash<>fingerprint then raise exception 'Command ID payload conflict' using errcode='40001';end if;
  return receipt.result;
 end if;
 insert into intrack.command_rate_windows(actor_id,window_start,accepted) values(actor,clock_timestamp(),1)
 on conflict(actor_id) do update set
  window_start=case when command_rate_windows.window_start<=clock_timestamp()-interval '1 minute' then clock_timestamp() else command_rate_windows.window_start end,
  accepted=case when command_rate_windows.window_start<=clock_timestamp()-interval '1 minute' then 1 else command_rate_windows.accepted+1 end
 where command_rate_windows.window_start<=clock_timestamp()-interval '1 minute' or command_rate_windows.accepted<300
 returning command_rate_windows.accepted into accepted;
 if accepted is null then raise exception 'Too many new commands. Retry after one minute with the same command ID.' using errcode='53300';end if;
 return null;
end $$;

create function public.intrack_export_enrollments(command_id uuid,actor_role text,search_text text default '',page_offset integer default 0)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt jsonb; payload jsonb; report jsonb; result jsonb;
begin
 actor:=intrack.authorized_actor(actor_role);
 if actor_role not in ('adviser','coordinator') then raise exception 'Staff export required' using errcode='42501';end if;
 payload:=jsonb_build_object('role',actor_role,'search',search_text,'offset',page_offset);
 receipt:=intrack.begin_command(actor,command_id,'export_enrollments',payload);
 if receipt is not null then
  report:=public.intrack_list_enrollments(actor_role);
  if exists(select 1 from jsonb_array_elements(receipt->'items') saved where not exists(
   select 1 from jsonb_array_elements(report) current_row where current_row->>'id'=saved->>'id')) then
   raise exception 'Export scope changed. Create a new scoped export.' using errcode='42501';end if;
  return receipt;
 end if;
 report:=public.intrack_enrollment_report(actor_role,search_text,page_offset,100);
 select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
  'id',e->>'id','studentName',e->>'studentName','programCode',e->>'programCode',
  'component',e->'component','lifecycle',e->>'lifecycle','outcome',e->>'outcome',
  'requiredMinutes',e->'requiredMinutes','creditedMinutes',e->'creditedMinutes','remainingMinutes',e->'remainingMinutes',
  'clearance',e->>'clearance','moaStatus',e->>'moaStatus')),'[]'),'nextOffset',report->'nextOffset','generatedAt',now()) into result
  from jsonb_array_elements(report->'items') e;
 -- Receipt contains the exact authorized snapshot; audit avoids personal rows.
 insert into intrack.audit_events(actor_id,entity_type,entity_id,action,command_id,details)
  values(actor,'report',command_id,'export_enrollments',command_id,jsonb_build_object('rowCount',jsonb_array_length(result->'items'),'offset',page_offset));
 insert into intrack.command_receipts(actor_id,command_id,payload_hash,result)
  values(actor,command_id,md5(jsonb_build_object('action','export_enrollments','payload',payload)::text),result);
 return result;
end $$;

create function public.intrack_operator_health()
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('checkedAt',clock_timestamp(),'database','reachable','emailDelivery','paused',
  'currentNoticeConfigured',exists(select 1 from intrack.identity_configuration where current_notice_version is not null),
  'publishedPolicies',(select count(*) from intrack.policy_versions where confirmed_at is not null),
  'programsWithoutDomains',(select count(*) from intrack.programs p where not exists(select 1 from intrack.program_configuration c where c.program_id=p.id and cardinality(c.student_email_domains)>0 and cardinality(c.staff_email_domains)>0)),
  'expiredRequirementUploads',(select count(*) from intrack.requirement_uploads u join intrack.documents d on d.id=u.document_id where u.expires_at<=now() and d.status='pending'),
  'expiredTemplateUploads',(select count(*) from intrack.template_uploads where expires_at<=now() and state<>'published'),
  'pendingEmailDeliveries',(select count(*) from intrack.notification_outbox where delivered_at is null),
  'failedEmailDeliveries',(select count(*) from intrack.notification_outbox where delivered_at is null and last_error_code is not null),
  'unresolvedAttendance',(select count(*) from intrack.attendance_sessions where status in ('open','disputed')));
$$;
revoke all on function public.intrack_export_enrollments(uuid,text,text,integer),public.intrack_operator_health() from public,anon,authenticated;
grant execute on function public.intrack_export_enrollments(uuid,text,text,integer) to authenticated;
grant execute on function public.intrack_operator_health() to service_role;
commit;
