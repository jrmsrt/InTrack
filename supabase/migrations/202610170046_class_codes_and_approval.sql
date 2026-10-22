begin;
alter table intrack.practicum_classes add column join_code text unique,
 add column join_code_enabled boolean not null default true, add column revision integer not null default 0;
-- Codes invite a request only. They never grant enrollment or record access.
create table intrack.class_join_attempts(id bigint generated always as identity primary key,profile_id uuid not null references intrack.profiles(id),attempted_at timestamptz not null default now());
create index class_join_attempt_window on intrack.class_join_attempts(profile_id,attempted_at);
create table intrack.class_join_requests(
 id uuid primary key default gen_random_uuid(),class_id uuid not null references intrack.practicum_classes(id),student_id uuid not null references intrack.profiles(id),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),revision integer not null default 0,
 requested_at timestamptz not null default now(),reviewed_at timestamptz,reviewed_by uuid references intrack.profiles(id),reason text not null default '',
 unique(class_id,student_id)
);
create table intrack.class_join_events(id uuid primary key default gen_random_uuid(),request_id uuid not null references intrack.class_join_requests(id),actor_id uuid not null references intrack.profiles(id),decision text not null,reason text not null default '',created_at timestamptz not null default now());
alter table intrack.class_join_attempts enable row level security;
alter table intrack.class_join_requests enable row level security;
alter table intrack.class_join_events enable row level security;
revoke all on intrack.class_join_attempts,intrack.class_join_requests,intrack.class_join_events from public,anon,authenticated;
create trigger preserve_class_join_history before update or delete on intrack.class_join_events for each row execute function intrack.guard_append_only();

create function public.intrack_create_practicum_class(command_id uuid,actor_role text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<creating>>
declare actor uuid;receipt jsonb;policy intrack.policy_versions%rowtype;term intrack.academic_terms%rowtype;class intrack.practicum_classes%rowtype;section text;candidate text;i integer;
begin
 if actor_role is distinct from 'adviser' then raise exception 'The class adviser must create the class' using errcode='42501';end if;
 select * into policy from intrack.policy_versions where id=(payload->>'policyId')::uuid;
 if not found then raise exception 'Policy unavailable' using errcode='42501';end if;
 actor:=intrack.authorized_actor('adviser',policy.program_id);
 receipt:=intrack.begin_command(actor,command_id,'create_practicum_class',payload);if receipt is not null then return receipt;end if;
 section:=trim(payload->>'section');select * into term from intrack.academic_terms where id=(payload->>'termId')::uuid;
 if not found or term.semester<>policy.semester or policy.confirmed_at is null or term.ends_on<(now() at time zone 'Asia/Manila')::date
 or section is null or section !~ '^[1-9][0-9]*-[1-9][0-9]*$' or split_part(section,'-',1)::integer<>policy.year_level
 or not exists(select 1 from intrack.requirement_definitions where policy_version_id=policy.id)
 or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Published practicum, matching year/term, current term and reason required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class:'||policy.program_id::text||':'||term.id::text||':'||section,0));
 select * into class from intrack.practicum_classes c where c.program_id=policy.program_id and c.term_id=term.id and c.section=creating.section for update;
 if found then
  if class.policy_id<>policy.id or (class.adviser_id is not null and class.adviser_id<>actor) then raise exception 'Class already belongs to another adviser or policy' using errcode='42501';end if;
  if class.adviser_id is null then update intrack.practicum_classes set adviser_id=actor where id=class.id returning * into class;end if;
 else insert into intrack.practicum_classes(program_id,term_id,policy_id,section,adviser_id,created_by) values(policy.program_id,term.id,policy.id,section,actor,actor) returning * into class;end if;
 if class.join_code is null then
  for i in 1..8 loop
   candidate:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
   begin update intrack.practicum_classes set join_code=candidate where id=class.id returning * into class;exit;exception when unique_violation then if i=8 then raise;end if;end;
  end loop;
 end if;
 return intrack.finish_command(actor,command_id,'create_practicum_class',payload,jsonb_build_object('classId',class.id),'practicum_class',class.id);
end $$;

create function public.intrack_class_join_administration(actor_role text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 if actor_role not in ('adviser','coordinator') then raise exception 'Staff role required' using errcode='42501';end if;
 actor:=intrack.authorized_actor(actor_role);
 return jsonb_build_object('classes',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'programId',c.program_id,'termId',c.term_id,'policyId',c.policy_id,'section',c.section,'adviserId',c.adviser_id,'adviserName',p.display_name,'code',case when actor_role='adviser' and c.adviser_id=actor then c.join_code end,'codeEnabled',c.join_code_enabled,'revision',c.revision) order by c.created_at desc),'[]') from intrack.practicum_classes c left join intrack.profiles p on p.id=c.adviser_id where exists(select 1 from intrack.memberships m where m.profile_id=actor and m.program_id=c.program_id and m.role=actor_role and m.active) and (actor_role='coordinator' or c.adviser_id=actor)),
 'requests',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'classId',r.class_id,'studentId',r.student_id,'name',p.display_name,'studentNumber',coalesce(p.student_number,(select es.student_number from intrack.eligible_students es where es.invited_profile_id=p.id and es.program_id=c.program_id limit 1)),'status',r.status,'revision',r.revision,'requestedAt',r.requested_at,'reviewedAt',r.reviewed_at,'reason',r.reason) order by r.requested_at desc),'[]') from intrack.class_join_requests r join intrack.practicum_classes c on c.id=r.class_id join intrack.profiles p on p.id=r.student_id where exists(select 1 from intrack.memberships m where m.profile_id=actor and m.program_id=c.program_id and m.role=actor_role and m.active) and (actor_role='coordinator' or c.adviser_id=actor)));
