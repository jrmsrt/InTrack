begin;
create table intrack.portfolio_content_catalog(id text primary key,title text not null,ordinal integer not null unique,source_note text not null);
alter table intrack.portfolio_content_catalog enable row level security;
revoke all on intrack.portfolio_content_catalog from public,anon,authenticated;
create trigger preserve_portfolio_catalog before update or delete on intrack.portfolio_content_catalog for each row execute function intrack.guard_append_only();

create function intrack.portfolio_sources_current(target uuid) returns boolean language sql stable set search_path='' as $$
 select coalesce((select p.manifest->'credits'=coalesce((select jsonb_agg(to_jsonb(c) order by c.credit_date,c.session_id) from intrack.hour_credits c where c.enrollment_id=p.enrollment_id and c.invalidated_at is null),'[]'::jsonb) from intrack.portfolio_versions p where p.id=target),false) and not exists(select 1 from intrack.portfolio_sources s where s.portfolio_id=target and (
 (s.document_id is not null and not exists(select 1 from intrack.documents d where d.id=s.document_id and d.status='attached' and d.sha256=s.source_hash))
 or (s.submission_id is not null and not exists(select 1 from intrack.submission_versions v left join intrack.documents d on d.id=v.document_id where v.id=s.submission_id and v.is_current and v.status='approved' and v.revision=s.source_revision and coalesce(d.sha256,intrack.json_hash(to_jsonb(v)))=s.source_hash))
 or (s.dtr_id is not null and not exists(select 1 from intrack.dtr_versions d where d.id=s.dtr_id and d.status='approved' and d.revision=s.source_revision and intrack.json_hash(d.printable_snapshot)=s.source_hash))
 or (s.journal_id is not null and not exists(select 1 from intrack.journal_versions j where j.id=s.journal_id and j.is_current and j.status='approved' and j.revision=s.source_revision and j.content_hash=s.source_hash))
 or (s.evaluation_id is not null and not exists(select 1 from intrack.evaluation_versions v where v.id=s.evaluation_id and v.is_current and v.status='approved' and v.revision=s.source_revision and v.content_hash=s.source_hash))
 ))
$$;
create function intrack.portfolio_gate(target uuid) returns boolean language plpgsql stable set search_path='' as $$
declare e intrack.enrollments%rowtype;stage text;gate jsonb;moa uuid;
begin
 select * into e from intrack.enrollments where id=target;
 select submission_id into moa from intrack.moa_routing_events where enrollment_id=target and status in ('SIGNED AND NOTARIZED','SAS COPY SUBMITTED') order by enrollment_revision desc limit 1;
 if e.id is null or e.lifecycle<>'portfolio' or e.outcome<>'active' or coalesce((select sum(minutes) from intrack.hour_credits where enrollment_id=target and invalidated_at is null),0)<e.required_minutes
 or exists(select 1 from intrack.attendance_sessions where enrollment_id=target and ((clock_out_at is null and status<>'void') or status='disputed'))
 or exists(select 1 from intrack.correction_requests where enrollment_id=target and status='pending') or exists(select 1 from intrack.reconstruction_requests where enrollment_id=target and status='pending') then return false;end if;
 foreach stage in array array['pre','during','post'] loop gate:=intrack.requirement_gate(target,stage,moa);if (gate->>'ready')::boolean is distinct from true then return false;end if;end loop;
 if exists(select 1 from intrack.task_versions where enrollment_id=target and is_current and status not in ('approved','withdrawn')) or exists(select 1 from intrack.journal_versions where enrollment_id=target and is_current and status<>'approved') or exists(select 1 from intrack.evaluation_versions where enrollment_id=target and is_current and status<>'approved') then return false;end if;
 return true;
end $$;

