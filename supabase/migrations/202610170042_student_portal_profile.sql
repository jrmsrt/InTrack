begin;
-- Current caller only: no profile ID, email, or role can be supplied by the browser.
create function public.intrack_student_portal_profile() returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor uuid; person intrack.profiles%rowtype; eligible intrack.eligible_students%rowtype;
begin
 actor:=intrack.authorized_actor('student');
 select * into person from intrack.profiles where id=actor;
 select * into eligible from intrack.eligible_students where invited_profile_id=actor order by imported_at desc,id limit 1;
 return jsonb_build_object('id',person.id,'name',person.display_name,'studentNumber',person.student_number,
   'email',(select email from auth.users where id=person.auth_user_id),'section',coalesce(eligible.section,''),
   'programs',(select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'code',p.code) order by p.code),'[]') from intrack.programs p where exists(select 1 from intrack.memberships m where m.profile_id=actor and m.program_id=p.id and m.role='student' and m.active)),
   'policies',(select coalesce(jsonb_agg(jsonb_build_object('programId',v.program_id,'component',v.component,'requiredMinutes',v.required_minutes,'yearLevel',v.year_level) order by v.component,v.version desc),'[]') from intrack.policy_versions v where exists(select 1 from intrack.memberships m where m.profile_id=actor and m.program_id=v.program_id and m.role='student' and m.active)),
   'advisers',(select coalesce(jsonb_agg(distinct jsonb_build_object('id',p.id,'name',p.display_name)),'[]') from intrack.adviser_assignments a join intrack.enrollments e on e.id=a.enrollment_id join intrack.profiles p on p.id=a.adviser_id where e.student_id=actor and a.ends_at is null),
   'placements',(select coalesce(jsonb_agg(jsonb_build_object('enrollmentId',e.id,'companyId',c.id,'companyName',c.name)),'[]') from intrack.placements pl join intrack.enrollments e on e.id=pl.enrollment_id join intrack.companies c on c.id=pl.company_id where e.student_id=actor and pl.active));
end $$;
revoke all on function public.intrack_student_portal_profile() from public,anon;
grant execute on function public.intrack_student_portal_profile() to authenticated;
notify pgrst,'reload schema';
commit;
