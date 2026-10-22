begin;
create or replace function public.intrack_configure_placement(command_id uuid, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e intrack.enrollments%rowtype; actor uuid; receipt jsonb; company uuid; placement uuid; schedule jsonb; day integer; item jsonb; clearance text; shift_start timestamp; shift_end timestamp; break_start timestamp; break_end timestamp; break_ranges tsrange[]:=array[]::tsrange[]; previous tsrange;
begin
  select * into e from intrack.enrollments where id=(payload->>'enrollmentId')::uuid for update;
  if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
  actor:=intrack.enrollment_actor(e.id,'coordinator');receipt:=intrack.begin_command(actor,command_id,'configure_placement',payload);if receipt is not null then return receipt;end if;
  if e.outcome<>'active' or actor=e.student_id or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Closed, self or stale enrollment' using errcode='40001';end if;
  select c.status into clearance from intrack.clearance_events c where c.enrollment_id=e.id order by c.enrollment_revision desc limit 1;
  if clearance in ('active','suspended') or exists(select 1 from intrack.attendance_sessions where enrollment_id=e.id and clock_out_at is null and status<>'void') then raise exception 'Revoke clearance and resolve open attendance before changing placement' using errcode='40001';end if;
  if coalesce(length(trim(payload->>'companyName')),0) not between 1 and 240 or coalesce(length(trim(payload->>'companyAddress')),0) not between 1 and 1000
    or coalesce(length(trim(payload->>'approvalReference')),0) not between 1 and 1000
    or (payload->>'latitude')::double precision is null or (payload->>'longitude')::double precision is null
    or (payload->>'latitude')::double precision not between -90 and 90 or (payload->>'longitude')::double precision not between -180 and 180
    or coalesce((payload->>'radiusMeters')::integer,0) not between 1 and 100000 or (payload->>'startsOn')::date is null then raise exception 'Approved company, dates and geofence required' using errcode='22023';end if;
  schedule:=payload->'schedule';
  if jsonb_typeof(schedule) is distinct from 'object' or jsonb_typeof(schedule->'weekdays') is distinct from 'array' or jsonb_array_length(schedule->'weekdays')=0
    or coalesce(schedule->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(schedule->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
    or jsonb_typeof(schedule->'breaks') is distinct from 'array' then raise exception 'Explicit approved schedule and breaks required' using errcode='22023';end if;
  for day in select value::text::integer from jsonb_array_elements(schedule->'weekdays') loop
    if day not between 1 and 7 then raise exception 'Weekdays use ISO 1–7' using errcode='22023';end if;
  end loop;
  if (schedule->>'end')::time <= (schedule->>'start')::time and coalesce((schedule->>'overnight')::boolean,false)<>true then raise exception 'Overnight schedule requires explicit approval' using errcode='22023';end if;
  shift_start:=date '2000-01-01'+(schedule->>'start')::time;shift_end:=date '2000-01-01'+(schedule->>'end')::time;
  if shift_end<=shift_start then shift_end:=shift_end+interval '1 day';end if;
  for item in select value from jsonb_array_elements(schedule->'breaks') loop
    if coalesce(item->>'start','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(item->>'end','') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Explicit break intervals required' using errcode='22023';end if;
    if jsonb_typeof(item->'paid') is distinct from 'boolean' then raise exception 'Each approved break must explicitly state paid true or false' using errcode='22023';end if;
    break_start:=date '2000-01-01'+(item->>'start')::time;break_end:=date '2000-01-01'+(item->>'end')::time;
    if (schedule->>'overnight')::boolean is true and break_start<shift_start then break_start:=break_start+interval '1 day';end if;
    if break_end<=break_start then break_end:=break_end+interval '1 day';end if;
    if break_start<shift_start or break_end>shift_end or break_end<=break_start then raise exception 'Break must lie inside the approved shift' using errcode='22023';end if;
    foreach previous in array break_ranges loop if previous&&tsrange(break_start,break_end,'[)') then raise exception 'Configured break windows must not overlap' using errcode='22023';end if;end loop;
    break_ranges:=array_append(break_ranges,tsrange(break_start,break_end,'[)'));
  end loop;
  update intrack.placements set active=false,revision=revision+1 where enrollment_id=e.id and active;
  insert into intrack.companies(name,address) values(trim(payload->>'companyName'),trim(payload->>'companyAddress')) returning id into company;
  insert into intrack.placements(enrollment_id,company_id,starts_on,ends_on,active,latitude,longitude,radius_meters,schedule_snapshot)
    values(e.id,company,(payload->>'startsOn')::date,(payload->>'endsOn')::date,true,(payload->>'latitude')::double precision,(payload->>'longitude')::double precision,(payload->>'radiusMeters')::integer,
      schedule||jsonb_build_object('approvalReference',payload->>'approvalReference')) returning id into placement;
  update intrack.enrollments set revision=revision+1 where id=e.id;
  return intrack.finish_command(actor,command_id,'configure_placement',payload,jsonb_build_object('placementId',placement,'revision',e.revision+1),'placement',placement,e.id,e.revision,e.revision+1);
end $$;
revoke all on function public.intrack_configure_placement(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_configure_placement(uuid,jsonb) to authenticated;


commit;
