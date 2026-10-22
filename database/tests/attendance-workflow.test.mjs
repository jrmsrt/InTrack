import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const people=Object.fromEntries(['student','other','adviser','coordinator'].map(name=>[name,{id:randomUUID(),sub:randomUUID()}]));
let program,policy,term;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to authenticated;grant insert,select,update,delete on storage.objects to authenticated;
 create table auth.users(id uuid primary key,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
 for(const file of ['../supabase-model.sql','../../supabase/migrations/202610100002_protected_identity.sql','../../supabase/migrations/202610100004_requirement_workflow.sql','../../supabase/migrations/202610100005_requirement_cleanup_receipts.sql','../../supabase/migrations/202610140006_administration_foundation.sql','../../supabase/migrations/202610140007_policy_enrollment_projection.sql','../../supabase/migrations/202610140017_attendance_commands.sql','../../supabase/migrations/202610140018_attendance_corrections_dtr.sql','../../supabase/migrations/202610140019_reconstruction_and_resolution_files.sql','../../supabase/migrations/202610140020_academic_tasks_journals.sql','../../supabase/migrations/202610140021_specialized_requirement_bindings.sql','../../supabase/migrations/202610140022_evaluation_rubrics_files.sql','../../supabase/migrations/202610140023_portfolio_finalization.sql','../../supabase/migrations/202610140008_communications.sql','../../supabase/migrations/202610140024_notifications_read_state_reports.sql','../../supabase/migrations/202610140025_approval_revocation.sql','../../supabase/migrations/202610140026_evidence_gate_hardening.sql','../../supabase/migrations/202610140027_explicit_break_configuration.sql','../../supabase/migrations/202610140028_evaluation_occurrence_identity.sql','../../supabase/migrations/202610140029_historical_attendance_authority.sql'])await db.exec(await readFile(new URL(file,import.meta.url),'utf8'));
 program=(await db.query("select id from intrack.programs where code='BSIT'")).rows[0].id;
 await db.exec("update intrack.identity_configuration set current_notice_version='test'");
 for(const [name,p] of Object.entries(people)){
  await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[p.sub]);
  await db.query("insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,$3,'active',now())",[p.id,p.sub,name]);
  await db.query('insert into intrack.memberships(profile_id,program_id,role) values($1,$2,$3)',[p.id,program,name==='other'?'student':name]);
  await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'test')",[p.id]);
 }
 policy=(await db.query('select id from intrack.policy_versions where program_id=$1 limit 1',[program])).rows[0].id;
 await db.query("update intrack.policy_versions set attendance_policy=$2,confirmed_by=$3,confirmed_at=now() where id=$1",[policy,{confirmed:true,dailyCapMinutes:480,maxSessionMinutes:1440,maxAccuracyMeters:100,maxCoordinateAgeSeconds:60},people.coordinator.id]);
 term=(await db.query("insert into intrack.academic_terms(academic_year,semester,starts_on,ends_on) values('TEST','2','2020-01-01','2030-12-31') returning id")).rows[0].id;
 await db.exec(await readFile(new URL('../../supabase/migrations/202610140030_private_templates.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/202610140031_operations_and_exports.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/202610140032_template_upload_cleanup.sql',import.meta.url),'utf8'));
});
after(()=>db.close());

test('private templates require scoped coordinator MFA, measured bytes and immutable version publication',async()=>{
 const payload={programCode:'BSIT',code:'ORIENTATION',title:'Orientation certificate',stage:'pre',name:'orientation.pdf',mimeType:'application/pdf',bytes:128};
 await assert.rejects(()=>caller('student','intrack_template_command',[randomUUID(),'reserve',payload]));
 await assert.rejects(()=>caller('coordinator','intrack_template_command',[randomUUID(),'reserve',payload],'aal1'));
 await assert.rejects(()=>caller('coordinator','intrack_template_command',[randomUUID(),'reserve',{...payload,programCode:'BSHM'}]));
 await assert.rejects(()=>caller('coordinator','intrack_template_command',[randomUUID(),'reserve',{...payload,mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}]));
 const command=randomUUID(),reserved=await caller('coordinator','intrack_template_command',[command,'reserve',payload]);
 assert.deepEqual(await caller('coordinator','intrack_template_command',[command,'reserve',payload]),reserved);
 await assert.rejects(()=>caller('coordinator','intrack_template_command',[command,'reserve',{...payload,title:'changed'}]));
 const publish={programCode:'BSIT',uploadId:reserved.uploadId,approvalReference:'Synthetic approval'};
 await assert.rejects(()=>caller('coordinator','intrack_template_command',[randomUUID(),'publish',publish]));
 await db.query("insert into storage.objects(bucket_id,name) values('ojt-templates',$1)",[reserved.path]);
 await assert.rejects(()=>caller('coordinator','intrack_attest_template',[reserved.uploadId,128,'application/pdf','a'.repeat(64)]));
 await assert.rejects(()=>db.query('select public.intrack_attest_template($1,129,$2,$3)',[reserved.uploadId,'application/pdf','a'.repeat(64)]));
 await db.query('select public.intrack_attest_template($1,128,$2,$3)',[reserved.uploadId,'application/pdf','a'.repeat(64)]);
 const pubId=randomUUID(),published=await caller('coordinator','intrack_template_command',[pubId,'publish',publish]);
 assert.equal(published.version,1);assert.deepEqual(await caller('coordinator','intrack_template_command',[pubId,'publish',publish]),published);
 const rows=await caller('student','intrack_list_templates',['BSIT','student',0]);assert.ok(rows.some(row=>row.id===published.templateId));
 await assert.rejects(()=>caller('student','intrack_list_templates',['BSHM','student',0]));
 await assert.rejects(()=>db.query('update intrack.template_versions set sha256=$2 where id=$1',[published.templateId,'b'.repeat(64)]));
 await caller('student','intrack_template_file',[published.templateId,'student']);
 await caller('coordinator','intrack_template_command',[randomUUID(),'archive',{programCode:'BSIT',templateId:published.templateId,reason:'New edition pending'}]);
 await assert.rejects(()=>caller('student','intrack_template_file',[published.templateId,'student']));
 await caller('coordinator','intrack_template_file',[published.templateId,'coordinator']);
 const second=await caller('coordinator','intrack_template_command',[randomUUID(),'reserve',payload]);
 await db.query("insert into storage.objects(bucket_id,name) values('ojt-templates',$1)",[second.path]);
 await db.query('select public.intrack_attest_template($1,128,$2,$3)',[second.uploadId,'application/pdf','b'.repeat(64)]);
 const next=await caller('coordinator','intrack_template_command',[randomUUID(),'publish',{...publish,uploadId:second.uploadId}]);assert.equal(next.version,2);
 assert.equal((await db.query('select count(distinct template_key)::integer n from intrack.template_versions where code=$1',['ORIENTATION'])).rows[0].n,1);
});

