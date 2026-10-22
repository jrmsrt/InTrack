import {before,after,test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
const db=new PGlite();
const people=Object.fromEntries(['coordinator','adviser','second','outsider','student','next','wrongSection','declined'].map(k=>[k,{id:randomUUID(),subject:randomUUID()}]));
let program,otherProgram,source,policy,term;
before(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
 create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
 for(const path of ['../supabase-model.sql','../../supabase/migrations/202610100002_protected_identity.sql','../../supabase/migrations/202610140006_administration_foundation.sql','../../supabase/migrations/202610140007_policy_enrollment_projection.sql','../../supabase/migrations/202610170044_class_enrollment_configuration.sql','../../supabase/migrations/202610170045_practicum_intake_policy.sql','../../supabase/migrations/202610170047_practicum_evidence_review_plan.sql','../../supabase/migrations/202610180049_academic_term_calendar_fields.sql'])await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
 program=(await db.query("select id from intrack.programs where code='BSIT'")).rows[0].id;otherProgram=(await db.query("select id from intrack.programs where code='BSHM'")).rows[0].id;
 source=(await db.query('select id from intrack.policy_versions where program_id=$1',[program])).rows[0].id;
 await db.exec("update intrack.identity_configuration set current_notice_version='synthetic-notice'");
 for(const [name,p] of Object.entries(people)){
  const student=['student','next','wrongSection','declined'].includes(name);
  await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[p.subject,`${name.toLowerCase()}@example.test`]);
  await db.query("insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,$3,'active',now())",[p.id,p.subject,name]);
  await db.query('insert into intrack.memberships(profile_id,program_id,role) values($1,$2,$3)',[p.id,name==='outsider'?otherProgram:program,student?'student':name==='coordinator'?'coordinator':'adviser']);
  await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'synthetic-notice')",[p.id]);
  if(student){const batch=(await db.query("insert into intrack.import_batches(imported_by,content_hash,row_count,imported_count,unchanged_count) values($1,'synthetic',1,1,0) returning id",[people.coordinator.id])).rows[0].id;await db.query('insert into intrack.eligible_students(student_number,email,display_name,program_id,section,imported_by,invited_profile_id,import_batch_id) values($1,$2,$1,$3,$4,$5,$6,$7)',[name,`${name.toLowerCase()}@example.test`,program,['wrongSection','declined'].includes(name)?'4-2':'4-1',people.coordinator.id,p.id,batch]);}
 }
});
after(async()=>db.close());
async function call(who,name,args={},aal='aal2',role='authenticated'){
 await db.exec('begin');try{
  await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:people[who]?.subject,aal,user_metadata:{role:'coordinator'}})]);await db.exec(`set local role ${role}`);
  const keys=Object.keys(args);const result=(await db.query(`select public.${name}(${keys.map((k,i)=>`${k}=>$${i+1}`).join(',')}) as result`,Object.values(args))).rows[0]?.result;
  await db.exec('commit');return result;
 }catch(e){await db.exec('rollback');throw e;}
}
const termPayload={academicYear:'2026-2027',semester:'2',startsOn:'2027-01-01',endsOn:'2027-05-31'};
const policyPayload=()=>({sourcePolicyId:source,mode:'intake',approvalReference:'Synthetic test, document intake only',requirements:[{code:'COR',title:'Registration Card/Form',stage:'pre',evidenceType:'file',reviewer:'adviser',mandatory:true,allowedStages:['pre_ojt'],recurrence:{kind:'once'}}]});
const enrollmentPayload=(extra={})=>({policyId:policy,termId:term,section:'4-1',studentIds:[people.student.id],reason:'Synthetic class enrollment',...extra});
test('staff create idempotent terms, while students, missing MFA and conflicting dates are denied',async()=>{
 const command_id=randomUUID(),args={command_id,actor_role:'adviser',payload:termPayload};
 const created=await call('adviser','intrack_create_academic_term',args);term=created.termId;
 assert.deepEqual(await call('adviser','intrack_create_academic_term',args),created);
 await assert.rejects(call('student','intrack_create_academic_term',{...args,command_id:randomUUID()}),e=>e.code==='42501');
 await assert.rejects(call('adviser','intrack_create_academic_term',args,'aal1'),e=>e.code==='42501');
 await assert.rejects(call('adviser','intrack_create_academic_term',{...args,command_id:randomUUID(),payload:{...termPayload,endsOn:'2027-06-01'}}),e=>e.code==='40001');
 await assert.rejects(call('coordinator','intrack_create_academic_term',{...args,actor_role:'coordinator',command_id:randomUUID(),payload:{...termPayload,academicYear:'2026-2028'}}),e=>e.code==='22023');
});
test('coordinator publishes explicit intake requirements without asserting attendance approval; advisers cannot publish',async()=>{
 await assert.rejects(call('adviser','intrack_publish_practicum_policy',{command_id:randomUUID(),payload:policyPayload()}),e=>e.code==='42501');
 await assert.rejects(call('coordinator','intrack_publish_practicum_policy',{command_id:randomUUID(),payload:{...policyPayload(),requirements:[{...policyPayload().requirements[0],reviewer:''}]}}),e=>e.code==='22023');
 const result=await call('coordinator','intrack_publish_practicum_policy',{command_id:randomUUID(),payload:policyPayload()});policy=result.policyId;
 const stored=(await db.query('select attendance_policy,confirmed_at from intrack.policy_versions where id=$1',[policy])).rows[0];
 assert.equal(stored.attendance_policy.confirmed,false);assert.ok(stored.confirmed_at);
 await assert.rejects(call('coordinator','intrack_publish_practicum_policy',{command_id:randomUUID(),payload:{...policyPayload(),mode:'full'}}),e=>e.code==='22023');
});
test('enrollment directory is scoped and requires a class filter before showing students',async()=>{
 const args={actor_role:'adviser',filters:{programId:program,termId:term,section:'4-1'}};
 const data=await call('adviser','intrack_enrollment_configuration',args);assert.equal(data.students.length,0);assert.equal(data.policies.find(p=>p.id===policy).requirements[0].reviewer,'adviser');
 assert.deepEqual((await call('adviser','intrack_enrollment_configuration',{actor_role:'adviser'})).students,[]);
 await assert.rejects(call('outsider','intrack_enrollment_configuration',args),e=>e.code==='42501');
 await assert.rejects(call('student','intrack_enrollment_configuration',args),e=>e.code==='42501');
});
test('enrolling adviser automatically owns the class and student assignment; repeated enrollment creates no duplicates',async()=>{
 const args={command_id:randomUUID(),actor_role:'adviser',payload:enrollmentPayload()};const result=await call('adviser','intrack_enroll_practicum_class',args);
 assert.equal(result.created,1);assert.equal(result.assigned,1);assert.equal(result.adviserId,people.adviser.id);
 assert.deepEqual(await call('adviser','intrack_enroll_practicum_class',args),result);
 const repeated=await call('adviser','intrack_enroll_practicum_class',{...args,command_id:randomUUID()});assert.equal(repeated.created,0);assert.equal(repeated.assigned,0);
 assert.equal((await db.query('select count(*)::integer n from intrack.enrollment_requirements')).rows[0].n,1);
 const mine=await call('adviser','intrack_list_enrollments',{actor_role:'adviser'});assert.equal(mine.length,1);assert.equal(mine[0].studentId,people.student.id);
 assert.deepEqual(await call('second','intrack_list_enrollments',{actor_role:'adviser'}),[]);
});
test('another adviser cannot take a class or see its student candidates; term-scoped ownership does not trust supplied adviserId',async()=>{
 await assert.rejects(call('second','intrack_enroll_practicum_class',{command_id:randomUUID(),actor_role:'adviser',payload:enrollmentPayload({studentIds:[people.next.id],adviserId:people.second.id})}),e=>e.code==='42501');
 const data=await call('second','intrack_enrollment_configuration',{actor_role:'adviser',filters:{programId:program,termId:term,section:'4-1'}});assert.deepEqual(data.students,[]);
 const result=await call('adviser','intrack_enroll_practicum_class',{command_id:randomUUID(),actor_role:'adviser',payload:enrollmentPayload({studentIds:[people.next.id],adviserId:people.second.id})});assert.equal(result.adviserId,people.adviser.id);
});
test('wrong masterlist section, academic year level, program and student role fail atomically',async()=>{
 const before=(await db.query('select count(*)::integer n from intrack.enrollments')).rows[0].n;
 for(const [who,role,payload] of [['adviser','adviser',enrollmentPayload({studentIds:[people.student.id,people.wrongSection.id]})],['adviser','adviser',enrollmentPayload({section:'3-1'})],['outsider','adviser',enrollmentPayload()],['student','adviser',enrollmentPayload()]])await assert.rejects(call(who,'intrack_enroll_practicum_class',{command_id:randomUUID(),actor_role:role,payload}));
 assert.equal((await db.query('select count(*)::integer n from intrack.enrollments')).rows[0].n,before);
});
let codedClass,joinRequest,code;
test('class-code workflow creates an adviser-owned class with no enrollment; code is visible only to its owner',async()=>{
 await db.exec(await readFile(new URL('../../supabase/migrations/202610170046_class_codes_and_approval.sql',import.meta.url),'utf8'));
 const args={command_id:randomUUID(),actor_role:'adviser',payload:{policyId:policy,termId:term,section:'4-2',reason:'Synthetic class-code test'}};
 const created=await call('second','intrack_create_practicum_class',args);codedClass=created.classId;
 assert.deepEqual(await call('second','intrack_create_practicum_class',args),created);
 const admin=await call('second','intrack_class_join_administration',{actor_role:'adviser'});code=admin.classes.find(c=>c.id===codedClass).code;assert.match(code,/^[A-F0-9]{10}$/);
 const coordinator=await call('coordinator','intrack_class_join_administration',{actor_role:'coordinator'});assert.equal(coordinator.classes.find(c=>c.id===codedClass).code,null);
 await assert.rejects(call('adviser','intrack_create_practicum_class',{...args,command_id:randomUUID()}),e=>e.code==='42501');
 await assert.rejects(call('coordinator','intrack_create_practicum_class',{...args,command_id:randomUUID(),actor_role:'coordinator'}),e=>e.code==='42501');
 await assert.rejects(call('second','intrack_enroll_practicum_class',{command_id:randomUUID(),actor_role:'adviser',payload:enrollmentPayload({section:'4-2',studentIds:[people.wrongSection.id]})}),e=>e.code==='42501');
 assert.deepEqual(await call('wrongSection','intrack_list_enrollments',{actor_role:'student'}),[]);
});
test('a code creates only a pending request; program/section eligibility is checked without revealing class details',async()=>{
 const ineligible=await call('student','intrack_request_class_join',{command_id:randomUUID(),payload:{code}});assert.equal(ineligible.accepted,false);assert.equal(ineligible.requestId,undefined);
 const args={command_id:randomUUID(),payload:{code:code.toLowerCase()}};const requested=await call('wrongSection','intrack_request_class_join',args);assert.equal(requested.accepted,true);joinRequest=requested.requestId;
 assert.deepEqual(await call('wrongSection','intrack_request_class_join',args),requested);
 const own=await call('wrongSection','intrack_my_class_join_requests');assert.equal(own.length,1);assert.equal(own[0].status,'pending');
 assert.deepEqual(await call('student','intrack_my_class_join_requests'),[]);
 assert.deepEqual(await call('wrongSection','intrack_list_enrollments',{actor_role:'student'}),[]);
});
test('only the class adviser can approve and atomically enroll the student, assign themselves and notify',async()=>{
 const args={command_id:randomUUID(),actor_role:'adviser',payload:{requestId:joinRequest,expectedRevision:0,decision:'approve',reason:'Verified synthetic class membership'}};
 await assert.rejects(call('adviser','intrack_review_class_join',args),e=>e.code==='42501');
 await assert.rejects(call('coordinator','intrack_review_class_join',{...args,actor_role:'coordinator'}),e=>e.code==='42501');
 const approved=await call('second','intrack_review_class_join',args);assert.equal(approved.status,'approved');assert.equal(approved.enrollment.assigned,1);
 assert.deepEqual(await call('second','intrack_review_class_join',args),approved);
 const enrollment=(await call('wrongSection','intrack_list_enrollments',{actor_role:'student'}))[0];assert.equal(enrollment.adviserId,people.second.id);
 assert.equal((await call('wrongSection','intrack_my_class_join_requests'))[0].status,'approved');
 await assert.rejects(call('second','intrack_review_class_join',{...args,command_id:randomUUID()}),e=>e.code==='40001');
});
test('rejection preserves a locked account and the adviser can reconsider with a new audited reason',async()=>{
 const requested=await call('declined','intrack_request_class_join',{command_id:randomUUID(),payload:{code}});assert.equal(requested.accepted,true);
 await call('second','intrack_review_class_join',{command_id:randomUUID(),actor_role:'adviser',payload:{requestId:requested.requestId,expectedRevision:0,decision:'reject',reason:'Incorrect enrollment request'}});
 assert.deepEqual(await call('declined','intrack_list_enrollments',{actor_role:'student'}),[]);
 assert.equal((await call('declined','intrack_my_class_join_requests'))[0].status,'rejected');
 await call('second','intrack_review_class_join',{command_id:randomUUID(),actor_role:'adviser',payload:{requestId:requested.requestId,expectedRevision:1,decision:'approve',reason:'Rechecked and confirmed class membership'}});
 assert.equal((await call('declined','intrack_list_enrollments',{actor_role:'student'})).length,1);
 assert.equal((await db.query('select count(*)::integer n from intrack.class_join_events where request_id=$1',[requested.requestId])).rows[0].n,3);
});

