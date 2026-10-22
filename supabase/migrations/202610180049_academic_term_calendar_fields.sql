begin;
-- Calendar dates and the authenticated actor identify a term creation.
-- An additional prose reference is no longer a prerequisite for saving it.
create or replace function public.intrack_create_academic_term(command_id uuid, actor_role text, payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; receipt jsonb; term intrack.academic_terms%rowtype; yr text; sem text; start_date date; end_date date;
begin
 if actor_role not in ('coordinator','adviser') then raise exception 'Staff role required' using errcode='42501';end if;
 actor:=intrack.authorized_actor(actor_role);
 receipt:=intrack.begin_command(actor,command_id,'create_academic_term',payload);if receipt is not null then return receipt;end if;
 yr:=trim(payload->>'academicYear');sem:=payload->>'semester';start_date:=(payload->>'startsOn')::date;end_date:=(payload->>'endsOn')::date;
 if yr is null or yr !~ '^[0-9]{4}-[0-9]{4}$' or split_part(yr,'-',2)::integer<>split_part(yr,'-',1)::integer+1
 or sem is null or sem not in ('1','2','summer') or start_date is null or end_date is null or end_date<start_date or end_date-start_date>366
 or extract(year from start_date) not between split_part(yr,'-',1)::integer and split_part(yr,'-',2)::integer
 or extract(year from end_date) not between split_part(yr,'-',1)::integer and split_part(yr,'-',2)::integer
 then raise exception 'Academic year, semester and valid dates required' using errcode='22023';end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('term:'||yr||':'||sem,0));
 select * into term from intrack.academic_terms where academic_year=yr and semester=sem;
 if found then
  if term.starts_on<>start_date or term.ends_on<>end_date then raise exception 'This term already exists with different dates. Existing terms are preserved.' using errcode='40001';end if;
 else insert into intrack.academic_terms(academic_year,semester,starts_on,ends_on) values(yr,sem,start_date,end_date) returning * into term;end if;
 return intrack.finish_command(actor,command_id,'create_academic_term',payload,jsonb_build_object('termId',term.id),'academic_term',term.id);
end $$;
notify pgrst,'reload schema';
commit;