test('export snapshots are staff scoped, audited and repeatable; health remains operator-only',async()=>{
 const f=await fixture();const command=randomUUID();
 await assert.rejects(()=>caller('student','intrack_export_enrollments',[command,'student','',0]));
 await assert.rejects(()=>caller('adviser','intrack_export_enrollments',[command,'adviser','',0],'aal1'));
 const report=await caller('adviser','intrack_export_enrollments',[command,'adviser','',0]);
 assert.ok(report.items.some(item=>item.id===f.enrollment));
 assert.ok(report.items.every(item=>!('studentId' in item)&&!('adviserId' in item)));
 assert.deepEqual(await caller('adviser','intrack_export_enrollments',[command,'adviser','',0]),report);
 assert.equal((await db.query("select count(*)::integer n from intrack.audit_events where command_id=$1 and action='export_enrollments'",[command])).rows[0].n,1);
 await db.query('update intrack.adviser_assignments set ends_at=now() where enrollment_id=$1',[f.enrollment]);
 await assert.rejects(()=>caller('adviser','intrack_export_enrollments',[command,'adviser','',0]),/Export scope changed/);
 const after=await caller('adviser','intrack_export_enrollments',[randomUUID(),'adviser','',0]);assert.ok(!after.items.some(item=>item.id===f.enrollment));
 await assert.rejects(()=>caller('coordinator','intrack_operator_health',[]));
 const health=(await db.query('select public.intrack_operator_health() result')).rows[0].result;
 assert.equal(health.database,'reachable');assert.equal(health.emailDelivery,'paused');
});

test('command burst ceiling preserves exact retries and rolls back rejected new operations',async()=>{
 const payload={programCode:'BSIT',code:'RATE_TEST',title:'Rate test',stage:'pre',name:'test.pdf',mimeType:'application/pdf',bytes:10};
 const id=randomUUID();const reservation=await caller('coordinator','intrack_template_command',[id,'reserve',payload]);
 await db.query('update intrack.command_rate_windows set accepted=300,window_start=clock_timestamp() where actor_id=$1',[people.coordinator.id]);
 assert.deepEqual(await caller('coordinator','intrack_template_command',[id,'reserve',payload]),reservation);
 await assert.rejects(()=>caller('coordinator','intrack_template_command',[randomUUID(),'reserve',payload]),/Too many new commands/);
 await db.query("update intrack.command_rate_windows set window_start=clock_timestamp()-interval '2 minutes' where actor_id=$1",[people.coordinator.id]);
 await caller('coordinator','intrack_template_command',[randomUUID(),'reserve',payload]);
});