end $$;

create function public.intrack_manage_class_code(command_id uuid,actor_role text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;receipt jsonb;class intrack.practicum_classes%rowtype;candidate text;i integer;
begin
 select * into class from intrack.practicum_classes where id=(payload->>'classId')::uuid for update;
 if not found or actor_role is distinct from 'adviser' then raise exception 'Class unavailable' using errcode='42501';end if;
 actor:=intrack.authorized_actor('adviser',class.program_id);
 if class.adviser_id is distinct from actor then raise exception 'Only the class adviser can manage its code' using errcode='42501';end if;
 receipt:=intrack.begin_command(actor,command_id,'manage_class_code',payload);if receipt is not null then return receipt;end if;
 if (payload->>'expectedRevision')::integer is distinct from class.revision then raise exception 'Class changed; refresh before changing its code' using errcode='40001';end if;
 if payload->>'action'='reset' then
  for i in 1..8 loop
   candidate:=upper(substr(replace(gen_random_uuid()::text,'-',''),1,10));
   begin update intrack.practicum_classes set join_code=candidate,join_code_enabled=true,revision=revision+1 where id=class.id;exit;exception when unique_violation then if i=8 then raise;end if;end;
  end loop;
 elsif payload->>'action' in ('disable','enable') then update intrack.practicum_classes set join_code_enabled=(payload->>'action'='enable'),revision=revision+1 where id=class.id;
 else raise exception 'Unsupported code action' using errcode='22023';end if;
 return intrack.finish_command(actor,command_id,'manage_class_code',payload,jsonb_build_object('classId',class.id),'practicum_class',class.id);
end $$;

create function public.intrack_request_class_join(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;receipt jsonb;class intrack.practicum_classes%rowtype;request intrack.class_join_requests%rowtype;result jsonb;code text;
begin
 actor:=intrack.authorized_actor('student');
 receipt:=intrack.begin_command(actor,command_id,'request_class_join',payload);if receipt is not null then return receipt;end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('class-code-attempt:'||actor::text,0));
 if (select count(*) from intrack.class_join_attempts where profile_id=actor and attempted_at>now()-interval '1 minute')>=5 then
  return intrack.finish_command(actor,command_id,'request_class_join',payload,jsonb_build_object('accepted',false,'message','Too many class-code attempts. Wait one minute and try again.'),'profile',actor);
 end if;
 insert into intrack.class_join_attempts(profile_id) values(actor);
 code:=upper(trim(payload->>'code'));
 select c.* into class from intrack.practicum_classes c join intrack.academic_terms t on t.id=c.term_id
 where c.join_code=code and c.join_code_enabled and c.adviser_id is not null and t.ends_on>=(now() at time zone 'Asia/Manila')::date for share of c;
 result:=jsonb_build_object('accepted',false,'message','This code is unavailable or your account is not eligible for this class. Check with your adviser.');
 if class.id is not null and exists(select 1 from intrack.memberships m join intrack.eligible_students es on es.invited_profile_id=m.profile_id and es.program_id=m.program_id where m.profile_id=actor and m.program_id=class.program_id and m.role='student' and m.active and es.section=class.section)
 and exists(select 1 from intrack.memberships m join intrack.profiles p on p.id=m.profile_id where m.profile_id=class.adviser_id and m.program_id=class.program_id and m.role='adviser' and m.active and p.status='active')
 and not exists(select 1 from intrack.enrollments e where e.student_id=actor and e.program_id=class.program_id and e.term_id=class.term_id) then
  insert into intrack.class_join_requests(class_id,student_id) values(class.id,actor) on conflict(class_id,student_id) do nothing returning * into request;
  if request.id is not null then
   insert into intrack.class_join_events(request_id,actor_id,decision) values(request.id,actor,'requested');
   insert into intrack.notifications(recipient_id,event_key,content) values(class.adviser_id,command_id::text,jsonb_build_object('kind','class_join_requested','requestId',request.id));
  else select * into request from intrack.class_join_requests r where r.class_id=class.id and r.student_id=actor;end if;
  if request.status='pending' then result:=jsonb_build_object('accepted',true,'requestId',request.id,'message','Join request sent. Your adviser must approve it before your OJT features are enabled.');
  else result:=jsonb_build_object('accepted',false,'message','Your previous request has already been reviewed. Contact your adviser.');end if;
 end if;
 -- Failed attempts return a result rather than rolling back their rate limit.
 return intrack.finish_command(actor,command_id,'request_class_join',payload,result,'profile',actor);
end $$;

create function public.intrack_my_class_join_requests()
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;
begin
 actor:=intrack.authorized_actor('student');
 return (select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'section',c.section,'programCode',p.code,'academicYear',t.academic_year,'semester',t.semester,'adviserName',a.display_name,'requestedAt',r.requested_at,'reviewedAt',r.reviewed_at,'reason',r.reason) order by r.requested_at desc),'[]') from intrack.class_join_requests r join intrack.practicum_classes c on c.id=r.class_id join intrack.programs p on p.id=c.program_id join intrack.academic_terms t on t.id=c.term_id join intrack.profiles a on a.id=c.adviser_id where r.student_id=actor and exists(select 1 from intrack.memberships m where m.profile_id=actor and m.program_id=c.program_id and m.role='student' and m.active));
