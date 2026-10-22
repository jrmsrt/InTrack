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
 for(const path of ['../supabase-model.sql','../../supabase/migrations/202610100002_protected_identity.sql','../../supabase/migrations/202610140006_administration_foundation.sql','../../supabase/migrations/202610140007_policy_enrollment_projection.sql','../../supabase/migrations/202610170044_class_enrollment_configuration.sql','../../supabase/migrations/202610170045_practicum_intake_policy.sql','../../supabase/migrations/202610170047_practicum_evidence_review_plan.sql','../../supabase/migrations/202610180049_academic_term_calendar_fields.sql','../../supabase/migrations/202610170046_class_codes_and_approval.sql','../../supabase/migrations/202610180050_simple_class_enrollment.sql','../../supabase/migrations/202610180051_requirement_descriptions.sql'])await db.exec(await readFile(new URL(path,import.meta.url),'utf8'));
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
const classInput=()=>({programId:program,academicYear:'2098-2099',semester:'2',section:'4-1',startsOn:'2099-01-20',endsOn:'2099-03-30'});
const checklist=()=>call('coordinator','intrack_program_checklist',{actor_role:'coordinator',program_id:program});
let created,joinRequest;
test('standard program checklist is preloaded, scoped and readable by the adviser without publication',async()=>{
 const config=await checklist();assert.equal(config.requirements.length,46);assert.equal(config.attendancePolicy.confirmed,false);
 assert.ok(config.requirements.every(r=>r.reviewer));assert.equal(config.requirements.find(r=>r.evidenceType==='moa').reviewer,'coordinator');
 assert.equal((await call('adviser','intrack_program_checklist',{actor_role:'adviser',program_id:program})).requirements.length,46);
 await assert.rejects(call('student','intrack_program_checklist',{actor_role:'student',program_id:program}),e=>e.code==='42501');
 await assert.rejects(call('outsider','intrack_program_checklist',{actor_role:'adviser',program_id:program}),e=>e.code==='42501');
});
test('create class automatically registers the term and freezes the 500-hour checklist; retries do not duplicate',async()=>{
 const args={command_id:randomUUID(),actor_role:'adviser',payload:classInput()};
 created=await call('adviser','intrack_create_ojt_class',args);assert.deepEqual(await call('adviser','intrack_create_ojt_class',args),created);
 const c=(await db.query('select * from intrack.practicum_classes where id=$1',[created.classId])).rows[0];assert.equal(c.adviser_id,people.adviser.id);assert.equal(c.join_code.length,10);
 policy=c.policy_id;term=c.term_id;
 const snapshot=(await db.query('select * from intrack.policy_versions where id=$1',[policy])).rows[0];assert.equal(snapshot.required_minutes,30000);assert.equal(snapshot.attendance_policy.confirmed,false);
 assert.equal((await db.query('select count(*)::integer as n from intrack.requirement_definitions where policy_version_id=$1',[policy])).rows[0].n,46);
 const again=await call('adviser','intrack_create_ojt_class',{...args,command_id:randomUUID()});assert.equal(again.classId,c.id);
 assert.equal((await db.query('select count(*)::integer as n from intrack.policy_versions where program_id=$1',[program])).rows[0].n,2);
});
test('invalid year/term, scope, missing MFA and another class owner are denied atomically',async()=>{
 for(const [who,role,aal] of [['coordinator','coordinator','aal2'],['student','student','aal2'],['outsider','adviser','aal2'],['adviser','adviser','aal1'],['second','adviser','aal2']])await assert.rejects(call(who,'intrack_create_ojt_class',{command_id:randomUUID(),actor_role:role,payload:classInput()},aal),e=>e.code==='42501');
 await assert.rejects(call('adviser','intrack_create_ojt_class',{command_id:randomUUID(),actor_role:'adviser',payload:{...classInput(),semester:'1'}}),e=>e.code==='22023');
 await assert.rejects(call('adviser','intrack_create_ojt_class',{command_id:randomUUID(),actor_role:'adviser',payload:{...classInput(),endsOn:'2099-04-01'}}),e=>e.code==='40001');
});
test('pending students do not appear in class list; approval enrolls all requirements and assigns the owner',async()=>{
 const c=(await db.query('select * from intrack.practicum_classes where id=$1',[created.classId])).rows[0];
 const requested=await call('student','intrack_request_class_join',{command_id:randomUUID(),payload:{code:c.join_code}});assert.equal(requested.accepted,true);joinRequest=requested.requestId;
 assert.deepEqual(await call('adviser','intrack_class_roster',{actor_role:'adviser',class_id:c.id}),[]);
 await call('adviser','intrack_review_class_join',{command_id:randomUUID(),actor_role:'adviser',payload:{requestId:joinRequest,expectedRevision:0,decision:'approve',reason:'Approved class join request'}});
 const roster=await call('adviser','intrack_class_roster',{actor_role:'adviser',class_id:c.id});assert.equal(roster.length,1);assert.equal(roster[0].studentId,people.student.id);assert.equal(roster[0].lifecycle,'pre_ojt');
 assert.equal((await db.query('select count(*)::integer as n from intrack.enrollment_requirements where enrollment_id=$1',[roster[0].id])).rows[0].n,46);
 assert.equal((await call('coordinator','intrack_class_roster',{actor_role:'coordinator',class_id:c.id})).length,1);
 await assert.rejects(call('second','intrack_class_roster',{actor_role:'adviser',class_id:c.id}),e=>e.code==='42501');
 await assert.rejects(call('student','intrack_class_roster',{actor_role:'student',class_id:c.id}),e=>e.code==='42501');
});
test('saving program requirements changes future class snapshots only, with revision and permission checks',async()=>{
 const config=await checklist(),rows=[...config.requirements.map((r,i)=>i===0?{...r,title:'Updated registration checklist'}:r),{code:'CUSTOM-ACCEPTANCE',title:'Internship acceptance letter',description:'Upload the signed acceptance letter from your HTE.',stage:'pre',evidenceType:'file',reviewer:'adviser',mandatory:true,allowedStages:['pre_ojt'],recurrence:{kind:'once',dueAt:'2099-02-01T15:59:59Z'}}];
 const args={command_id:randomUUID(),actor_role:'coordinator',payload:{programId:program,expectedRevision:config.revision,action:'requirements',requirements:rows}};
 await assert.rejects(call('coordinator','intrack_save_program_checklist',{...args,command_id:randomUUID(),payload:{...args.payload,requirements:rows.map(r=>r.code==='CUSTOM-ACCEPTANCE'?{...r,description:''}:r)}}),e=>e.code==='22023');
 await assert.rejects(call('coordinator','intrack_save_program_checklist',{...args,command_id:randomUUID(),payload:{...args.payload,requirements:rows.map(r=>r.code==='CUSTOM-ACCEPTANCE'?{...r,description:'x'.repeat(2001)}:r)}}),e=>e.code==='22023');
 await call('coordinator','intrack_save_program_checklist',args);await call('coordinator','intrack_save_program_checklist',args);
 assert.notEqual((await db.query('select title from intrack.requirement_definitions where policy_version_id=$1 and code=$2',[policy,rows[0].code])).rows[0].title,rows[0].title);
 await assert.rejects(call('coordinator','intrack_save_program_checklist',{...args,command_id:randomUUID()}),e=>e.code==='40001');
 const updated=await checklist();
 assert.equal(updated.requirements.length,47);assert.equal(updated.requirements.at(-1).title,'Internship acceptance letter');
 assert.equal((await db.query('select count(*)::integer as n from intrack.requirement_definitions where policy_version_id=$1',[policy])).rows[0].n,46);
 await assert.rejects(call('adviser','intrack_save_program_checklist',{...args,command_id:randomUUID(),actor_role:'adviser'}),e=>e.code==='42501');
 await assert.rejects(call('coordinator','intrack_save_program_checklist',{...args,command_id:randomUUID(),payload:{...args.payload,expectedRevision:updated.revision,requirements:rows.slice(1)}}),e=>e.code==='22023');
 const next=await call('adviser','intrack_create_ojt_class',{command_id:randomUUID(),actor_role:'adviser',payload:{...classInput(),section:'4-2'}});
 assert.equal((await db.query('select d.title from intrack.requirement_definitions d join intrack.practicum_classes c on c.policy_id=d.policy_version_id where c.id=$1 and d.code=$2',[next.classId,rows[0].code])).rows[0].title,rows[0].title);
 const added=(await db.query('select d.title,d.recurrence,d.description from intrack.requirement_definitions d join intrack.practicum_classes c on c.policy_id=d.policy_version_id where c.id=$1 and d.code=$2',[next.classId,'CUSTOM-ACCEPTANCE'])).rows[0];
 assert.equal(added.title,'Internship acceptance letter');assert.equal(added.recurrence.dueAt,'2099-02-01T15:59:59Z');
 assert.equal(added.description,'Upload the signed acceptance letter from your HTE.');
});
test('attendance is separate, rejects invented or missing values and never alters an existing class',async()=>{
 const config=await checklist(),args={command_id:randomUUID(),actor_role:'coordinator',payload:{programId:program,expectedRevision:config.revision,action:'attendance',attendancePolicy:{confirmed:true}}};
 await assert.rejects(call('coordinator','intrack_save_program_checklist',args),e=>e.code==='22023');
 await call('coordinator','intrack_save_program_checklist',{...args,payload:{...args.payload,attendancePolicy:{confirmed:true,dailyCapMinutes:480,maxSessionMinutes:720,maxAccuracyMeters:50,maxCoordinateAgeSeconds:60}}});
 assert.equal((await checklist()).attendancePolicy.confirmed,true);
 assert.equal((await db.query('select attendance_policy from intrack.policy_versions where id=$1',[policy])).rows[0].attendance_policy.confirmed,false);
});