test('template cleanup locks expired unpublished intents and acknowledges only confirmed storage deletion',async()=>{
 const payload={programCode:'BSIT',code:'EXPIRED',title:'Synthetic expiry',stage:'pre',name:'old.pdf',mimeType:'application/pdf',bytes:10};
 const reserved=await caller('coordinator','intrack_template_command',[randomUUID(),'reserve',payload]);
 await db.query("insert into storage.objects(bucket_id,name) values('ojt-templates',$1)",[reserved.path]);
 await db.query("update intrack.template_uploads set expires_at=now()-interval '1 minute' where id=$1",[reserved.uploadId]);
 await assert.rejects(()=>caller('coordinator','intrack_claim_template_cleanup',[50]));
 const items=(await db.query('select public.intrack_claim_template_cleanup(50) items')).rows[0].items;
 assert.ok(items.some(item=>item.uploadId===reserved.uploadId));
 await assert.rejects(()=>caller('coordinator','intrack_template_command',[randomUUID(),'publish',{programCode:'BSIT',uploadId:reserved.uploadId,approvalReference:'test'}]));
 await assert.rejects(()=>db.query('select public.intrack_ack_template_cleanup($1)',[reserved.uploadId]));
 await db.query("delete from storage.objects where bucket_id='ojt-templates' and name=$1",[reserved.path]);
 await db.query('select public.intrack_ack_template_cleanup($1)',[reserved.uploadId]);
 await db.query('select public.intrack_ack_template_cleanup($1)',[reserved.uploadId]);
 const remaining=(await db.query('select public.intrack_claim_template_cleanup(50) items')).rows[0].items;
 assert.ok(!remaining.some(item=>item.uploadId===reserved.uploadId));
 assert.ok((await db.query("select count(*)::integer n from intrack.template_versions where status='published'")).rows[0].n>0);
});
async function caller(who,fn,args,aal='aal2'){
 await db.exec('begin');try{
 await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:people[who]?.sub,aal,user_metadata:{role:'coordinator'}})]);
 await db.exec('set local role authenticated');const result=await db.query(`select public.${fn}(${args.map((_,i)=>'$'+(i+1)).join(',')}) as result`,args);await db.exec('commit');return result.rows[0].result;
 }catch(error){await db.exec('rollback');throw error;}
}
async function fixture(selectedPolicy=policy){
 const enrollment=(await db.query("insert into intrack.enrollments(student_id,program_id,term_id,policy_version_id,component,attempt,required_minutes,lifecycle) values($1,$2,$3,$4,1,(select coalesce(max(attempt),0)+1 from intrack.enrollments),30000,'during_ojt') returning id",[people.student.id,program,term,selectedPolicy])).rows[0].id;
 const company=(await db.query("insert into intrack.companies(name,address) values('Test','Test') returning id")).rows[0].id;
 const placement=(await db.query("insert into intrack.placements(enrollment_id,company_id,starts_on,ends_on,active,latitude,longitude,radius_meters,schedule_snapshot) values($1,$2,'2020-01-01','2030-12-31',true,14.5,121,500,$3) returning id",[enrollment,company,{weekdays:[1,2,3,4,5,6,7],start:'00:00',end:'23:59',breaks:[{start:'12:00',end:'13:00'}]}])).rows[0].id;
 await db.query('insert into intrack.adviser_assignments(enrollment_id,adviser_id,assigned_by) values($1,$2,$3)',[enrollment,people.adviser.id,people.coordinator.id]);
 await db.query("insert into intrack.enrollment_events(enrollment_id,actor_id,action,reason,command_id,before_revision,after_revision,from_stage,to_stage,from_outcome,to_outcome,from_clearance,to_clearance,basis_snapshot,created_at) values($1,$3,'issue_clearance','Synthetic',gen_random_uuid(),0,1,'pre_ojt','during_ojt','active','active','not_issued','active',jsonb_build_object('placementId',$2::uuid),'2020-01-01')",[enrollment,placement,people.coordinator.id]);
 await db.query('update intrack.enrollments set revision=1 where id=$1',[enrollment]);
 return {enrollment,placement};
}
const rev=async id=>(await db.query('select revision from intrack.enrollments where id=$1',[id])).rows[0].revision;
const gps=()=>({latitude:14.5,longitude:121,accuracyMeters:5,capturedAt:new Date().toISOString()});
async function punch(f,action,extra={},id=randomUUID(),who='student'){
 return caller(who,'intrack_attendance_command',[id,action,{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),gps:gps(),...extra}]);
}
async function historical(f,start='2026-09-01T08:00:00+08:00',end='2026-09-01T17:00:00+08:00'){
 return (await db.query("insert into intrack.attendance_sessions(enrollment_id,placement_id,clock_in_at,clock_out_at,original_clock_in_at,original_clock_out_at,attendance_date,gps_in,policy_snapshot,authority_snapshot,status) select $1,$2,$3,$4,$3,$4,($3::timestamptz at time zone 'Asia/Manila')::date,'{}',jsonb_build_object('attendance',v.attendance_policy,'schedule',p.schedule_snapshot),'{}','pending' from intrack.policy_versions v,intrack.placements p where v.id=$5 and p.id=$2 returning id",[f.enrollment,f.placement,start,end,policy])).rows[0].id;
}
test('attendance scope denies foreign students, missing staff MFA and anonymous reads',async()=>{
 const f=await fixture();await assert.rejects(()=>punch(f,'clock_in',{},randomUUID(),'other'));
 await assert.rejects(()=>caller('coordinator','intrack_list_attendance',[f.enrollment,'coordinator',null],'aal1'));
 await assert.rejects(()=>caller('other','intrack_list_dtrs',[f.enrollment,'student']));
});
test('GPS rejection persists a retry receipt and never creates a session; valid retry uses a new command',async()=>{
 const f=await fixture();const command=randomUUID();const payload={enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),gps:{...gps(),latitude:0}};
 const denied=await caller('student','intrack_attendance_command',[command,'clock_in',payload]);assert.equal(denied.accepted,false);
 assert.deepEqual(await caller('student','intrack_attendance_command',[command,'clock_in',payload]),denied);
 assert.equal((await db.query('select count(*)::integer as count from intrack.attendance_sessions where enrollment_id=$1',[f.enrollment])).rows[0].count,0);
 const accepted=await punch(f,'clock_in',{clockInAt:'2000-01-01'});assert.equal(accepted.accepted,true);
 assert.ok(Date.parse(accepted.receivedAt)>Date.now()-10000);await assert.rejects(()=>punch(f,'clock_in'));
});
test('historical closeout keeps its original basis and becomes disputed after suspension',async()=>{
 const f=await fixture();const clocked=await punch(f,'clock_in');
 await db.query("insert into intrack.enrollment_events(enrollment_id,actor_id,action,reason,command_id,before_revision,after_revision,from_stage,to_stage,from_outcome,to_outcome,from_clearance,to_clearance,basis_snapshot) values($1,$3,'suspend_clearance','Synthetic suspension',gen_random_uuid(),1,2,'during_ojt','during_ojt','active','active','active','suspended',jsonb_build_object('placementId',$2::uuid))",[f.enrollment,f.placement,people.coordinator.id]);
 const closed=await punch(f,'clock_out',{sessionId:clocked.sessionId,expectedSessionRevision:0});assert.equal(closed.status,'disputed');
 const s=(await db.query('select * from intrack.attendance_sessions where id=$1',[clocked.sessionId])).rows[0];assert.equal(s.authority_snapshot.clearance,'active');assert.equal(s.net_minutes,null);
});
test('DTR credit subtracts merged breaks and honors whole-day cap across ordered shifts',async()=>{
 const f=await fixture();await historical(f);const cmd=async(who,payload)=>caller(who,'intrack_dtr_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...payload}]);
 const period=await cmd('coordinator',{action:'configure_period',periodKey:'september',startsOn:'2026-09-01',endsOn:'2026-09-30',approvalReference:'TEST ONLY'});
 const generated=await cmd('student',{action:'generate',periodId:period.id});
 await cmd('student',{action:'submit',dtrId:generated.id,expectedDtrRevision:0});
 await assert.rejects(()=>cmd('other',{action:'approve',dtrId:generated.id,expectedDtrRevision:1}));
 await cmd('adviser',{action:'approve',dtrId:generated.id,expectedDtrRevision:1});
 assert.equal((await db.query('select sum(minutes)::integer as minutes from intrack.hour_credits where enrollment_id=$1 and invalidated_at is null',[f.enrollment])).rows[0].minutes,480);
 await assert.rejects(()=>cmd('adviser',{action:'approve',dtrId:generated.id,expectedDtrRevision:1}));
});
test('DTR rejects open sessions, late source additions and stale snapshots without partial credit',async()=>{
 const f=await fixture();await historical(f);const cmd=async(who,p)=>caller(who,'intrack_dtr_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...p}]);
 const period=await cmd('coordinator',{action:'configure_period',periodKey:'september',startsOn:'2026-09-01',endsOn:'2026-09-30',approvalReference:'TEST ONLY'});
 const d=await cmd('student',{action:'generate',periodId:period.id});await cmd('student',{action:'submit',dtrId:d.id,expectedDtrRevision:0});
 await historical(f,'2026-09-02T08:00:00+08:00','2026-09-02T17:00:00+08:00');
 await assert.rejects(()=>cmd('adviser',{action:'approve',dtrId:d.id,expectedDtrRevision:1}));
 assert.equal((await db.query('select count(*)::integer as count from intrack.hour_credits where enrollment_id=$1',[f.enrollment])).rows[0].count,0);
});
test('overnight allocation splits Manila dates and overlapping unpaid breaks are counted once',async()=>{
 const f=await fixture();await db.query('update intrack.placements set schedule_snapshot=$2 where id=$1',[f.placement,{weekdays:[1,2,3,4,5,6,7],start:'22:00',end:'06:00',overnight:true,breaks:[{start:'00:00',end:'00:30'},{start:'00:15',end:'00:45'}]}]);
 const id=await historical(f,'2026-09-01T22:00:00+08:00','2026-09-02T06:00:00+08:00');
 assert.equal((await db.query("select intrack.session_day_minutes(s,'2026-09-01') as minutes from intrack.attendance_sessions s where id=$1",[id])).rows[0].minutes,120);
 assert.equal((await db.query("select intrack.session_day_minutes(s,'2026-09-02') as minutes from intrack.attendance_sessions s where id=$1",[id])).rows[0].minutes,315);
});
test('task submissions are immutable, current-adviser reviewed and versioned after a revision request',async()=>{
 const f=await fixture();const cmd=async(who,p)=>caller(who,'intrack_academic_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),kind:'task',...p}]);
 const created=await cmd('student',{action:'submit',taskDate:'2026-09-01',content:{description:'Synthetic task'}});
 const task=(await db.query('select * from intrack.task_versions where id=$1',[created.id])).rows[0];assert.match(task.content_hash,/^[a-f0-9]{64}$/);
 await assert.rejects(()=>db.query("update intrack.task_versions set content='{}' where id=$1",[task.id]));
 await assert.rejects(()=>cmd('other',{action:'approve',artifactId:task.id,expectedArtifactRevision:0}));
 await cmd('adviser',{action:'request_revision',artifactId:task.id,expectedArtifactRevision:0,reason:'Needs details'});
 const next=await cmd('student',{action:'submit',taskKey:task.task_key,expectedArtifactRevision:1,taskDate:'2026-09-01',content:{description:'Revised task'}});
 assert.notEqual(next.id,task.id);assert.equal((await db.query('select is_current from intrack.task_versions where id=$1',[task.id])).rows[0].is_current,false);
});
test('resolution uploads remain owned immutable reservations and finalize only after worker validation',async()=>{
 const f=await fixture();const cmd=async(who,action,p)=>caller(who,'intrack_resolution_file_command',[randomUUID(),action,{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...p}]);
 const file=await cmd('student','reserve',{name:'proof.pdf',mimeType:'application/pdf',bytes:64});
 assert.equal(await caller('student','intrack_can_upload_requirement',[file.path]),true);
 assert.equal(await caller('other','intrack_can_upload_requirement',[file.path]),false);
 await assert.rejects(()=>cmd('student','finalize',{documentId:file.documentId}));
 await db.query("update intrack.documents set status='validated',sha256=$2,validated_at=now() where id=$1",[file.documentId,'a'.repeat(64)]);
 await cmd('student','finalize',{documentId:file.documentId});
 assert.equal((await caller('adviser','intrack_requirement_file',[file.documentId,'adviser'])).status,'attached');
 await assert.rejects(()=>cmd('other','finalize',{documentId:file.documentId}));
});
test('approved corrections invalidate old credits and DTRs while preserving original punch and revision history',async()=>{
 const f=await fixture();const session=await historical(f);const cmd=async(who,p)=>caller(who,'intrack_dtr_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...p}]);
 const period=await cmd('coordinator',{action:'configure_period',periodKey:'september',startsOn:'2026-09-01',endsOn:'2026-09-30',approvalReference:'TEST ONLY'});
 const d=await cmd('student',{action:'generate',periodId:period.id});await cmd('student',{action:'submit',dtrId:d.id,expectedDtrRevision:0});await cmd('adviser',{action:'approve',dtrId:d.id,expectedDtrRevision:1});
 const evidence=(await db.query("insert into intrack.documents(enrollment_id,purpose,uploaded_by,object_path,original_name,mime_type,byte_count,status,sha256,validated_at) values($1,'attendance_resolution',$2,$3,'proof.pdf','application/pdf',64,'attached',$4,now()) returning id",[f.enrollment,people.student.id,randomUUID(),'a'.repeat(64)])).rows[0].id;
 const correct=async(who,p)=>caller(who,'intrack_attendance_correction',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),expectedSessionRevision:0,reason:'Synthetic evidence',...p}]);
 const request=await correct('student',{action:'request',sessionId:session,evidenceDocumentId:evidence,clockInAt:'2026-09-01T09:00:00+08:00',clockOutAt:'2026-09-01T17:00:00+08:00'});
 await correct('adviser',{action:'approve',requestId:request.id,expectedRequestRevision:0});
 assert.equal((await db.query('select count(*)::integer as count from intrack.hour_credits where enrollment_id=$1 and invalidated_at is null',[f.enrollment])).rows[0].count,0);
 assert.equal((await db.query('select status from intrack.dtr_versions where id=$1',[d.id])).rows[0].status,'needs_revision');
 const updated=(await db.query('select * from intrack.attendance_sessions where id=$1',[session])).rows[0];assert.equal(updated.revision,1);assert.notEqual(updated.clock_in_at,updated.original_clock_in_at);
 assert.equal((await db.query('select count(*)::integer as count from intrack.attendance_session_revisions where session_id=$1',[session])).rows[0].count,1);
});
test('journal freezes all approved period tasks and refuses missing configured reflection fields',async()=>{
 const p=(await db.query("insert into intrack.policy_versions(program_id,component,version,year_level,semester,required_minutes) values($1,1,2,4,'2',30000) returning id",[program])).rows[0].id;
 const definition=(await db.query("insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,allowed_submission_stages,recurrence) values($1,'JOURNAL','Test journal','during','journal','adviser',array['during_ojt'],$2) returning id",[p,{kind:'once',startsOn:'2026-09-01',endsOn:'2026-09-07',requiredFields:['reflection'],requireApprovedDtr:false}])).rows[0].id;
 await db.query('update intrack.policy_versions set confirmed_by=$2,confirmed_at=now() where id=$1',[p,people.coordinator.id]);
 const f=await fixture(p);
 const requirement=(await db.query('insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot) select $1,id,to_jsonb(d) from intrack.requirement_definitions d where id=$2 returning id',[f.enrollment,definition])).rows[0].id;
 const cmd=async(who,payload)=>caller(who,'intrack_academic_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...payload}]);
 const t=await cmd('student',{kind:'task',action:'submit',taskDate:'2026-09-01',content:{description:'Test activity'}});
 await cmd('adviser',{kind:'task',action:'approve',artifactId:t.id,expectedArtifactRevision:0});
 await assert.rejects(()=>cmd('student',{kind:'journal',action:'submit',requirementId:requirement,content:{}}));
 const j=await cmd('student',{kind:'journal',action:'submit',requirementId:requirement,content:{reflection:'Synthetic reflection'}});
 assert.equal((await db.query('select count(*)::integer as count from intrack.journal_tasks where journal_id=$1',[j.id])).rows[0].count,1);
 await cmd('adviser',{kind:'journal',action:'approve',artifactId:j.id,expectedArtifactRevision:0});
 assert.equal((await db.query('select status from intrack.journal_versions where id=$1',[j.id])).rows[0].status,'approved');
 await caller('student','intrack_bind_specialized_requirement',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),requirementId:requirement,expectedRequirementRevision:0,artifactId:j.id}]);
 assert.equal((await db.query('select intrack.specialized_requirement_ready($1) as ready',[requirement])).rows[0].ready,true);
 const beforeRevocation=await rev(f.enrollment);
 await db.query("insert into intrack.enrollment_events(enrollment_id,actor_id,action,reason,command_id,before_revision,after_revision,from_stage,to_stage,from_outcome,to_outcome,from_clearance,to_clearance,basis_snapshot) values($1,$2,'revoke_clearance','Synthetic revoked basis',gen_random_uuid(),$3,$3+1,'during_ojt','during_ojt','active','active','active','revoked','{}')",[f.enrollment,people.coordinator.id,beforeRevocation]);
 await db.query('update intrack.enrollments set revision=revision+1 where id=$1',[f.enrollment]);
 await caller('coordinator','intrack_revoke_approval',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),kind:'task',artifactId:t.id,expectedArtifactRevision:1,reason:'Synthetic task source withdrawn'}]);
 assert.equal((await db.query('select status from intrack.journal_versions where id=$1',[j.id])).rows[0].status,'needs_revision');
 assert.equal((await db.query('select intrack.specialized_requirement_ready($1) as ready',[requirement])).rows[0].ready,false);
});
test('reconstruction cannot fabricate historical deployment authority and creates no session on failure',async()=>{
 const f=await fixture();
 const evidence=(await db.query("insert into intrack.documents(enrollment_id,purpose,uploaded_by,object_path,original_name,mime_type,byte_count,status,sha256,validated_at) values($1,'attendance_resolution',$2,$3,'proof.pdf','application/pdf',64,'attached',$4,now()) returning id",[f.enrollment,people.student.id,randomUUID(),'b'.repeat(64)])).rows[0].id;
 const cmd=async(who,payload)=>caller(who,'intrack_reconstruction_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),reason:'Test missed clock',...payload}]);
 const request=await cmd('student',{action:'request',placementId:f.placement,evidenceDocumentId:evidence,clockInAt:'2026-09-01T08:00:00+08:00',clockOutAt:'2026-09-01T17:00:00+08:00'});
 await assert.rejects(()=>cmd('adviser',{action:'approve',requestId:request.id,expectedRequestRevision:0}));
 assert.equal((await db.query('select count(*)::integer as count from intrack.attendance_sessions where enrollment_id=$1',[f.enrollment])).rows[0].count,0);
});
test('evaluations require a frozen rubric, exact signed-evidence attachment and verified bounded scores',async()=>{
 const p=(await db.query("insert into intrack.policy_versions(program_id,component,version,year_level,semester,required_minutes) values($1,1,3,4,'2',30000) returning id",[program])).rows[0].id;
 const rubric=await caller('coordinator','intrack_publish_rubric',[randomUUID(),{policyId:p,kind:'final',title:'Synthetic rubric',approvalReference:'TEST ONLY',calculationRule:{mode:'sum_points'},criteria:[{label:'Criterion',maxPointsHundredths:2000}]}]);
 let criterion=(await db.query('select id from intrack.evaluation_criteria where template_id=$1',[rubric.rubricId])).rows[0].id;
 const definition=(await db.query("insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,allowed_submission_stages,recurrence) values($1,'EVAL','Synthetic evaluation','post','evaluation','adviser',array['during_ojt','post_ojt'],$2) returning id",[p,{kind:'once',rubricTemplateId:rubric.rubricId,evaluationStartsOn:'2026-09-01',evaluationEndsOn:'2026-09-30'}])).rows[0].id;
 await db.query('update intrack.policy_versions set confirmed_by=$2,confirmed_at=now() where id=$1',[p,people.coordinator.id]);
 const published=await caller('coordinator','intrack_publish_policy',[randomUUID(),{sourcePolicyId:p,approvalReference:'TEST ONLY',attendancePolicy:{confirmed:true,dailyCapMinutes:480,maxSessionMinutes:1440,maxAccuracyMeters:100,maxCoordinateAgeSeconds:60},requirements:['EVAL','SUPERVISOR_FORM'].map(code=>({code,title:'Synthetic evaluation',stage:'post',evidenceType:'evaluation',reviewer:'adviser',allowedStages:['during_ojt','post_ojt'],recurrence:{kind:'once',rubricTemplateId:rubric.rubricId,evaluationStartsOn:'2026-09-01',evaluationEndsOn:'2026-09-30'}}))}]);
 const copiedDefinition=(await db.query("select * from intrack.requirement_definitions where policy_version_id=$1 and code='EVAL'",[published.policyId])).rows[0];
 assert.notEqual(copiedDefinition.recurrence.rubricTemplateId,rubric.rubricId);
 criterion=(await db.query('select id from intrack.evaluation_criteria where template_id=$1',[copiedDefinition.recurrence.rubricTemplateId])).rows[0].id;
 const f=await fixture(published.policyId);const requirement=(await db.query('insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot) select $1,id,to_jsonb(d) from intrack.requirement_definitions d where id=$2 returning id',[f.enrollment,copiedDefinition.id])).rows[0].id;
 const evidence=(await db.query("insert into intrack.documents(enrollment_id,requirement_id,uploaded_by,object_path,original_name,mime_type,byte_count,status,sha256,validated_at) values($1,$2,$3,$4,'signed.pdf','application/pdf',64,'attached',$5,now()) returning id",[f.enrollment,requirement,people.student.id,randomUUID(),'c'.repeat(64)])).rows[0].id;
 const cmd=async(who,payload)=>caller(who,'intrack_evaluation_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...payload}]);
 const input={action:'submit',requirementId:requirement,documentId:evidence,evaluatorName:'Synthetic evaluator',evaluatorAffiliation:'Synthetic HTE',evaluatedOn:'2026-09-20',scores:[{criterionId:criterion,pointsHundredths:1500}]};
 await assert.rejects(()=>cmd('student',{...input,scores:[{criterionId:criterion,pointsHundredths:2500}]}));
 const evaluation=await cmd('student',input);
 await assert.rejects(()=>cmd('adviser',{action:'approve',artifactId:evaluation.id,expectedArtifactRevision:0,reason:'Incomplete verification'}));
 await cmd('adviser',{action:'approve',artifactId:evaluation.id,expectedArtifactRevision:0,reason:'Signed source and transcription checked',signedEvidenceVerified:true,scoresVerified:true});
 assert.equal((await db.query('select points::text as points from intrack.evaluation_scores where evaluation_id=$1',[evaluation.id])).rows[0].points,'15.00');
 await assert.rejects(()=>db.query('update intrack.evaluation_scores set points=1 where evaluation_id=$1',[evaluation.id]));
 const otherDefinition=(await db.query("select * from intrack.requirement_definitions where policy_version_id=$1 and code='SUPERVISOR_FORM'",[published.policyId])).rows[0];
 assert.equal(otherDefinition.recurrence.rubricTemplateId,copiedDefinition.recurrence.rubricTemplateId);
 const otherRequirement=(await db.query('insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot) select $1,id,to_jsonb(d) from intrack.requirement_definitions d where id=$2 returning id',[f.enrollment,otherDefinition.id])).rows[0].id;
 const otherEvidence=(await db.query("insert into intrack.documents(enrollment_id,requirement_id,uploaded_by,object_path,original_name,mime_type,byte_count,status,sha256,validated_at) values($1,$2,$3,$4,'other-signed.pdf','application/pdf',64,'attached',$5,now()) returning id",[f.enrollment,otherRequirement,people.student.id,randomUUID(),'f'.repeat(64)])).rows[0].id;
 const otherEvaluation=await cmd('student',{...input,requirementId:otherRequirement,documentId:otherEvidence});
 assert.notEqual(otherEvaluation.id,evaluation.id);
 assert.equal((await db.query("select count(*)::integer as count from intrack.evaluation_versions where enrollment_id=$1 and kind='final' and is_current",[f.enrollment])).rows[0].count,2);
});
test('portfolio reviews enforce adviser/coordinator order, content checks and explicit completion/reopen history',async()=>{
 const p=(await db.query("insert into intrack.policy_versions(program_id,component,version,year_level,semester,required_minutes,attendance_policy) select $1,1,(select max(version)+1 from intrack.policy_versions where program_id=$1 and component=1),4,'2',480,attendance_policy from intrack.policy_versions where id=$2 returning id",[program,policy])).rows[0].id;
 const contents=(await db.query('select id from intrack.portfolio_content_catalog order by ordinal')).rows.map(c=>({id:c.id,mandatory:true}));let portfolioDefinition;
 for(const stage of ['pre','during','post','portfolio']){
  const definition=(await db.query("insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,allowed_submission_stages,recurrence) values($1,$2,$2,$2,$3,$4,array['portfolio'],$5) returning id",[p,stage,stage==='portfolio'?'portfolio':'staff_verification',stage==='portfolio'?'both':'adviser',stage==='portfolio'?{kind:'once',contents}:{}])).rows[0].id;
  if(stage==='portfolio')portfolioDefinition=definition;
 }
 await db.query('update intrack.policy_versions set confirmed_by=$2,confirmed_at=now() where id=$1',[p,people.coordinator.id]);
 const f=await fixture(p);await db.query('update intrack.enrollments set required_minutes=480 where id=$1',[f.enrollment]);
 await db.query("insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot,waiver_actor,waiver_reason,waived_at) select $1,id,to_jsonb(d),$3,'Synthetic explicit waiver',now() from intrack.requirement_definitions d where policy_version_id=$2 and stage<>'portfolio'",[f.enrollment,p,people.coordinator.id]);
 const requirement=(await db.query('insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot) select $1,id,to_jsonb(d) from intrack.requirement_definitions d where id=$2 returning id',[f.enrollment,portfolioDefinition])).rows[0].id;
 await historical(f);const dtrcmd=async(who,payload)=>caller(who,'intrack_dtr_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...payload}]);
 const period=await dtrcmd('coordinator',{action:'configure_period',periodKey:'september',startsOn:'2026-09-01',endsOn:'2026-09-30',approvalReference:'TEST ONLY'});
 const d=await dtrcmd('student',{action:'generate',periodId:period.id});await dtrcmd('student',{action:'submit',dtrId:d.id,expectedDtrRevision:0});await dtrcmd('adviser',{action:'approve',dtrId:d.id,expectedDtrRevision:1});
 await db.query("update intrack.enrollments set lifecycle='portfolio' where id=$1",[f.enrollment]);
 const evidence=(await db.query("insert into intrack.documents(enrollment_id,requirement_id,uploaded_by,object_path,original_name,mime_type,byte_count,status,sha256,validated_at) values($1,$2,$3,$4,'portfolio.pdf','application/pdf',64,'attached',$5,now()) returning id",[f.enrollment,requirement,people.student.id,randomUUID(),'d'.repeat(64)])).rows[0].id;
 const cmd=async(who,payload)=>caller(who,'intrack_portfolio_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...payload}]);
 const portfolio=await cmd('student',{action:'submit',requirementId:requirement,documentId:evidence});
 await assert.rejects(()=>cmd('coordinator',{action:'approve',role:'coordinator',artifactId:portfolio.id,expectedArtifactRevision:0,reason:'Test',verifiedContentIds:contents.map(c=>c.id)}));
 await assert.rejects(()=>cmd('adviser',{action:'approve',role:'adviser',artifactId:portfolio.id,expectedArtifactRevision:0,reason:'Test',verifiedContentIds:[]}));
 await cmd('adviser',{action:'approve',role:'adviser',artifactId:portfolio.id,expectedArtifactRevision:0,reason:'Reviewed PDF contents',verifiedContentIds:contents.map(c=>c.id)});
 await cmd('coordinator',{action:'approve',role:'coordinator',artifactId:portfolio.id,expectedArtifactRevision:1,reason:'Final PDF verified',verifiedContentIds:contents.map(c=>c.id)});
 await caller('student','intrack_bind_specialized_requirement',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),requirementId:requirement,expectedRequirementRevision:0,artifactId:portfolio.id}]);
 const final=async(action)=>caller('coordinator','intrack_finalization_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),action,reason:'Synthetic finalization'}]);
 await final('complete');assert.equal((await db.query('select outcome from intrack.enrollments where id=$1',[f.enrollment])).rows[0].outcome,'completed');
 await assert.rejects(async()=>caller('coordinator','intrack_revoke_approval',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),kind:'portfolio',artifactId:portfolio.id,expectedArtifactRevision:2,reason:'Must reopen first'}]));
 await final('reopen_completion');assert.equal((await db.query('select outcome from intrack.enrollments where id=$1',[f.enrollment])).rows[0].outcome,'active');
 assert.equal((await db.query('select count(*)::integer as count from intrack.completion_summaries where enrollment_id=$1',[f.enrollment])).rows[0].count,1);
 assert.equal((await db.query('select status from intrack.portfolio_versions where id=$1',[portfolio.id])).rows[0].status,'needs_revision');
});
test('receiver read state and enrollment reports enforce current relationship boundaries',async()=>{
 const f=await fixture();const message=await caller('student','intrack_send_message',[randomUUID(),f.enrollment,'student',people.adviser.id,'Synthetic local message']);
 await assert.rejects(()=>caller('student','intrack_read_message',[randomUUID(),message.messageId,'student']));
 await caller('adviser','intrack_read_message',[randomUUID(),message.messageId,'adviser']);
 assert.ok((await db.query('select read_at from intrack.messages where id=$1',[message.messageId])).rows[0].read_at);
 const unrelated=await caller('other','intrack_enrollment_report',['student','',0,30]);assert.equal(unrelated.total,0);
 const owned=await caller('student','intrack_enrollment_report',['student','student',0,100]);assert.ok(owned.items.some(e=>e.id===f.enrollment));
 await assert.rejects(()=>caller('student','intrack_enrollment_report',['student','',0,1000]));
});
test('revoking the historical MOA used for clearance suspends authority and removes accepted evidence eligibility',async()=>{
 const policyId=(await db.query("insert into intrack.policy_versions(program_id,component,version,year_level,semester,required_minutes) values($1,1,(select max(version)+1 from intrack.policy_versions where program_id=$1 and component=1),4,'2',30000) returning id",[program])).rows[0].id;
 const definition=(await db.query("insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,allowed_submission_stages) values($1,'MOA','Synthetic MOA','pre','moa','coordinator',array['pre_ojt','during_ojt']) returning id",[policyId])).rows[0].id;
 await db.query('update intrack.policy_versions set attendance_policy=(select attendance_policy from intrack.policy_versions where id=$2) where id=$1',[policyId,policy]);
 await db.query('update intrack.policy_versions set confirmed_by=$2,confirmed_at=now() where id=$1',[policyId,people.coordinator.id]);
 const f=await fixture(policyId);await db.query('update intrack.enrollments set revision=2 where id=$1',[f.enrollment]);
 const requirement=(await db.query('insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot) select $1,id,to_jsonb(d) from intrack.requirement_definitions d where id=$2 returning id',[f.enrollment,definition])).rows[0].id;
 const doc=(await db.query("insert into intrack.documents(enrollment_id,requirement_id,uploaded_by,object_path,original_name,mime_type,byte_count,status,sha256,validated_at) values($1,$2,$3,$4,'moa.pdf','application/pdf',64,'attached',$5,now()) returning id",[f.enrollment,requirement,people.student.id,randomUUID(),'e'.repeat(64)])).rows[0].id;
 const submission=(await db.query("insert into intrack.submission_versions(enrollment_id,requirement_id,version,submitted_by,document_id,status,submitted_at,is_current) values($1,$2,1,$3,$4,'approved',now(),false) returning id",[f.enrollment,requirement,people.student.id,doc])).rows[0].id;
 await db.query("insert into intrack.clearance_events(enrollment_id,placement_id,moa_submission_id,status,actor_id,reason,command_id,enrollment_revision,basis_snapshot,effective_at) values($1,$2,$3,'active',$4,'Historical basis',gen_random_uuid(),1,'{}','2026-08-01')",[f.enrollment,f.placement,submission,people.coordinator.id]);
 const reconstruct=async(who,payload)=>caller(who,'intrack_reconstruction_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),reason:'Synthetic corroborated interval',...payload}]);
 const request=await reconstruct('student',{action:'request',placementId:f.placement,evidenceDocumentId:doc,clockInAt:'2026-09-01T08:00:00+08:00',clockOutAt:'2026-09-01T17:00:00+08:00'});
 const reconstructed=await reconstruct('adviser',{action:'approve',requestId:request.id,expectedRequestRevision:0});assert.ok(reconstructed.sessionId);
 assert.equal((await db.query('select status from intrack.attendance_sessions where id=$1',[reconstructed.sessionId])).rows[0].status,'pending');
 assert.equal((await db.query("select intrack.requirement_gate($1,'pre',$2) as gate",[f.enrollment,submission])).rows[0].gate.ready,true);
 await caller('coordinator','intrack_revoke_approval',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),kind:'requirement',artifactId:submission,expectedArtifactRevision:0,reason:'Historical signed copy no longer valid'}]);
 assert.equal((await db.query("select intrack.requirement_gate($1,'pre',$2) as gate",[f.enrollment,submission])).rows[0].gate.ready,false);
 assert.equal((await db.query('select intrack.current_clearance($1) as clearance',[f.enrollment])).rows[0].clearance,'suspended');
 assert.equal((await db.query('select status from intrack.moa_routing_events where enrollment_id=$1 order by enrollment_revision desc limit 1',[f.enrollment])).rows[0].status,'IN-PROCESS FOR REVISION');
});
test('placement breaks require explicit paid treatment and bounded nonoverlapping shift windows',async()=>{
 const f=await fixture();const before=await rev(f.enrollment);
 await db.query("insert into intrack.enrollment_events(enrollment_id,actor_id,action,reason,command_id,before_revision,after_revision,from_stage,to_stage,from_outcome,to_outcome,from_clearance,to_clearance,basis_snapshot) values($1,$2,'revoke_clearance','Synthetic revoked basis',gen_random_uuid(),$3,$3+1,'during_ojt','during_ojt','active','active','active','revoked','{}')",[f.enrollment,people.coordinator.id,before]);
 await db.query('update intrack.enrollments set revision=revision+1 where id=$1',[f.enrollment]);
 const configure=async(breaks)=>caller('coordinator','intrack_configure_placement',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),companyName:'Synthetic company',companyAddress:'Synthetic address',approvalReference:'TEST ONLY',startsOn:'2026-09-01',endsOn:'2026-10-31',latitude:14.5,longitude:121,radiusMeters:500,schedule:{weekdays:[1,2,3,4,5],start:'08:00',end:'17:00',breaks}}]);
 await assert.rejects(()=>configure([{start:'12:00',end:'13:00'}]));
 await assert.rejects(()=>configure([{start:'17:00',end:'18:00',paid:false}]));
 await assert.rejects(()=>configure([{start:'12:00',end:'13:00',paid:false},{start:'12:30',end:'13:30',paid:true}]));
 const accepted=await configure([{start:'12:00',end:'13:00',paid:false}]);assert.ok(accepted.placementId);
});
test('withdrawn enrollment can resolve and credit prior authorized work, never post-withdrawal intervals or new punches',async()=>{
 const f=await fixture();await historical(f);
 await db.query("insert into intrack.enrollment_events(enrollment_id,actor_id,action,reason,command_id,before_revision,after_revision,from_stage,to_stage,from_outcome,to_outcome,from_clearance,to_clearance,basis_snapshot,created_at) values($1,$2,'withdraw','Synthetic withdrawal',gen_random_uuid(),1,2,'during_ojt','during_ojt','active','withdrawn','active','revoked','{}','2026-09-02T00:00:00+08:00')",[f.enrollment,people.coordinator.id]);
 await db.query("update intrack.enrollments set outcome='withdrawn',revision=2 where id=$1",[f.enrollment]);
 await assert.rejects(()=>punch(f,'clock_in'));
 assert.equal((await db.query("select intrack.historical_training_allowed($1,$2,'2026-09-01T08:00:00+08:00','2026-09-01T17:00:00+08:00') as allowed",[f.enrollment,f.placement])).rows[0].allowed,true);
 assert.equal((await db.query("select intrack.historical_training_allowed($1,$2,'2026-09-02T08:00:00+08:00','2026-09-02T17:00:00+08:00') as allowed",[f.enrollment,f.placement])).rows[0].allowed,false);
 const cmd=async(who,payload)=>caller(who,'intrack_dtr_command',[randomUUID(),{enrollmentId:f.enrollment,expectedEnrollmentRevision:await rev(f.enrollment),...payload}]);
 const period=await cmd('coordinator',{action:'configure_period',periodKey:'september',startsOn:'2026-09-01',endsOn:'2026-09-30',approvalReference:'TEST ONLY'});
 const d=await cmd('student',{action:'generate',periodId:period.id});await cmd('student',{action:'submit',dtrId:d.id,expectedDtrRevision:0});await cmd('adviser',{action:'approve',dtrId:d.id,expectedDtrRevision:1});
 assert.equal((await db.query('select sum(minutes)::integer as minutes from intrack.hour_credits where enrollment_id=$1 and invalidated_at is null',[f.enrollment])).rows[0].minutes,480);
 assert.equal((await db.query('select outcome from intrack.enrollments where id=$1',[f.enrollment])).rows[0].outcome,'withdrawn');
});