test('code management is owner-only, disabling persists and resets invalidate old codes; failed attempts are rate limited',async()=>{
 const action=(extra={})=>({command_id:randomUUID(),actor_role:'adviser',payload:{classId:codedClass,expectedRevision:0,action:'disable',...extra}});
 await assert.rejects(call('adviser','intrack_manage_class_code',action()),e=>e.code==='42501');
 await call('second','intrack_manage_class_code',action());
 assert.equal((await call('second','intrack_class_join_administration',{actor_role:'adviser'})).classes.find(c=>c.id===codedClass).codeEnabled,false);
 await call('second','intrack_manage_class_code',action({expectedRevision:1,action:'reset'}));
 assert.notEqual((await call('second','intrack_class_join_administration',{actor_role:'adviser'})).classes.find(c=>c.id===codedClass).code,code);
 for(let i=0;i<5;i++)assert.equal((await call('next','intrack_request_class_join',{command_id:randomUUID(),payload:{code:'INVALID000'}})).accepted,false);
 assert.match((await call('next','intrack_request_class_join',{command_id:randomUUID(),payload:{code:'INVALID000'}})).message,/Too many/);
 assert.equal((await db.query('select count(*)::integer n from intrack.class_join_attempts where profile_id=$1',[people.next.id])).rows[0].n,5);
});
