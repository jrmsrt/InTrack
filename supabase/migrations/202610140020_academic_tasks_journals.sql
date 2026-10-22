begin;
create function public.intrack_academic_command(command_id uuid,payload jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<academic_command>>
declare e intrack.enrollments%rowtype; t intrack.task_versions%rowtype;j intrack.journal_versions%rowtype;r intrack.enrollment_requirements%rowtype;
 actor uuid;receipt jsonb;action text:=payload->>'action';kind text:=payload->>'kind';id uuid;version integer;period jsonb;content jsonb;source uuid;
 start_day date;end_day date;field text;decision text;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,case when action='submit' then 'student' else 'adviser' end);
 receipt:=intrack.begin_command(actor,command_id,'academic',payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or e.lifecycle='completed' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or kind not in ('task','journal') then raise exception 'Current active enrollment and supported artifact required' using errcode='40001';end if;
 if action='submit' then
  content:=payload->'content';
  if jsonb_typeof(content) is distinct from 'object' or octet_length(content::text)>65536 then raise exception 'Bounded academic content required' using errcode='22023';end if;
  if kind='task' then
   if e.lifecycle<>'during_ojt' or coalesce(length(trim(content->>'description')),0) not between 1 and 8000 then raise exception 'Training stage and task description required' using errcode='22023';end if;
   start_day:=(payload->>'taskDate')::date;
   if start_day is null or start_day>(now() at time zone 'Asia/Manila')::date or not exists(select 1 from intrack.placements where enrollment_id=e.id and start_day>=starts_on and (ends_on is null or start_day<=ends_on)) then raise exception 'Historical placement task date required' using errcode='22023';end if;
   source:=coalesce((payload->>'taskKey')::uuid,gen_random_uuid());
   select * into t from intrack.task_versions where enrollment_id=e.id and task_key=source and is_current for update;
   if t.id is not null and (t.status not in ('needs_revision','rejected','withdrawn') or (payload->>'expectedArtifactRevision')::integer is distinct from t.revision) then raise exception 'Resolve current task before replacement' using errcode='40001';end if;
   if t.id is not null then update intrack.task_versions set is_current=false where task_versions.id=t.id;end if;
   select coalesce(max(task_versions.version),0)+1 into version from intrack.task_versions where enrollment_id=e.id and task_key=source;
   insert into intrack.task_versions(enrollment_id,task_key,version,task_date,content,status,submitted_at,content_hash,created_by) values(e.id,source,version,start_day,content,'submitted',now(),intrack.json_hash(content),actor) returning task_versions.id into id;
  else
   select * into r from intrack.enrollment_requirements where enrollment_requirements.id=(payload->>'requirementId')::uuid and enrollment_id=e.id;
   if r.id is null or r.definition_snapshot->>'evidence_type'<>'journal' or r.waived_at is not null or not (r.definition_snapshot->'allowed_submission_stages') ? e.lifecycle then raise exception 'Configured journal occurrence required' using errcode='42501';end if;
   period:=r.definition_snapshot->'recurrence';if period->>'kind'='occurrences' then select value into period from jsonb_array_elements(period->'items') where value->>'key'=r.instance_key;end if;
   start_day:=(period->>'startsOn')::date;end_day:=(period->>'endsOn')::date;
   if start_day is null or end_day is null or end_day<start_day or end_day>start_day+62 or end_day>(now() at time zone 'Asia/Manila')::date
    or jsonb_typeof(period->'requiredFields') is distinct from 'array' or jsonb_array_length(period->'requiredFields')=0 or (period->>'requireApprovedDtr')::boolean is null then raise exception 'Confirmed journal dates/fields/DTR rule required' using errcode='22023';end if;
   for field in select jsonb_array_elements_text(period->'requiredFields') loop if coalesce(length(trim(content->>field)),0)=0 then raise exception 'Required reflection field missing' using errcode='22023';end if;end loop;
   select * into j from intrack.journal_versions where enrollment_id=e.id and period_key=r.id::text and is_current for update;
   if j.id is not null and (j.status not in ('needs_revision','rejected','withdrawn') or (payload->>'expectedArtifactRevision')::integer is distinct from j.revision) then raise exception 'Resolve current journal before replacement' using errcode='40001';end if;
   if j.id is not null then update intrack.journal_versions set is_current=false where journal_versions.id=j.id;end if;
   select coalesce(max(journal_versions.version),0)+1 into version from intrack.journal_versions where enrollment_id=e.id and period_key=r.id::text;
   if not exists(select 1 from intrack.task_versions where enrollment_id=e.id and is_current and status='approved' and task_date between start_day and end_day) and coalesce((period->>'allowNoActivity')::boolean,false)<>true then raise exception 'Approved tasks or explicit no-activity rule required' using errcode='40001';end if;
   if (period->>'requireApprovedDtr')::boolean is true and not exists(select 1 from intrack.dtr_versions where enrollment_id=e.id and status='approved' and starts_on<=start_day and ends_on>=end_day) then raise exception 'Approved period-covering DTR required' using errcode='40001';end if;
   content:=content||jsonb_build_object('requirementId',r.id,'period',period);
   insert into intrack.journal_versions(enrollment_id,starts_on,ends_on,version,content,period_key,created_by,status) values(e.id,start_day,end_day,version,content,r.id::text,actor,'draft') returning journal_versions.id into id;
   insert into intrack.journal_tasks(enrollment_id,journal_id,task_version_id) select e.id,academic_command.id,task_versions.id from intrack.task_versions where enrollment_id=e.id and is_current and status='approved' and task_date between start_day and end_day;
   insert into intrack.journal_dtr_sources(enrollment_id,journal_id,dtr_id,dtr_revision,frozen_snapshot) select e.id,academic_command.id,dtr_versions.id,revision,to_jsonb(dtr_versions) from intrack.dtr_versions where enrollment_id=e.id and status='approved' and starts_on<=end_day and ends_on>=start_day;
   select jsonb_build_object('content',content,'tasks',coalesce((select jsonb_agg(to_jsonb(task_source)) from intrack.task_versions task_source join intrack.journal_tasks jt on jt.task_version_id=task_source.id where jt.journal_id=academic_command.id),'[]'::jsonb),'dtrs',coalesce((select jsonb_agg(frozen_snapshot) from intrack.journal_dtr_sources where journal_id=academic_command.id),'[]'::jsonb)) into content;
   update intrack.journal_versions set content=academic_command.content,content_hash=intrack.json_hash(academic_command.content),status='submitted',submitted_at=now() where journal_versions.id=academic_command.id;
  end if;
 elsif action in ('approve','request_revision','reject') then
  if actor=e.student_id or (action<>'approve' and coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000) then raise exception 'Other-user review and decision reason required' using errcode='42501';end if;
  decision:=case action when 'approve' then 'approved' when 'reject' then 'rejected' else 'needs_revision' end;
  if kind='task' then
   select * into t from intrack.task_versions where task_versions.id=(payload->>'artifactId')::uuid and enrollment_id=e.id for update;id:=t.id;
   if t.id is null or not t.is_current or t.status not in ('submitted','under_review') or (payload->>'expectedArtifactRevision')::integer is distinct from t.revision then raise exception 'Current submitted task required' using errcode='40001';end if;
   update intrack.task_versions set status=decision,revision=revision+1 where task_versions.id=t.id;
  else
   select * into j from intrack.journal_versions where journal_versions.id=(payload->>'artifactId')::uuid and enrollment_id=e.id for update;id:=j.id;
   if j.id is null or not j.is_current or j.status not in ('submitted','under_review') or (payload->>'expectedArtifactRevision')::integer is distinct from j.revision then raise exception 'Current submitted journal required' using errcode='40001';end if;
   if action='approve' and (exists(select 1 from intrack.journal_tasks jt join intrack.task_versions task_source on task_source.id=jt.task_version_id where jt.journal_id=j.id and (not task_source.is_current or task_source.status<>'approved')) or exists(select 1 from intrack.journal_dtr_sources jd join intrack.dtr_versions d on d.id=jd.dtr_id where jd.journal_id=j.id and (d.status<>'approved' or d.revision<>jd.dtr_revision))) then raise exception 'Journal source changed' using errcode='40001';end if;
   update intrack.journal_versions set status=decision,reviewed_by=actor,reviewed_at=now(),revision=revision+1 where journal_versions.id=j.id;
  end if;
  insert into intrack.academic_review_events(enrollment_id,task_id,journal_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision) values(e.id,case when kind='task' then id end,case when kind='journal' then id end,actor,'adviser',decision,coalesce(payload->>'reason',''),command_id,coalesce(t.revision,j.revision)+1);
 else raise exception 'Unsupported academic action' using errcode='22023';end if;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'academic',payload,jsonb_build_object('id',id,'enrollmentRevision',e.revision+1),'academic',id,e.id,e.revision,e.revision+1);
end $$;

create function public.intrack_list_academics(enrollment_id uuid,actor_role text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform intrack.enrollment_actor(enrollment_id,actor_role);
 return jsonb_build_object('tasks',coalesce((select jsonb_agg(to_jsonb(t)) from (select * from intrack.task_versions where task_versions.enrollment_id=intrack_list_academics.enrollment_id order by created_at desc,id limit 100) t),'[]'::jsonb),
 'journals',coalesce((select jsonb_agg(to_jsonb(j)) from (select * from intrack.journal_versions where journal_versions.enrollment_id=intrack_list_academics.enrollment_id order by submitted_at desc,id limit 100) j),'[]'::jsonb));
end $$;
revoke all on function public.intrack_academic_command(uuid,jsonb),public.intrack_list_academics(uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_academic_command(uuid,jsonb),public.intrack_list_academics(uuid,text) to authenticated;
commit;