create function public.intrack_portfolio_command(command_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<portfolio_command>>
declare e intrack.enrollments%rowtype;r intrack.enrollment_requirements%rowtype;p intrack.portfolio_versions%rowtype;doc intrack.documents%rowtype;
 actor uuid;receipt jsonb;action text:=payload->>'action';role text;id uuid;version integer;outline jsonb;manifest jsonb;decision text;verified jsonb;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 role:=case when action='submit' then 'student' else payload->>'role' end;
 if role not in ('student','adviser','coordinator') or (action<>'submit' and role='student') then raise exception 'Review role required' using errcode='42501';end if;
 actor:=intrack.enrollment_actor(e.id,role);receipt:=intrack.begin_command(actor,command_id,'portfolio',payload);if receipt is not null then return receipt;end if;
 if e.outcome<>'active' or e.lifecycle<>'portfolio' or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision then raise exception 'Current active portfolio stage required' using errcode='40001';end if;
 if action='submit' then
  if not intrack.portfolio_gate(e.id) then raise exception 'Hours, required evidence and academic sources unresolved' using errcode='40001';end if;
  select * into r from intrack.enrollment_requirements where enrollment_requirements.id=(payload->>'requirementId')::uuid and enrollment_id=e.id;
  if r.id is null or r.definition_snapshot->>'evidence_type'<>'portfolio' or r.definition_snapshot->>'reviewer'<>'both' or r.waived_at is not null then raise exception 'Configured sequential portfolio occurrence required' using errcode='42501';end if;
  outline:=r.definition_snapshot->'recurrence'->'contents';
  if jsonb_typeof(outline) is distinct from 'array' or jsonb_array_length(outline)<>(select count(*) from intrack.portfolio_content_catalog) or exists(select 1 from jsonb_array_elements(outline) entry where not exists(select 1 from intrack.portfolio_content_catalog c where c.id=entry->>'id') or (entry->>'mandatory')::boolean is null) or (select count(distinct value->>'id') from jsonb_array_elements(outline))<>jsonb_array_length(outline) then raise exception 'Complete confirmed portfolio contents configuration required' using errcode='22023';end if;
  select * into doc from intrack.documents where documents.id=(payload->>'documentId')::uuid and enrollment_id=e.id and requirement_id=r.id and uploaded_by=actor and status='attached' and mime_type='application/pdf';
  if doc.id is null then raise exception 'Validated scoped portfolio PDF required' using errcode='42501';end if;
  select * into p from intrack.portfolio_versions where enrollment_id=e.id and is_current for update;
  if p.id is not null and (p.status not in ('needs_revision','rejected','withdrawn') or (payload->>'expectedArtifactRevision')::integer is distinct from p.revision) then raise exception 'Resolve current portfolio before replacement' using errcode='40001';end if;
  if p.id is not null then update intrack.portfolio_versions set is_current=false where portfolio_versions.id=p.id;end if;
  select coalesce(max(portfolio_versions.version),0)+1 into version from intrack.portfolio_versions where enrollment_id=e.id;
  manifest:=jsonb_build_object('requirementId',r.id,'policyVersionId',e.policy_version_id,'contents',outline,'pdfDocumentId',doc.id,'pdfHash',doc.sha256,'enrollmentRevision',e.revision);
  insert into intrack.portfolio_versions(enrollment_id,version,manifest,created_by,status) values(e.id,version,manifest,actor,'draft') returning portfolio_versions.id into id;
  insert into intrack.portfolio_sources(enrollment_id,portfolio_id,requirement_id,document_id,source_revision,source_hash) values(e.id,portfolio_command.id,r.id,doc.id,0,doc.sha256);
  insert into intrack.portfolio_sources(enrollment_id,portfolio_id,requirement_id,submission_id,source_revision,source_hash)
   select e.id,portfolio_command.id,s.requirement_id,s.id,s.revision,coalesce(d.sha256,intrack.json_hash(to_jsonb(s))) from intrack.submission_versions s left join intrack.documents d on d.id=s.document_id where s.enrollment_id=e.id and s.is_current and s.status='approved';
  insert into intrack.portfolio_sources(enrollment_id,portfolio_id,dtr_id,source_revision,source_hash) select e.id,portfolio_command.id,d.id,d.revision,intrack.json_hash(d.printable_snapshot) from intrack.dtr_versions d where d.enrollment_id=e.id and d.status='approved';
  insert into intrack.portfolio_sources(enrollment_id,portfolio_id,journal_id,source_revision,source_hash) select e.id,portfolio_command.id,j.id,j.revision,j.content_hash from intrack.journal_versions j where j.enrollment_id=e.id and j.is_current and j.status='approved';
  insert into intrack.portfolio_sources(enrollment_id,portfolio_id,evaluation_id,source_revision,source_hash) select e.id,portfolio_command.id,v.id,v.revision,v.content_hash from intrack.evaluation_versions v where v.enrollment_id=e.id and v.is_current and v.status='approved';
  select manifest||jsonb_build_object('sources',coalesce(jsonb_agg(to_jsonb(s) order by s.id),'[]'),'waivers',coalesce((select jsonb_agg(to_jsonb(w)) from intrack.enrollment_requirements w where w.enrollment_id=e.id and w.waived_at is not null),'[]'::jsonb),'credits',coalesce((select jsonb_agg(to_jsonb(c) order by c.credit_date,c.session_id) from intrack.hour_credits c where c.enrollment_id=e.id and c.invalidated_at is null),'[]'::jsonb)) into manifest from intrack.portfolio_sources s where s.portfolio_id=portfolio_command.id;
  update intrack.portfolio_versions set manifest=portfolio_command.manifest,manifest_hash=intrack.json_hash(portfolio_command.manifest),status='submitted',submitted_at=now() where portfolio_versions.id=portfolio_command.id;
 elsif action in ('approve','request_revision','reject') then
  select * into p from intrack.portfolio_versions where portfolio_versions.id=(payload->>'artifactId')::uuid and enrollment_id=e.id for update;id:=p.id;
  if p.id is null or not p.is_current or p.status not in ('submitted','under_review') or actor=e.student_id or actor=p.created_by or (payload->>'expectedArtifactRevision')::integer is distinct from p.revision then raise exception 'Current other-user portfolio required' using errcode='40001';end if;
  if coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Factual portfolio review note required' using errcode='22023';end if;
  if action='approve' then
   if not intrack.portfolio_gate(e.id) or not intrack.portfolio_sources_current(p.id) then raise exception 'Portfolio eligibility/source changed' using errcode='40001';end if;
   verified:=payload->'verifiedContentIds';
   if jsonb_typeof(verified) is distinct from 'array' or exists(select 1 from jsonb_array_elements(p.manifest->'contents') item where (item->>'mandatory')::boolean is true and not verified ? (item->>'id')) then raise exception 'Verify every configured mandatory content against the actual PDF' using errcode='22023';end if;
   if role='adviser' then
    if p.adviser_approved_at is not null then raise exception 'Adviser review already recorded' using errcode='40001';end if;
    decision:='under_review';update intrack.portfolio_versions set status=decision,adviser_reviewed_by=actor,adviser_approved_at=now(),revision=revision+1 where portfolio_versions.id=p.id;
   else
    if p.adviser_approved_at is null or p.adviser_reviewed_by=actor then raise exception 'Separate adviser approval must precede coordinator finalization' using errcode='42501';end if;
    decision:='approved';update intrack.portfolio_versions set status=decision,coordinator_reviewed_by=actor,coordinator_approved_at=now(),revision=revision+1 where portfolio_versions.id=p.id;
   end if;
  else
   decision:=case action when 'reject' then 'rejected' else 'needs_revision' end;
   update intrack.portfolio_versions set status=decision,adviser_reviewed_by=null,adviser_approved_at=null,coordinator_reviewed_by=null,coordinator_approved_at=null,revision=revision+1 where portfolio_versions.id=p.id;
  end if;
  insert into intrack.academic_review_events(enrollment_id,portfolio_id,actor_id,reviewer_role,decision,reason,command_id,artifact_revision,verification_snapshot) values(e.id,p.id,actor,role,decision,trim(payload->>'reason'),command_id,p.revision+1,jsonb_build_object('verifiedContentIds',coalesce(verified,'[]'::jsonb),'manifestHash',p.manifest_hash));
 else raise exception 'Unsupported portfolio action' using errcode='22023';end if;
 update intrack.enrollments set revision=revision+1 where enrollments.id=e.id;
 return intrack.finish_command(actor,command_id,'portfolio',payload,jsonb_build_object('id',id,'enrollmentRevision',e.revision+1),'portfolio',id,e.id,e.revision,e.revision+1);
end $$;

create function public.intrack_finalization_command(command_id uuid,payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
<<finalization_command>>
declare e intrack.enrollments%rowtype;p intrack.portfolio_versions%rowtype;actor uuid;receipt jsonb;action text:=payload->>'action';summary jsonb;id uuid;version integer;stage text;outcome text;gate jsonb;
begin
 select * into e from intrack.enrollments where enrollments.id=(payload->>'enrollmentId')::uuid for update;
 actor:=intrack.enrollment_actor(e.id,'coordinator');receipt:=intrack.begin_command(actor,command_id,'finalization',payload);if receipt is not null then return receipt;end if;
 if actor=e.student_id or (payload->>'expectedEnrollmentRevision')::integer is distinct from e.revision or coalesce(length(trim(payload->>'reason')),0) not between 1 and 1000 then raise exception 'Other-user current enrollment and reason required' using errcode='40001';end if;
 if action='complete' then
  select * into p from intrack.portfolio_versions where enrollment_id=e.id and is_current and status='approved' for update;
  gate:=intrack.requirement_gate(e.id,'portfolio');
  if p.id is null or not intrack.portfolio_gate(e.id) or not intrack.portfolio_sources_current(p.id) or (gate->>'ready')::boolean is distinct from true then raise exception 'Approved current portfolio and all completion gates required' using errcode='40001';end if;
  select coalesce(max(completion_summaries.version),0)+1 into version from intrack.completion_summaries where enrollment_id=e.id;
  summary:=jsonb_build_object('enrollment',to_jsonb(e),'portfolio',to_jsonb(p),'portfolioGate',gate,'credits',coalesce((select jsonb_agg(to_jsonb(c) order by c.credit_date,c.session_id) from intrack.hour_credits c where c.enrollment_id=e.id and c.invalidated_at is null),'[]'::jsonb),'finalizedBy',actor,'completedAt',now());
  insert into intrack.completion_summaries(enrollment_id,portfolio_id,version,enrollment_revision,finalized_by,command_id,summary,summary_hash) values(e.id,p.id,version,e.revision+1,actor,command_id,summary,intrack.json_hash(summary)) returning completion_summaries.id into id;stage:='completed';outcome:='completed';
 elsif action='reopen_completion' then
  if e.lifecycle<>'completed' or e.outcome<>'completed' then raise exception 'Completed enrollment required' using errcode='40001';end if;
  update intrack.portfolio_versions set status='needs_revision',revision=revision+1,adviser_reviewed_by=null,adviser_approved_at=null,coordinator_reviewed_by=null,coordinator_approved_at=null where enrollment_id=e.id and is_current and status<>'draft';stage:='portfolio';outcome:='active';id:=e.id;
 else raise exception 'Unsupported finalization action' using errcode='22023';end if;
 update intrack.enrollments set lifecycle=stage,outcome=finalization_command.outcome,completed_at=case when action='complete' then now() else null end,revision=revision+1 where enrollments.id=e.id;
 insert into intrack.enrollment_events(enrollment_id,actor_id,action,reason,command_id,before_revision,after_revision,from_stage,to_stage,from_outcome,to_outcome,from_clearance,to_clearance,basis_snapshot) values(e.id,actor,action,trim(payload->>'reason'),command_id,e.revision,e.revision+1,e.lifecycle,stage,e.outcome,outcome,intrack.current_clearance(e.id),'revoked',coalesce(summary,jsonb_build_object('reopened',true)));
 return intrack.finish_command(actor,command_id,'finalization',payload,jsonb_build_object('id',id,'enrollmentRevision',e.revision+1,'lifecycle',stage,'outcome',outcome),'enrollment',e.id,e.id,e.revision,e.revision+1);
end $$;

create function public.intrack_list_assessments(enrollment_id uuid,actor_role text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform intrack.enrollment_actor(enrollment_id,actor_role);
 return jsonb_build_object('evaluations',coalesce((select jsonb_agg(to_jsonb(v)) from intrack.evaluation_versions v where v.enrollment_id=intrack_list_assessments.enrollment_id),'[]'::jsonb),'portfolios',coalesce((select jsonb_agg(to_jsonb(p)) from intrack.portfolio_versions p where p.enrollment_id=intrack_list_assessments.enrollment_id),'[]'::jsonb),'summaries',coalesce((select jsonb_agg(to_jsonb(s)) from intrack.completion_summaries s where s.enrollment_id=intrack_list_assessments.enrollment_id),'[]'::jsonb),'contents',(select jsonb_agg(to_jsonb(c) order by ordinal) from intrack.portfolio_content_catalog c),'rubrics',coalesce((select jsonb_agg(to_jsonb(t)||jsonb_build_object('criteria',(select jsonb_agg(to_jsonb(c) order by ordinal) from intrack.evaluation_criteria c where c.template_id=t.id))) from intrack.evaluation_templates t where t.policy_version_id=(select policy_version_id from intrack.enrollments where id=intrack_list_assessments.enrollment_id) and published_at is not null),'[]'::jsonb));
end $$;
revoke all on function intrack.portfolio_gate(uuid),intrack.portfolio_sources_current(uuid) from public,anon,authenticated;
revoke all on function public.intrack_portfolio_command(uuid,jsonb),public.intrack_finalization_command(uuid,jsonb),public.intrack_list_assessments(uuid,text) from public,anon,authenticated;
grant execute on function public.intrack_portfolio_command(uuid,jsonb),public.intrack_finalization_command(uuid,jsonb),public.intrack_list_assessments(uuid,text) to authenticated;
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('title-page','Title Page',1,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('approval-sheet','Approval Sheet',2,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('acknowledgment','Acknowledgment',3,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('dedication','Dedication',4,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('table-of-contents','Table of Contents',5,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('introduction','Introduction',6,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('company-profile','Company Profile',7,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('weekly-journal','Weekly Journal',8,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('self-reflection','Self-Reflection',9,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('problems-encountered','Problems Encountered',10,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('recommendations','Recommendations',11,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('appendices','Appendices',12,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('endorsement','Endorsement/Recommendation Letter',13,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('registration','Registration Card/Form',14,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('pre-resume','Resume with 2x2 colored picture',15,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('parent-consent','Notarized Waiver/Parents’ Consent',16,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('internship-program','Notarized Student Internship Program',17,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('practicum-plan','Student Practicum Plan',18,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('medical','Medical Certificate',19,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('insurance','Certificate of Insurance',20,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('sis-grades','Print Screen of SIS grades (1st year to 3rd year)',21,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('practicum-kit','Practicum kit (Expanded Envelope)',22,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('orientation','Certificate (OJT Orientation)',23,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('work-ethics','Certificate (Sexual Harassment and Work Ethics)',24,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('moa','Notarized Memorandum of Agreement',25,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('weekly-pictures','Pictures per week',26,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('dtr','Daily Time Record',27,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('student-evaluation','Student Performance Evaluation',28,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('supervisor-evaluation','HTE Supervisor’s Evaluation',29,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('hte-evaluation','HTE Evaluation',30,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('completion-certificate','Certificate of Completion',31,'Owner-transcribed coordinator template contents, 2026-10-14');
insert into intrack.portfolio_content_catalog(id,title,ordinal,source_note) values('post-resume','Curriculum Vitae/Resume with picture',32,'Owner-transcribed coordinator template contents, 2026-10-14');
commit;