end $$;

-- Manual adviser enrollment is no longer public: only approval may call it.
alter function public.intrack_enroll_practicum_class(uuid,text,jsonb) set schema intrack;
revoke all on function intrack.intrack_enroll_practicum_class(uuid,text,jsonb) from public,anon,authenticated;
create function public.intrack_enroll_practicum_class(command_id uuid,actor_role text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if actor_role is distinct from 'coordinator' then raise exception 'Advisers enroll students by approving a class-code request' using errcode='42501';end if;
 return intrack.intrack_enroll_practicum_class(command_id,actor_role,payload);
end $$;
revoke all on function public.intrack_enroll_practicum_class(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_enroll_practicum_class(uuid,text,jsonb) to authenticated;

create function public.intrack_review_class_join(command_id uuid,actor_role text,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid;receipt jsonb;request intrack.class_join_requests%rowtype;class intrack.practicum_classes%rowtype;enrolled jsonb;decision text;review_reason text;
begin
 -- Lock class before request, matching class enrollment and code management.
 select c.* into class from intrack.practicum_classes c join intrack.class_join_requests r on r.class_id=c.id where r.id=(payload->>'requestId')::uuid for update of c;
 if not found or actor_role is distinct from 'adviser' then raise exception 'Adviser request unavailable' using errcode='42501';end if;
 actor:=intrack.authorized_actor('adviser',class.program_id);
 if class.adviser_id is distinct from actor then raise exception 'Only the class adviser can approve requests' using errcode='42501';end if;
 receipt:=intrack.begin_command(actor,command_id,'review_class_join',payload);if receipt is not null then return receipt;end if;
 select * into request from intrack.class_join_requests where id=(payload->>'requestId')::uuid for update;
 decision:=payload->>'decision';review_reason:=trim(payload->>'reason');
 if (request.status<>'pending' and not (request.status='rejected' and decision='approve')) or (payload->>'expectedRevision')::integer is distinct from request.revision then raise exception 'Request already reviewed or changed; refresh' using errcode='40001';end if;
 if decision is null or decision not in ('approve','reject') or coalesce(length(review_reason),0) not between 1 and 1000 then raise exception 'Decision and review reason required' using errcode='22023';end if;
 if decision='approve' then
  if exists(select 1 from intrack.academic_terms t where t.id=class.term_id and t.ends_on<(now() at time zone 'Asia/Manila')::date) then raise exception 'Term has ended; enrollment is closed' using errcode='40001';end if;
  enrolled:=intrack.intrack_enroll_practicum_class(gen_random_uuid(),'adviser',jsonb_build_object('policyId',class.policy_id,'termId',class.term_id,'section',class.section,'studentIds',jsonb_build_array(request.student_id),'reason',review_reason));
 end if;
 update intrack.class_join_requests set status=case decision when 'approve' then 'approved' else 'rejected' end,revision=revision+1,reviewed_by=actor,reviewed_at=now(),reason=review_reason where id=request.id;
 insert into intrack.class_join_events(request_id,actor_id,decision,reason) values(request.id,actor,decision,review_reason);
 insert into intrack.notifications(recipient_id,event_key,content) values(request.student_id,command_id::text,jsonb_build_object('kind','class_join_'||decision,'requestId',request.id));
 return intrack.finish_command(actor,command_id,'review_class_join',payload,jsonb_build_object('requestId',request.id,'status',case decision when 'approve' then 'approved' else 'rejected' end,'enrollment',enrolled),'class_join_request',request.id);
end $$;

revoke all on function public.intrack_create_practicum_class(uuid,text,jsonb),public.intrack_class_join_administration(text),public.intrack_manage_class_code(uuid,text,jsonb),public.intrack_request_class_join(uuid,jsonb),public.intrack_my_class_join_requests(),public.intrack_review_class_join(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_create_practicum_class(uuid,text,jsonb),public.intrack_class_join_administration(text),public.intrack_manage_class_code(uuid,text,jsonb),public.intrack_request_class_join(uuid,jsonb),public.intrack_my_class_join_requests(),public.intrack_review_class_join(uuid,text,jsonb) to authenticated;
commit;
