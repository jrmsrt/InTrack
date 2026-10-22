begin;
-- Every write locks enrollment before dependent rows. No client table grants.
create function intrack.current_clearance(target uuid) returns text language sql stable security definer set search_path='' as $$
 select coalesce((select to_clearance from intrack.enrollment_events where enrollment_id=target order by after_revision desc limit 1),
 (select status from intrack.clearance_events where enrollment_id=target order by enrollment_revision desc limit 1),'not_issued')
$$;
create function intrack.json_hash(value jsonb) returns text language sql immutable set search_path='' as $$select encode(sha256(convert_to(value::text,'UTF8')),'hex')$$;
create function intrack.gps_valid(gps jsonb, placement intrack.placements, settings jsonb, received timestamptz)
returns boolean language plpgsql stable set search_path='' as $$
declare lat double precision; lon double precision; accuracy double precision; age double precision; a double precision;
begin
 if jsonb_typeof(gps) is distinct from 'object' then return false;end if;
 lat:=(gps->>'latitude')::double precision;lon:=(gps->>'longitude')::double precision;accuracy:=(gps->>'accuracyMeters')::double precision;
 age:=extract(epoch from received-(gps->>'capturedAt')::timestamptz);
 if lat is null or lon is null or accuracy is null or age is null or lat not between -90 and 90 or lon not between -180 and 180
 or accuracy not between 0 and (settings->>'maxAccuracyMeters')::double precision or age not between 0 and (settings->>'maxCoordinateAgeSeconds')::integer
 or placement.latitude is null or placement.longitude is null or placement.radius_meters is null then return false;end if;
 a:=power(sin(radians(lat-placement.latitude)/2),2)+cos(radians(lat))*cos(radians(placement.latitude))*power(sin(radians(lon-placement.longitude)/2),2);
 return 6371000*2*asin(sqrt(least(1,greatest(0,a))))+accuracy<=placement.radius_meters;
exception when invalid_text_representation or datetime_field_overflow then return false;
end $$;
-- Resolve the historical shift, including an overnight shift started yesterday.
create function intrack.schedule_allows(schedule jsonb, instant timestamptz) returns boolean language plpgsql stable set search_path='' as $$
declare local_time timestamp:=instant at time zone 'Asia/Manila'; anchor date; start_time timestamp; end_time timestamp; offset_day integer;
begin
 for offset_day in 0..1 loop
  anchor:=local_time::date-offset_day;
  if not coalesce(schedule->'weekdays','[]'::jsonb) @> jsonb_build_array(extract(isodow from anchor)::integer) then continue;end if;
  start_time:=anchor+(schedule->>'start')::time;end_time:=anchor+(schedule->>'end')::time;
  if end_time<=start_time then if (schedule->>'overnight')::boolean is distinct from true then continue;end if;end_time:=end_time+interval '1 day';end if;
  if local_time>=start_time and local_time<end_time then return true;end if;
 end loop;return false;
end $$;

