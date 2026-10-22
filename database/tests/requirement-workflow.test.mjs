import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const db=new PGlite();
const ids=Object.fromEntries(['student','other','adviser','unrelated','coordinator'].map(k=>[k,{subject:randomUUID(),profile:randomUUID()}]));
let enrollment, requirement, program, foreignEnrollment,physicalRequirement,moaRequirement;
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth; create schema storage;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated; grant insert,select,update,delete on storage.objects to authenticated;`);
  for(const path of ['../supabase-model.sql','../../supabase/migrations/202610100002_protected_identity.sql','../../supabase/migrations/202610100004_requirement_workflow.sql','../../supabase/migrations/202610100005_requirement_cleanup_receipts.sql',
    '../../supabase/migrations/202610140006_administration_foundation.sql','../../supabase/migrations/202610140007_policy_enrollment_projection.sql','../../supabase/migrations/202610140009_specialized_requirement_files.sql','../../supabase/migrations/202610140010_physical_evidence_moa.sql',
    '../../supabase/migrations/202610140011_placement_clearance_lifecycle.sql','../../supabase/migrations/202610140012_canonical_clearance_projection.sql','../../supabase/migrations/202610140013_requirement_verification_projection.sql','../../supabase/migrations/202610140016_asset_recovery_inventory.sql','../../supabase/migrations/202610170043_requirement_display_metadata.sql']) {
    await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
  }
  program=(await db.query("select id from intrack.programs where code='BSIT'")).rows[0].id;
  for(const [name,id] of Object.entries(ids)) {
    await db.query('insert into auth.users(id,email_confirmed_at) values($1,now())',[id.subject]);
    await db.query("insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,$3,'active',now())",[id.profile,id.subject,name]);
    await db.query('insert into intrack.memberships(profile_id,program_id,role) values($1,$2,$3)',[id.profile,program,['other','student'].includes(name)?'student':name==='coordinator'?'coordinator':'adviser']);
    await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'synthetic-notice')",[id.profile]);
  }
  await db.exec("update intrack.identity_configuration set current_notice_version='synthetic-notice'");
  const policy=(await db.query('select id from intrack.policy_versions where program_id=$1',[program])).rows[0].id;
  await db.query('update intrack.policy_versions set attendance_policy=$2 where id=$1',[policy,{confirmed:true,dailyCapMinutes:480,maxSessionMinutes:1440,maxAccuracyMeters:100,maxCoordinateAgeSeconds:60}]);
  const def=(await db.query(`insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,allowed_submission_stages)
    values($1,'TEST','Synthetic requirement','pre','file','both',array['pre_ojt']) returning id`,[policy])).rows[0].id;
  const physicalDef=(await db.query("insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,allowed_submission_stages) values($1,'PHYSICAL','Synthetic physical evidence','pre','staff_verification','both',array['pre_ojt']) returning id",[policy])).rows[0].id;
  const moaDef=(await db.query("insert into intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer,allowed_submission_stages) values($1,'MOA','Synthetic MOA','pre','moa','coordinator',array['pre_ojt']) returning id",[policy])).rows[0].id;
  await db.query('update intrack.policy_versions set confirmed_by=$1,confirmed_at=now() where id=$2',[ids.coordinator.profile,policy]);
  const term=(await db.query("insert into intrack.academic_terms(academic_year,semester,starts_on,ends_on) values('TEST','2','2026-01-01','2026-12-31') returning id")).rows[0].id;
  enrollment=(await db.query('insert into intrack.enrollments(student_id,program_id,term_id,policy_version_id,component,required_minutes) values($1,$2,$3,$4,1,30000) returning id',[ids.student.profile,program,term,policy])).rows[0].id;
  foreignEnrollment=(await db.query('insert into intrack.enrollments(student_id,program_id,term_id,policy_version_id,component,required_minutes) values($1,$2,$3,$4,1,30000) returning id',[ids.other.profile,program,term,policy])).rows[0].id;
  await db.query('insert into intrack.adviser_assignments(enrollment_id,adviser_id,assigned_by) values($1,$2,$3)',[enrollment,ids.adviser.profile,ids.coordinator.profile]);
  requirement=(await db.query('insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot) select $1,id,to_jsonb(d) from intrack.requirement_definitions d where id=$2 returning id',[enrollment,def])).rows[0].id;
  physicalRequirement=(await db.query('insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot) select $1,id,to_jsonb(d) from intrack.requirement_definitions d where id=$2 returning id',[enrollment,physicalDef])).rows[0].id;
  moaRequirement=(await db.query('insert into intrack.enrollment_requirements(enrollment_id,definition_id,definition_snapshot) select $1,id,to_jsonb(d) from intrack.requirement_definitions d where id=$2 returning id',[enrollment,moaDef])).rows[0].id;
});
after(async()=>db.close());

async function caller(name,sql,args=[],aal='aal2',role='authenticated') {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:ids[name]?.subject,aal,user_metadata:{role:'coordinator'}})]);
    await db.exec(`set local role ${role}`);
    const result=await db.query(sql,args); await db.exec('commit'); return result.rows[0]?.result;
  } catch(e) { await db.exec('rollback'); throw e; }
}
async function payload(extra={}) {
  const e=(await db.query('select revision from intrack.enrollments where id=$1',[enrollment])).rows[0];
  const s=(await db.query('select * from intrack.submission_versions where requirement_id=$1 and is_current',[requirement])).rows[0];
  return {enrollmentId:enrollment,requirementId:requirement,expectedEnrollmentRevision:e.revision,expectedSubmissionRevision:s?.revision??null,submissionId:s?.id??null,...extra};
}
const command=(who,action,p,id=randomUUID(),aal='aal2')=>caller(who,'select public.intrack_requirement_command($1,$2,$3) as result',[id,action,p],aal);
const reserve=async()=>command('student','reserve_upload',await payload({name:'evidence.pdf',mimeType:'application/pdf',bytes:64}));
async function attest(doc,bytes=64,mime='application/pdf',hash='a'.repeat(64)) {
  await db.exec('begin');
  try {await db.exec('set local role service_role'); await db.query('select public.intrack_attest_requirement_file($1,$2,$3,$4)',[doc,bytes,mime,hash]); await db.exec('commit');}
  catch(e){await db.exec('rollback');throw e;}
}

test('reads scope, deny anonymous/unrelated/missing MFA and forged role metadata',async()=>{
  const assigned=await caller('student','select public.intrack_list_requirements($1) as result',['student']);
  assert.equal(assigned.length,3);assert.equal(assigned.find(r=>r.id===requirement).stage,'pre');assert.equal(assigned.find(r=>r.id===requirement).instanceKey,'once');
  assert.deepEqual(await caller('other','select public.intrack_list_requirements($1) as result',['student']),[]);
  assert.deepEqual(await caller('unrelated','select public.intrack_list_requirements($1) as result',['adviser']),[]);
  await assert.rejects(caller('adviser','select public.intrack_list_requirements($1) as result',['adviser'],'aal1'),e=>e.code==='42501');
  await assert.rejects(caller('student','select public.intrack_list_requirements($1) as result',['coordinator']),e=>e.code==='42501');
  await assert.rejects(caller('student','select public.intrack_list_requirements($1) as result',['student'],'aal2','anon'),e=>e.code==='42501');
  await assert.rejects(command('other','reserve_upload',await payload({name:'e.pdf',mimeType:'application/pdf',bytes:64})),e=>e.code==='42501');
});

test('upload reservation is idempotent, owned, private and cannot be overwritten or forged',async()=>{
  const p=await payload({name:'evidence.pdf',mimeType:'application/pdf',bytes:64}),id=randomUUID();
  const first=await command('student','reserve_upload',p,id);
  assert.deepEqual(await command('student','reserve_upload',p,id),first);
  await assert.rejects(command('student','reserve_upload',{...p,bytes:65},id),e=>e.code==='40001');
  assert.equal(await caller('student','select public.intrack_can_upload_requirement($1) as result',[first.path]),true);
  assert.equal(await caller('other','select public.intrack_can_upload_requirement($1) as result',[first.path]),false);
  await caller('student',"insert into storage.objects(bucket_id,name) values('ojt-documents',$1)",[first.path]);
  await assert.rejects(caller('other',"insert into storage.objects(bucket_id,name) values('ojt-documents',$1)",[first.path+'-swapped']),e=>e.code==='42501');
  const visible=await caller('student','select count(*)::integer as result from storage.objects'); assert.equal(visible,0);
  await caller('student',"delete from storage.objects where name=$1",[first.path]);
  assert.equal((await db.query('select count(*)::integer n from storage.objects')).rows[0].n,1);
  await assert.rejects(caller('student','select public.intrack_attest_requirement_file($1,64,\'application/pdf\',$2)',[first.documentId,'a'.repeat(64)]),e=>e.code==='42501');
});

test('unvalidated/expired/wrong files cannot submit; measured mismatch quarantines',async()=>{
  const doc=await reserve();
  await assert.rejects(command('student','submit',await payload({documentId:doc.documentId})),e=>e.code==='42501');
  await attest(doc.documentId,65);
  assert.equal((await db.query('select status from intrack.documents where id=$1',[doc.documentId])).rows[0].status,'quarantined');
  const expired=await reserve();
  await db.query("update intrack.requirement_uploads set expires_at=now()-interval '1 minute' where document_id=$1",[expired.documentId]);
  assert.equal(await caller('student','select public.intrack_can_upload_requirement($1) as result',[expired.path]),false);
  await assert.rejects(attest(expired.documentId),e=>e.code==='40001');
  await assert.rejects(command('student','reserve_upload',await payload({name:'bad.html',mimeType:'text/html',bytes:64})),e=>e.code==='22023');
});

let firstSubmission;
test('submit commits version, audit, notification and receipt together; response retry is safe',async()=>{
  const doc=await reserve();await attest(doc.documentId);
  const p=await payload({documentId:doc.documentId}),id=randomUUID();
  await db.exec(`create function public.synthetic_notification_failure() returns trigger language plpgsql as $$begin raise exception 'Synthetic delivery failure' using errcode='23514';end$$;
    create trigger synthetic_notification_failure before insert on intrack.notifications for each row execute function public.synthetic_notification_failure();`);
  await assert.rejects(command('student','submit',p,id),e=>e.code==='23514');
  assert.equal((await db.query('select count(*)::integer n from intrack.submission_versions')).rows[0].n,0);
  assert.equal((await db.query('select status from intrack.documents where id=$1',[doc.documentId])).rows[0].status,'validated');
  assert.equal((await db.query('select count(*)::integer n from intrack.command_receipts where command_id=$1',[id])).rows[0].n,0);
  await db.exec('drop trigger synthetic_notification_failure on intrack.notifications; drop function public.synthetic_notification_failure();');
  firstSubmission=await command('student','submit',p,id);
  const reloaded=(await caller('student','select public.intrack_list_requirements($1) as result',['student'])).find(r=>r.id===requirement);
  assert.equal(reloaded.submission.documentName,'evidence.pdf');assert.equal(reloaded.submission.mimeType,'application/pdf');
  assert.deepEqual(await command('student','submit',p,id),firstSubmission);
  assert.equal((await db.query('select count(*)::integer n from intrack.submission_versions')).rows[0].n,1);
  assert.equal((await db.query('select count(*)::integer n from intrack.audit_events where command_id=$1',[id])).rows[0].n,1);
  assert.equal((await db.query('select count(*)::integer n from intrack.notifications where event_key=$1',[id])).rows[0].n,1);
  await assert.rejects(command('student','reserve_upload',await payload({name:'replace.pdf',mimeType:'application/pdf',bytes:64})),e=>e.code==='40001');
});

test('sequential review, stale reviewer conflict, reasoned revision, immutable version history',async()=>{
  await assert.rejects(command('unrelated','approve',await payload({role:'adviser'})),e=>e.code==='42501');
  await assert.rejects(command('coordinator','approve',await payload({role:'coordinator'})),e=>e.code==='40001');
  const stale=await payload({role:'adviser'});
  await command('adviser','start_review',stale);
  await assert.rejects(command('student','withdraw',await payload()),e=>e.code==='40001');
  await assert.rejects(command('adviser','approve',stale),e=>e.code==='40001');
  await assert.rejects(command('adviser','request_revision',await payload({role:'adviser'})),e=>e.code==='22023');
  await command('adviser','request_revision',await payload({role:'adviser',remarks:'Replace incomplete evidence'}));
  const doc=await reserve();await attest(doc.documentId);
  const submitted=await command('student','submit',await payload({documentId:doc.documentId}));
  assert.equal(submitted.version,2);
  assert.equal((await db.query('select status from intrack.submission_versions where id=$1',[firstSubmission.submissionId])).rows[0].status,'needs_revision');
  const first=(await command('adviser','approve',await payload({role:'adviser'})));
  assert.equal(first.status,'under_review');
  assert.equal((await command('coordinator','approve',await payload({role:'coordinator'}))).status,'approved');
  const history=await caller('student','select public.intrack_list_requirements($1) as result',['student']);
  assert.equal(history.find(r=>r.id===requirement).history.length,2);
  assert.equal(history.find(r=>r.id===requirement).history[0].reviews.length,2);
});

async function specializedPayload(requirementId,extra={}){
  const e=(await db.query('select revision from intrack.enrollments where id=$1',[enrollment])).rows[0];
  const s=(await db.query('select * from intrack.submission_versions where requirement_id=$1 and is_current',[requirementId])).rows[0];
  return {enrollmentId:enrollment,requirementId,expectedEnrollmentRevision:e.revision,expectedSubmissionRevision:s?.revision??null,submissionId:s?.id??null,...extra};
}
test('physical evidence requires actual staff verification on each version; a student request is not proof',async()=>{
  const submit=()=>specializedPayload(physicalRequirement,{note:'Request to inspect synthetic physical evidence'}).then(p=>caller('student','select public.intrack_submit_physical_requirement($1,$2) as result',[randomUUID(),p]));
  await submit();
  await assert.rejects(command('adviser','approve',await specializedPayload(physicalRequirement,{role:'adviser'})),e=>e.code==='42501');
  await assert.rejects(caller('student','select public.intrack_verify_physical_requirement($1,$2)',[randomUUID(),await specializedPayload(physicalRequirement,{role:'adviser',note:'Pretend verification'})]),e=>e.code==='42501');
  await caller('adviser','select public.intrack_verify_physical_requirement($1,$2)',[randomUUID(),await specializedPayload(physicalRequirement,{role:'adviser',note:'Observed the actual synthetic evidence'})]);
  await command('adviser','request_revision',await specializedPayload(physicalRequirement,{role:'adviser',remarks:'Correct physical evidence'}));
  await submit();
  await assert.rejects(command('adviser','approve',await specializedPayload(physicalRequirement,{role:'adviser'})),e=>e.code==='42501');
  await caller('adviser','select public.intrack_verify_physical_requirement($1,$2)',[randomUUID(),await specializedPayload(physicalRequirement,{role:'adviser',note:'Observed the corrected evidence'})]);
  await command('adviser','approve',await specializedPayload(physicalRequirement,{role:'adviser'}));
  assert.equal((await command('coordinator','approve',await specializedPayload(physicalRequirement,{role:'coordinator'}))).status,'approved');
});
test('MOA routing is coordinator-only, SAS needs the same notarized copy, and a new copy inherits no confirmation',async()=>{
  const submit=async()=>{const doc=await command('student','reserve_upload',await specializedPayload(moaRequirement,{name:'moa.pdf',bytes:64,mimeType:'application/pdf'}));await attest(doc.documentId);
    return command('student','submit',await specializedPayload(moaRequirement,{documentId:doc.documentId}));};
  const first=await submit();
  const route=async(status,who='coordinator',version=first.submissionId)=>caller(who,'select public.intrack_route_moa($1,$2) as result',[randomUUID(),await specializedPayload(moaRequirement,{status,submissionId:version,reason:'Synthetic routing reason',evidenceNote:'Synthetic factual observation'})]);
  await assert.rejects(route('SIGNED AND NOTARIZED','adviser'),e=>e.code==='42501');
  await assert.rejects(command('coordinator','approve',await specializedPayload(moaRequirement,{role:'coordinator'})),e=>e.code==='42501');
  await assert.rejects(route('SAS COPY SUBMITTED'),e=>e.code==='40001');
  await route('SIGNED AND NOTARIZED');assert.equal((await route('SAS COPY SUBMITTED')).status,'SAS COPY SUBMITTED');
  const second=await submit();
  await assert.rejects(route('SAS COPY SUBMITTED','coordinator',second.submissionId),e=>e.code==='40001');
  const e=(await db.query('select lifecycle from intrack.enrollments where id=$1',[enrollment])).rows[0];assert.equal(e.lifecycle,'pre_ojt');
  const projection=await caller('student','select public.intrack_list_enrollments($1) as result',['student']);assert.equal(projection[0].moaVersionId,first.submissionId);assert.equal(projection[0].creditedMinutes,0);
});
test('clearance is a separate checked command; pending new MOA does not replace accepted basis and stages cannot skip',async()=>{
  const life=async action=>caller('coordinator','select public.intrack_lifecycle_command($1,$2) as result',[randomUUID(),await specializedPayload(requirement,{action,reason:'Synthetic lifecycle decision'})]);
  await assert.rejects(life('issue_clearance'),e=>e.code==='40001');
  const placement={...await specializedPayload(requirement),companyName:'Synthetic company',companyAddress:'Synthetic address',approvalReference:'Synthetic placement only',
    startsOn:'2026-01-01',endsOn:'2026-12-31',latitude:14.5,longitude:121,radiusMeters:200,
    schedule:{weekdays:[1,2,3,4,5],start:'08:00',end:'17:00',breaks:[{start:'12:00',end:'13:00'}]}};
  await assert.rejects(caller('adviser','select public.intrack_configure_placement($1,$2)',[randomUUID(),placement]),e=>e.code==='42501');
  await caller('coordinator','select public.intrack_configure_placement($1,$2)',[randomUUID(),placement]);
  // A missing file version is NULL in SQL; it must count as unresolved, not be
  // skipped by bool_and alongside an approved MOA/physical record.
  await db.query("update intrack.submission_versions set is_current=false where requirement_id=$1 and is_current",[requirement]);
  await assert.rejects(life('issue_clearance'),e=>e.code==='40001');
  await db.query('update intrack.submission_versions set is_current=true where requirement_id=$1 and version=2',[requirement]);
  const issued=await life('issue_clearance');assert.equal(issued.lifecycle,'during_ojt');assert.equal(issued.clearance,'active');
  await assert.rejects(life('enter_portfolio'),e=>e.code==='40001');
  await assert.rejects(life('enter_post_ojt'),e=>e.code==='40001');
  assert.equal((await life('suspend_clearance')).clearance,'suspended');
  assert.equal((await life('resume_clearance')).clearance,'active');
  const stalePlacement=await specializedPayload(requirement,{...placement});
  await assert.rejects(caller('coordinator','select public.intrack_configure_placement($1,$2)',[randomUUID(),stalePlacement]),e=>e.code==='40001');
  assert.equal((await life('withdraw')).outcome,'withdrawn');
  const projection=await caller('student','select public.intrack_list_enrollments($1) as result',['student']);assert.equal(projection[0].clearance,'revoked');
  await assert.rejects(life('issue_clearance'),e=>e.code==='40001');
});

test('authority revocation, reassignment, closed stage and suspended identity block writes and files',async()=>{
  const doc=(await db.query("select id from intrack.documents where status='attached' limit 1")).rows[0].id;
  await db.query("update intrack.adviser_assignments set ends_at=now()+interval '1 second' where enrollment_id=$1",[enrollment]);
  await assert.rejects(caller('adviser','select public.intrack_requirement_file($1,$2) as result',[doc,'adviser']),e=>e.code==='42501');
  await db.query("update intrack.profiles set status='suspended' where id=$1",[ids.student.profile]);
  await assert.rejects(caller('student','select public.intrack_requirement_file($1,$2) as result',[doc,'student']),e=>e.code==='42501');
});

test('cleanup is privileged, quarantines expired orphans and preserves attached history',async()=>{
  await assert.rejects(caller('student','select public.intrack_expired_requirement_files() as result'),e=>e.code==='42501');
  await db.exec("update intrack.requirement_uploads set expires_at=now()-interval '2 hours'");
  await db.exec('begin');
  let files;
  try {await db.exec('set local role service_role');files=(await db.query('select public.intrack_expired_requirement_files() as result')).rows[0].result;await db.exec('commit');}
  catch(e){await db.exec('rollback');throw e;}
  assert.ok(files.length>0);
  assert.equal((await db.query("select count(*)::integer n from intrack.documents where status='attached'")).rows[0].n,4);
  for(const file of files)assert.equal((await db.query('select status from intrack.documents where id=$1',[file.id])).rows[0].status,'quarantined');
  await db.exec('begin');
  try {
    await db.exec('set local role service_role');
    for(const file of files)await db.query('select public.intrack_complete_requirement_cleanup($1)',[file.id]);
    assert.deepEqual((await db.query('select public.intrack_expired_requirement_files() as result')).rows[0].result,[]);
    await db.exec('commit');
  }catch(e){await db.exec('rollback');throw e;}
});
test('asset recovery inventory is operator-only and preserves immutable object identities',async()=>{
  await assert.rejects(caller('student','select public.intrack_asset_recovery_inventory() as result'),e=>e.code==='42501');
  const assets=await caller('student','select public.intrack_asset_recovery_inventory() as result',[],'aal2','service_role');
  assert.equal(assets.length,4);assert.ok(assets.every(a=>a.bucket==='ojt-documents'&&a.bytes===64&&a.sha256==='a'.repeat(64)));
  assert.ok(assets.every(a=>!('email' in a)&&!('auth_user_id' in a)));
});

test('local synthetic fixture executes twice without duplicate policies, accounts or enrollments',async()=>{
  await db.exec("update intrack.identity_configuration set current_notice_version='dev-test-only'");
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,$4,now())',
    [randomUUID(),'student.workflow@example.test',randomUUID(),'adviser.workflow@example.test']);
  const sql=await readFile(new URL('../local-requirement-fixture.sql',import.meta.url),'utf8');
  await db.exec(sql);await db.exec(sql);
  assert.equal((await db.query('select count(*)::integer n from intrack.policy_versions where version=900001')).rows[0].n,1);
  assert.equal((await db.query("select count(*)::integer n from intrack.enrollments e join intrack.academic_terms t on t.id=e.term_id where t.academic_year='LOCAL-WORKFLOW-TEST'")).rows[0].n,1);
});
