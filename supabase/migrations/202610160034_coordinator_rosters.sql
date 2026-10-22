begin;
create table intrack.adviser_roster_details (
  membership_id uuid primary key references intrack.memberships(id),
  phone text not null default '' check(length(phone)<=80),
  sections text[] not null default '{}' check(cardinality(sections)<=30),
  revision integer not null default 0 check(revision>=0)
);
alter table intrack.adviser_roster_details enable row level security;
revoke all on intrack.adviser_roster_details from public,anon,authenticated;

create function public.intrack_save_adviser_roster_details(command_id uuid,membership_id uuid,expected_revision integer,phone text,sections text[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare m intrack.memberships%rowtype; actor uuid; current_revision integer; receipt jsonb; payload jsonb;
begin
  select * into m from intrack.memberships where id=membership_id for share;
  if not found or m.role<>'adviser' or not m.active then raise exception 'Active adviser membership required' using errcode='42501';end if;
  actor:=intrack.authorized_actor('coordinator',m.program_id);
  if m.profile_id=actor then raise exception 'Self modification is unavailable' using errcode='42501';end if;
  if phone is null or length(phone)>80 or sections is null or cardinality(sections)>30 or exists(select 1 from unnest(sections) s where s is null or length(trim(s)) not between 1 and 80) then raise exception 'Bounded contact details required' using errcode='22023';end if;
  payload:=jsonb_build_object('membershipId',membership_id,'expectedRevision',expected_revision,'phone',phone,'sections',sections);
  receipt:=intrack.begin_command(actor,command_id,'save_adviser_roster_details',payload);if receipt is not null then return receipt;end if;
  insert into intrack.adviser_roster_details(membership_id) values(m.id) on conflict do nothing;
  select revision into current_revision from intrack.adviser_roster_details d where d.membership_id=m.id for update;
  if current_revision is distinct from expected_revision then raise exception 'Adviser details changed; refresh first' using errcode='40001';end if;
  update intrack.adviser_roster_details d set phone=trim(intrack_save_adviser_roster_details.phone),sections=intrack_save_adviser_roster_details.sections,revision=revision+1 where d.membership_id=m.id;
  return intrack.finish_command(actor,command_id,'save_adviser_roster_details',payload,jsonb_build_object('membershipId',m.id,'revision',current_revision+1),'membership',m.id,null,current_revision,current_revision+1);
end $$;
revoke all on function public.intrack_save_adviser_roster_details(uuid,uuid,integer,text,text[]) from public,anon,authenticated;
grant execute on function public.intrack_save_adviser_roster_details(uuid,uuid,integer,text,text[]) to authenticated;

create function public.intrack_coordinator_roster(account_role text,filters jsonb default '{}')
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare actor uuid; scope uuid[]; page_number integer:=coalesce((filters->>'page')::integer,0); result jsonb;
begin
  actor:=intrack.authorized_actor('coordinator');
  if account_role not in ('student','adviser') or filters is null or jsonb_typeof(filters)<>'object' or page_number not between 0 and 10000
    or length(coalesce(filters->>'search',''))>200 or exists(select 1 from jsonb_object_keys(filters) k where k not in('page','search','program','section','stage','access','activation')) then raise exception 'Invalid roster query' using errcode='22023';end if;
  select array_agg(program_id) into scope from intrack.memberships where profile_id=actor and role='coordinator' and active;
  with roster as (
    select s.id eligible_id,p.id profile_id,m.id membership_id,s.program_id,program.code program_code,s.display_name name,s.student_number,s.email,s.section,
      ''::text phone,'{}'::text[] sections,0 details_revision,p.status profile_status,p.activated_at,m.active membership_active,m.revision membership_revision,
      p.auth_user_id is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()) auth_available,
      w.profile_id is not null whitelisted,e.id enrollment_id,e.revision enrollment_revision,e.lifecycle stage,e.adviser_id,
      (select display_name from intrack.profiles where id=e.adviser_id) adviser_name,0::bigint workload,
      i.id invitation_id,i.requested_by,i.state invitation_state,c.command_id,c.request_payload
    from intrack.eligible_students s join intrack.programs program on program.id=s.program_id
    left join intrack.profiles p on p.id=s.invited_profile_id left join auth.users u on u.id=p.auth_user_id
    left join intrack.memberships m on m.profile_id=p.id and m.program_id=s.program_id and m.role='student'
    left join intrack.whitelist_login_setup w on w.profile_id=p.id
    left join lateral(select en.id,en.revision,en.lifecycle,a.adviser_id from intrack.enrollments en
      left join intrack.adviser_assignments a on a.enrollment_id=en.id and a.ends_at is null and a.starts_at<=now()
      where en.student_id=p.id and en.program_id=s.program_id and en.outcome='active' order by en.created_at desc,en.id desc limit 1)e on true
    left join lateral(select * from intrack.account_invitations ai where ai.profile_id=p.id order by ai.created_at desc,ai.id desc limit 1)i on true
    left join intrack.account_invitation_commands c on c.invitation_id=i.id and c.actor_id=actor
    where account_role='student' and s.program_id=any(scope)
    union all
    select null,p.id,m.id,m.program_id,program.code,p.display_name,p.student_number,u.email,null,d.phone,coalesce(d.sections,'{}'),coalesce(d.revision,0),p.status,p.activated_at,m.active,m.revision,
      p.auth_user_id is not null and u.deleted_at is null and (u.banned_until is null or u.banned_until<=now()),w.profile_id is not null,
      null,null,null,null,null,(select count(*) from intrack.adviser_assignments a join intrack.enrollments en on en.id=a.enrollment_id where a.adviser_id=p.id and a.ends_at is null and a.starts_at<=now() and en.program_id=m.program_id and en.outcome='active'),
      i.id,i.requested_by,i.state,c.command_id,c.request_payload
    from intrack.memberships m join intrack.profiles p on p.id=m.profile_id join intrack.programs program on program.id=m.program_id
    left join auth.users u on u.id=p.auth_user_id left join intrack.adviser_roster_details d on d.membership_id=m.id
    left join intrack.whitelist_login_setup w on w.profile_id=p.id
    left join lateral(select * from intrack.account_invitations ai where ai.profile_id=p.id order by ai.created_at desc,ai.id desc limit 1)i on true
    left join intrack.account_invitation_commands c on c.invitation_id=i.id and c.actor_id=actor
    where account_role='adviser' and m.role='adviser' and m.program_id=any(scope)
  ),filtered as(
    select *,coalesce(membership_active,false) and profile_status in('invited','active') and auth_available access_enabled,
      profile_status='active' and activated_at is not null activated from roster
    where (coalesce(filters->>'search','')='' or concat_ws(' ',name,student_number,email,adviser_name) ilike '%'||(filters->>'search')||'%')
      and (coalesce(filters->>'program','all')='all' or program_code=filters->>'program')
      and (coalesce(filters->>'section','all')='all' or section=filters->>'section')
      and (coalesce(filters->>'stage','all')='all' or stage=filters->>'stage')
  ),matching as(
    select * from filtered where (coalesce(filters->>'access','all')='all' or (filters->>'access'='enabled')=coalesce(access_enabled,false))
      and (coalesce(filters->>'activation','all')='all' or (filters->>'activation'='activated')=coalesce(activated,false))
  ),paged as(select * from matching order by lower(name),program_code,coalesce(eligible_id,membership_id) limit 100 offset page_number*100)
  select jsonb_build_object('page',page_number,'total',(select count(*) from matching),'hasMore',(select count(*) from matching)>(page_number+1)*100,
    'items',coalesce(jsonb_agg(jsonb_build_object('id',coalesce(eligible_id,membership_id),'eligibleId',eligible_id,'profileId',profile_id,'membershipId',membership_id,
      'programId',program_id,'programCode',program_code,'name',name,'studentNumber',student_number,'email',email,'section',section,'phone',coalesce(phone,''),'sections',sections,'detailsRevision',details_revision,
      'profileStatus',profile_status,'activated',coalesce(activated,false),'accessEnabled',coalesce(access_enabled,false),'membershipActive',coalesce(membership_active,false),'membershipRevision',membership_revision,
      'whitelisted',whitelisted,'enrollmentId',enrollment_id,'enrollmentRevision',enrollment_revision,'stage',stage,'adviserId',adviser_id,'adviserName',adviser_name,'workload',workload,
      'pending',case when command_id is not null then jsonb_build_object('commandId',command_id,'payload',request_payload) else null end,
      'provisioningPending',profile_id is not null and not auth_available,'ownedReservation',requested_by=actor,'invitationState',invitation_state)),'[]')) into result from paged;
  return result||jsonb_build_object(
    'programs',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code,'studentDomains',coalesce(c.student_email_domains,'{}'),'staffDomains',coalesce(c.staff_email_domains,'{}')) order by p.code),'[]') from intrack.programs p left join intrack.program_configuration c on c.program_id=p.id where p.id=any(scope)),
    'sections',(select coalesce(jsonb_agg(section order by section),'[]') from(select distinct section from intrack.eligible_students where program_id=any(scope)) s),
    'advisers',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'programId',m.program_id) order by p.display_name),'[]') from intrack.memberships m join intrack.profiles p on p.id=m.profile_id where m.program_id=any(scope) and m.role='adviser' and m.active and p.status='active')
  );
end $$;
revoke all on function public.intrack_coordinator_roster(text,jsonb) from public,anon,authenticated;
grant execute on function public.intrack_coordinator_roster(text,jsonb) to authenticated;
commit;