create function public.intrack_attendance_command(command_id uuid, action text, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; p intrack.placements%rowtype; s intrack.attendance_sessions%rowtype; settings jsonb; actor uuid; receipt jsonb;
 received timestamptz:=clock_timestamp(); exception_id uuid; schedule_exception uuid; training boolean; next_status text; reason_code text; output jsonb;
begin
 if action not in ('clock_in','clock_out') then raise exception 'Unsupported attendance action' using errcode='22023';end if;
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,'student');
 receipt:=intrack.begin_command(actor,command_id,'attendance:'||action,payload);if receipt is not null then return receipt;end if;
 if (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Stale enrollment' using errcode='40001';end if;
 if action='clock_in' then
  select * into p from intrack.placements where enrollment_id=e.id and active for share;
  select attendance_policy into settings from intrack.policy_versions where id=e.policy_version_id and confirmed_at is not null;
  if e.outcome<>'active' or e.lifecycle<>'during_ojt' or intrack.current_clearance(e.id)<>'active' or p.id is null or (settings->>'confirmed')::boolean is distinct from true then
    raise exception 'Active clearance, placement and confirmed policy required' using errcode='40001';end if;
  if exists(select 1 from intrack.attendance_sessions where enrollment_id=e.id and clock_out_at is null and status<>'void') then raise exception 'Resolve the existing session' using errcode='40001';end if;
  if p.starts_on>(received at time zone 'Asia/Manila')::date or (p.ends_on is not null and p.ends_on<(received at time zone 'Asia/Manila')::date) then raise exception 'Placement date unavailable' using errcode='40001';end if;
 else
  select * into s from intrack.attendance_sessions where id=(payload->>'sessionId')::uuid and enrollment_id=e.id for update;
  if s.id is null or s.clock_out_at is not null or s.status not in ('open','disputed') or (payload->>'expectedSessionRevision')::integer is distinct from s.revision then raise exception 'Current unresolved session required' using errcode='40001';end if;
  select * into p from intrack.placements where id=s.placement_id for share;settings:=s.policy_snapshot->'attendance';
  if received<=s.clock_in_at or received>s.clock_in_at+make_interval(mins=>(settings->>'maxSessionMinutes')::integer) then raise exception 'Interval requires evidenced correction' using errcode='40001';end if;
 end if;
 select id into exception_id from intrack.attendance_exceptions where enrollment_id=e.id and placement_id=p.id and kind='location' and status='approved'
  and action=any(allowed_actions) and received between starts_at and ends_at order by ends_at limit 1 for share;
 select id into schedule_exception from intrack.attendance_exceptions where enrollment_id=e.id and placement_id=p.id and kind='schedule' and status='approved'
  and action=any(allowed_actions) and received between starts_at and ends_at order by ends_at limit 1 for share;
 if exception_id is null and not intrack.gps_valid(payload->'gps',p,settings,received) then reason_code:='location_invalid';end if;
 if action='clock_in' and schedule_exception is null and not intrack.schedule_allows(p.schedule_snapshot,received) then reason_code:='schedule_invalid';end if;
 if reason_code is not null then
  insert into intrack.attendance_attempts(enrollment_id,actor_id,action,session_id,command_id,reason_code,gps_evidence,received_at)
   values(e.id,actor,action,s.id,command_id,reason_code,payload->'gps',received);
  return intrack.finish_command(actor,command_id,'attendance:'||action,payload,jsonb_build_object('accepted',false,'reason',reason_code),'enrollment',e.id,e.id);
 end if;
 if action='clock_in' then
  insert into intrack.attendance_sessions(enrollment_id,placement_id,clock_in_at,original_clock_in_at,attendance_date,gps_in,policy_snapshot,authority_snapshot,status)
   values(e.id,p.id,received,received,(received at time zone 'Asia/Manila')::date,payload->'gps',jsonb_build_object('attendance',settings,'schedule',p.schedule_snapshot),
    jsonb_build_object('clearance','active','placementRevision',p.revision,'location_exception_id',exception_id,'schedule_exception_id',schedule_exception),'open') returning * into s;
 else
  training:=e.outcome='active' and e.lifecycle='during_ojt' and intrack.current_clearance(e.id)='active' and p.active and s.status='open';
  next_status:=case when training then 'pending' else 'disputed' end;
  update intrack.attendance_sessions set clock_out_at=received,original_clock_out_at=received,gps_out=payload->'gps',status=next_status,revision=revision+1 where id=s.id returning * into s;
 end if;
 insert into intrack.attendance_session_revisions(enrollment_id,session_id,revision,origin,actor_id,command_id,reason,frozen_snapshot)
  values(e.id,s.id,s.revision,action,actor,command_id,'Server-time attendance',to_jsonb(s));
 update intrack.enrollments set revision=revision+1 where id=e.id;
 output:=jsonb_build_object('accepted',true,'sessionId',s.id,'sessionRevision',s.revision,'enrollmentRevision',e.revision+1,'status',s.status,'receivedAt',received);
 return intrack.finish_command(actor,command_id,'attendance:'||action,payload,output,'attendance',s.id,e.id,e.revision,e.revision+1);
end $$;

create function public.intrack_attendance_exception(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; actor uuid; receipt jsonb; x intrack.attendance_exceptions%rowtype; action text:=payload->>'action'; id uuid;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='request' then 'student' else 'coordinator' end);
 receipt:=intrack.begin_command(actor,command_id,'attendance_exception',payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Current active enrollment and reason required' using errcode='40001';end if;
 if action='request' then
  if not exists(select 1 from intrack.placements where id=(payload->>'placementId')::uuid and enrollment_id=e.id and active) then raise exception 'Current placement required' using errcode='42501';end if;
  if (payload->>'endsAt')::timestamptz>(payload->>'startsAt')::timestamptz+interval '31 days' then raise exception 'Bounded exception dates required' using errcode='22023';end if;
  insert into intrack.attendance_exceptions(enrollment_id,placement_id,kind,allowed_actions,starts_at,ends_at,status,requested_by,reason)
   values(e.id,(payload->>'placementId')::uuid,payload->>'kind',array(select jsonb_array_elements_text(payload->'allowedActions')),(payload->>'startsAt')::timestamptz,(payload->>'endsAt')::timestamptz,'pending',actor,trim(payload->>'reason')) returning attendance_exceptions.id into id;
 elsif action in ('approve','reject','revoke') then
  select * into x from intrack.attendance_exceptions where attendance_exceptions.id=(payload->>'exceptionId')::uuid and enrollment_id=e.id for update;
  if x.id is null or x.requested_by=actor or actor=e.student_id or (payload->>'expectedExceptionRevision')::integer is distinct from x.revision or
   (action='revoke' and x.status<>'approved') or (action<>'revoke' and x.status<>'pending') then raise exception 'Current other-user exception required' using errcode='40001';end if;
  update intrack.attendance_exceptions set status=case action when 'approve' then 'approved' when 'reject' then 'rejected' else 'revoked' end,
   decided_by=actor,decided_at=now(),decision_reason=trim(payload->>'reason'),revision=revision+1 where attendance_exceptions.id=x.id;id:=x.id;
 else raise exception 'Unsupported exception action' using errcode='22023';end if;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'attendance_exception',payload,jsonb_build_object('exceptionId',id,'enrollmentRevision',e.revision+1),'attendance_exception',id,e.id,e.revision,e.revision+1);
end $$;

create function public.intrack_list_attendance(enrollment_id uuid,actor_role text, before_date date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; result jsonb;
begin
 actor:=intrack.enrollment_actor(enrollment_id,actor_role);
 select coalesce(jsonb_agg(to_jsonb(s) order by s.clock_in_at desc,s.id),'[]') into result from
  (select * from intrack.attendance_sessions where attendance_sessions.enrollment_id=intrack_list_attendance.enrollment_id and (before_date is null or attendance_date<before_date) order by clock_in_at desc,id limit 100) s;
 return jsonb_build_object('sessions',result,'exceptions',coalesce((select jsonb_agg(to_jsonb(x)) from intrack.attendance_exceptions x where x.enrollment_id=intrack_list_attendance.enrollment_id and x.status in ('pending','approved')),'[]'::jsonb));
end $$;
revoke all on function intrack.current_clearance(uuid),intrack.json_hash(jsonb),intrack.gps_valid(jsonb,intrack.placements,jsonb,timestamptz),intrack.schedule_allows(jsonb,timestamptz) from public,anon,authenticated;
revoke all on function public.intrack_attendance_command(uuid,text,jsonb),public.intrack_attendance_exception(uuid,jsonb),public.intrack_list_attendance(uuid,text,date) from public,anon,authenticated;
grant execute on function public.intrack_attendance_command(uuid,text,jsonb),public.intrack_attendance_exception(uuid,jsonb),public.intrack_list_attendance(uuid,text,date) to authenticated;
commit;
