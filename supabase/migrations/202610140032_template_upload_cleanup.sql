begin;
alter table intrack.template_uploads drop constraint template_uploads_state_check;
alter table intrack.template_uploads add constraint template_uploads_state_check check(state in ('pending','validated','published','expired'));
alter table intrack.template_uploads add column cleaned_at timestamptz;

create function public.intrack_claim_template_cleanup(batch_size integer default 50)
returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if batch_size is null or batch_size not between 1 and 100 then raise exception 'Bounded cleanup batch required' using errcode='22023';end if;
 with candidates as (select id from intrack.template_uploads where expires_at<=now() and state in ('pending','validated','expired') and cleaned_at is null order by expires_at,id limit batch_size for update skip locked),
 claimed as (update intrack.template_uploads u set state='expired' from candidates c where u.id=c.id returning u.id,u.object_path)
 select coalesce(jsonb_agg(jsonb_build_object('uploadId',id,'path',object_path)),'[]') into result from claimed;
 return result;
end $$;
create function public.intrack_ack_template_cleanup(upload_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare u intrack.template_uploads%rowtype;
begin
 select * into u from intrack.template_uploads where id=upload_id for update;
 if u.id is null or u.state<>'expired' or u.template_id is not null then raise exception 'Claimed expired upload required' using errcode='22023';end if;
 if u.cleaned_at is not null then return;end if;
 if exists(select 1 from storage.objects where bucket_id='ojt-templates' and name=u.object_path) then raise exception 'Stored object deletion must be confirmed first' using errcode='40001';end if;
 update intrack.template_uploads set cleaned_at=now() where id=u.id;
 insert into intrack.audit_events(entity_type,entity_id,action,command_id,details)
 values('template_upload',u.id,'expired_template_cleanup',gen_random_uuid(),jsonb_build_object('expiredAt',u.expires_at));
end $$;
revoke all on function public.intrack_claim_template_cleanup(integer),public.intrack_ack_template_cleanup(uuid) from public,anon,authenticated;
grant execute on function public.intrack_claim_template_cleanup(integer),public.intrack_ack_template_cleanup(uuid) to service_role;
create or replace function public.intrack_operator_health()
returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('checkedAt',clock_timestamp(),'database','reachable','emailDelivery','paused','authEmailDelivery','configured_in_supabase_auth',
  'currentNoticeConfigured',exists(select 1 from intrack.identity_configuration where current_notice_version is not null),
  'publishedPolicies',(select count(*) from intrack.policy_versions where confirmed_at is not null),
  'programsWithoutDomains',(select count(*) from intrack.programs p where not exists(select 1 from intrack.program_configuration c where c.program_id=p.id and cardinality(c.student_email_domains)>0 and cardinality(c.staff_email_domains)>0)),
  'expiredRequirementUploads',(select count(*) from intrack.requirement_uploads u join intrack.documents d on d.id=u.document_id where u.expires_at<=now() and d.status='pending'),
  'expiredTemplateUploads',(select count(*) from intrack.template_uploads where expires_at<=now() and state<>'published' and cleaned_at is null),
  'pendingEmailDeliveries',(select count(*) from intrack.notification_outbox where delivered_at is null),
  'failedEmailDeliveries',(select count(*) from intrack.notification_outbox where delivered_at is null and last_error_code is not null),
  'unresolvedAttendance',(select count(*) from intrack.attendance_sessions where status in ('open','disputed')));
$$;
commit;
