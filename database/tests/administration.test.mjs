import { before,after,test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const people=Object.fromEntries(['coordinator','student','adviser','outsider'].map(k=>[k,{id:randomUUID(),subject:randomUUID()}]));
let program,otherProgram,membership;
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
  for(const file of ['../supabase-model.sql','../../supabase/migrations/202610100002_protected_identity.sql','../../supabase/migrations/202610140006_administration_foundation.sql','../../supabase/migrations/202610140007_policy_enrollment_projection.sql','../../supabase/migrations/202610140008_communications.sql','../../supabase/migrations/202610140014_scoped_account_invitations.sql','../../supabase/migrations/202610140015_invitation_resume_projection.sql'])await db.exec(await readFile(new URL(file,import.meta.url),'utf8'));
  program=(await db.query("select id from intrack.programs where code='BSIT'")).rows[0].id;
  otherProgram=(await db.query("select id from intrack.programs where code='BSHM'")).rows[0].id;
  await db.exec("update intrack.identity_configuration set current_notice_version='synthetic-notice'");
  for(const [name,p] of Object.entries(people)){
    await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[p.subject,`${name}@example.test`]);
    await db.query("insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,$3,'active',now())",[p.id,p.subject,name]);
    await db.query('insert into intrack.memberships(profile_id,program_id,role) values($1,$2,$3)',[p.id,name==='outsider'?otherProgram:program,name==='outsider'?'coordinator':name]);
    await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'synthetic-notice')",[p.id]);
  }
  membership=(await db.query('select id from intrack.memberships where profile_id=$1',[people.student.id])).rows[0].id;
});
after(async()=>db.close());
async function call(who,sql,args=[],aal='aal2',role='authenticated'){
  await db.exec('begin');
  try{await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:people[who]?.subject,aal,user_metadata:{role:'coordinator'}})]);await db.exec(`set local role ${role}`);
    const result=(await db.query(sql,args)).rows[0]?.result;await db.exec('commit');return result;
  }catch(e){await db.exec('rollback');throw e;}
}
const row={studentNumber:' test-001 ',email:'NEW@example.test',name:' Full Complete Name ',section:' 4-1 ',programCode:'BSIT'};
const preview=(rows=[row],who='coordinator',aal='aal2')=>call(who,'select public.intrack_preview_masterlist($1) as result',[rows],aal);
test('forward BSOA confirmation preserves hours and leaves policies unpublished',async()=>{
  const rows=(await db.query("select v.year_level,v.semester,v.required_minutes,v.confirmed_at from intrack.policy_versions v join intrack.programs p on p.id=v.program_id where p.code='BSOA' order by component")).rows;
  assert.deepEqual(rows.map(r=>[r.year_level,r.semester,r.required_minutes,r.confirmed_at]),[[2,'2',18000,null],[4,'2',18000,null]]);
});
test('imports fail closed before configured domains and deny forged role, anonymous and missing MFA',async()=>{
  assert.equal((await preview()).issues[0].message,'Institution-approved student email domain required');
  await assert.rejects(preview(undefined,'student'),e=>e.code==='42501');
  await assert.rejects(preview(undefined,'coordinator','aal1'),e=>e.code==='42501');
  await assert.rejects(call('coordinator','select public.intrack_preview_masterlist($1)',[[row]],'aal2','anon'),e=>e.code==='42501');
  await assert.rejects(call('coordinator',"select public.intrack_configure_email_domains('BSIT',array['example.test'],array['example.test'],'test')"),e=>e.code==='42501');
  await call('coordinator',"select public.intrack_configure_email_domains('BSIT',array['example.test'],array['example.test'],'Synthetic test fixture')",[],'aal2','service_role');
});
test('dry run reports duplicates, lookalike domains and cross-program rows without writing students',async()=>{
  assert.ok((await preview([row,row])).issues.length);
  assert.ok((await preview([{...row,email:'new@sub.example.test'}])).issues.length);
  assert.ok((await preview([{...row,programCode:'BSHM'}])).issues.length);
  assert.ok((await preview([row],'outsider')).issues.length);
  assert.equal((await db.query('select count(*)::integer n from intrack.eligible_students')).rows[0].n,0);
});
let token,commandId=randomUUID();
test('commit is actor-bound, atomic and replay-safe; exact repeats are unchanged',async()=>{
  const result=await preview();token=result.validationToken;assert.ok(token);assert.equal(result.newCount,1);
  await assert.rejects(call('outsider','select public.intrack_commit_masterlist($1,$2) as result',[randomUUID(),token]),e=>e.code==='40001');
  const committed=await call('coordinator','select public.intrack_commit_masterlist($1,$2) as result',[commandId,token]);
  assert.equal(committed.imported,1);
  assert.deepEqual(await call('coordinator','select public.intrack_commit_masterlist($1,$2) as result',[commandId,token]),committed);
  const stored=(await db.query('select * from intrack.eligible_students')).rows[0];assert.equal(stored.student_number,'TEST-001');assert.equal(stored.display_name,'Full Complete Name');
  assert.equal((await db.query('select normalized_rows from intrack.import_previews where id=$1',[token])).rows[0].normalized_rows.length,0);
  const repeated=await preview();assert.equal(repeated.existingCount,1);
  assert.equal((await call('coordinator','select public.intrack_commit_masterlist($1,$2) as result',[randomUUID(),repeated.validationToken])).unchanged,1);
  assert.ok((await preview([{...row,name:'Silently changed name'}])).issues.length);
});
test('commit revalidates expired previews and identity conflicts; changed command payload fails',async()=>{
  const fresh=await preview([{...row,studentNumber:'T002',email:'second@example.test'}]);
  await db.query("update intrack.import_previews set created_at=now()-interval '20 minutes',expires_at=now()-interval '1 second' where id=$1",[fresh.validationToken]);
  await assert.rejects(call('coordinator','select public.intrack_commit_masterlist($1,$2) as result',[randomUUID(),fresh.validationToken]),e=>e.code==='40001');
  await assert.rejects(call('coordinator','select public.intrack_commit_masterlist($1,$2) as result',[commandId,fresh.validationToken]),e=>e.code==='40001');
});
test('scoped invitations are masterlist-bound, cannot create coordinators/self roles, and retry preserves the reservation',async()=>{
  const eligible=(await db.query('select id from intrack.eligible_students')).rows[0].id;
  const payload={role:'student',eligibleStudentId:eligible},id=randomUUID();
  await assert.rejects(call('outsider','select public.intrack_reserve_account_invitation($1,$2)',[id,payload]),e=>e.code==='42501');
  await assert.rejects(call('coordinator','select public.intrack_reserve_account_invitation($1,$2)',[randomUUID(),{role:'coordinator',programId:program,email:'newcoord@example.test',name:'forged'}]),e=>e.code==='42501');
  await assert.rejects(call('coordinator','select public.intrack_reserve_account_invitation($1,$2)',[randomUUID(),{role:'adviser',programId:program,email:'coordinator@example.test',name:'self'}]),e=>e.code==='40001');
  const reserved=await call('coordinator','select public.intrack_reserve_account_invitation($1,$2) as result',[id,payload]);
  assert.deepEqual(await call('coordinator','select public.intrack_reserve_account_invitation($1,$2) as result',[id,payload]),reserved);
  const saved=await call('coordinator','select public.intrack_list_account_invitations() as result');assert.equal(saved[0].commandId,id);assert.deepEqual(saved[0].payload,payload);
  assert.deepEqual(await call('outsider','select public.intrack_list_account_invitations() as result'),[]);
  await assert.rejects(call('coordinator','select public.intrack_reserve_account_invitation($1,$2)',[randomUUID(),payload]),e=>e.code==='40001');
  const context=await call('coordinator','select public.intrack_account_invitation_context($1) as result',[reserved.invitationId]);assert.equal(context.email,'new@example.test');assert.equal(context.reconciliationRequired,false);
  const subject=randomUUID();await db.query('insert into auth.users(id,email) values($1,$2)',[subject,context.email]);
  assert.equal((await call('coordinator','select public.intrack_account_invitation_context($1) as result',[reserved.invitationId])).reconciliationRequired,true);
  await assert.rejects(call('coordinator','select public.intrack_link_account_invitation($1,$2)',[reserved.invitationId,people.adviser.subject]),e=>e.code==='42501');
  const linked=await call('coordinator','select public.intrack_link_account_invitation($1,$2) as result',[reserved.invitationId,subject]);assert.equal(linked.linked,true);
  assert.deepEqual(await call('coordinator','select public.intrack_link_account_invitation($1,$2) as result',[reserved.invitationId,subject]),linked);
  assert.equal((await db.query('select status from intrack.profiles where id=$1',[reserved.profileId])).rows[0].status,'invited');
  assert.equal((await db.query('select state from intrack.account_invitations where id=$1',[reserved.invitationId])).rows[0].state,'sent');
});
test('membership administration cannot promote self/coordinators or cross programs; revisions protect changes',async()=>{
  const args=[randomUUID(),membership,0,false,'Synthetic revocation'];
  await assert.rejects(call('outsider','select public.intrack_set_membership($1,$2,$3,$4,$5) as result',args),e=>e.code==='42501');
  const own=(await db.query('select id from intrack.memberships where profile_id=$1',[people.coordinator.id])).rows[0].id;
  await assert.rejects(call('coordinator','select public.intrack_set_membership($1,$2,0,false,\'self\')',[randomUUID(),own]),e=>e.code==='42501');
  assert.equal((await call('coordinator','select public.intrack_set_membership($1,$2,$3,$4,$5) as result',args)).active,false);
  await assert.rejects(call('coordinator','select public.intrack_set_membership($1,$2,0,true,\'stale\')',[randomUUID(),membership]),e=>e.code==='40001');
  await call('coordinator','select public.intrack_set_membership($1,$2,1,true,\'restore\')',[randomUUID(),membership]);
});
let enrollment,policyPayload,published;
test('policy publication needs scoped MFA, confirmed settings and creates immutable definitions',async()=>{
  const source=(await db.query('select id from intrack.policy_versions where program_id=$1',[program])).rows[0].id;
  policyPayload={sourcePolicyId:source,approvalReference:'Synthetic approval for tests only',attendancePolicy:{confirmed:true,dailyCapMinutes:480,maxSessionMinutes:1440,maxAccuracyMeters:100,maxCoordinateAgeSeconds:60},
    requirements:[{code:'PRE',title:'Synthetic file',stage:'pre',evidenceType:'file',reviewer:'both',allowedStages:['pre_ojt']},
      {code:'PERIOD',title:'Synthetic recurring file',stage:'during',evidenceType:'file',reviewer:'adviser',allowedStages:['during_ojt'],recurrence:{kind:'occurrences',items:[{key:'period-1',dueAt:'2026-11-01T09:00:00Z'},{key:'period-2',dueAt:'2026-11-08T09:00:00Z'}]}}]};
  await assert.rejects(call('student','select public.intrack_publish_policy($1,$2) as result',[randomUUID(),policyPayload]),e=>e.code==='42501');
  await assert.rejects(call('coordinator','select public.intrack_publish_policy($1,$2) as result',[randomUUID(),{...policyPayload,attendancePolicy:{}}]),e=>e.code==='22023');
  const id=randomUUID();published=await call('coordinator','select public.intrack_publish_policy($1,$2) as result',[id,policyPayload]);
  assert.deepEqual(await call('coordinator','select public.intrack_publish_policy($1,$2) as result',[id,policyPayload]),published);
  await assert.rejects(db.query('update intrack.requirement_definitions set title=\'silent edit\' where policy_version_id=$1',[published.policyId]),e=>e.code==='23514');
});
test('enrollment freezes targets, generates occurrences exactly once, and a policy change cannot duplicate the attempt',async()=>{
  const term=(await db.query("insert into intrack.academic_terms(academic_year,semester,starts_on,ends_on) values('SYNTHETIC','2','2026-01-01','2026-12-31') returning id")).rows[0].id;
  const payload={studentId:people.student.id,policyId:published.policyId,termId:term},id=randomUUID();
  const result=await call('coordinator','select public.intrack_enroll_student($1,$2) as result',[id,payload]);enrollment=result.enrollmentId;
  assert.deepEqual(await call('coordinator','select public.intrack_enroll_student($1,$2) as result',[id,payload]),result);
  assert.equal((await db.query('select count(*)::integer n from intrack.enrollment_requirements where enrollment_id=$1',[enrollment])).rows[0].n,3);
  const next=await call('coordinator','select public.intrack_publish_policy($1,$2) as result',[randomUUID(),policyPayload]);
  await assert.rejects(call('coordinator','select public.intrack_enroll_student($1,$2) as result',[randomUUID(),{...payload,policyId:next.policyId}]),e=>e.code==='40001');
  const own=await call('student','select public.intrack_list_enrollments($1) as result',['student']);
  assert.equal(own[0].requiredMinutes,30000);assert.equal(own[0].creditedMinutes,0);assert.equal(own[0].lifecycle,'pre_ojt');assert.equal(own[0].clearance,'not_issued');
  assert.deepEqual(await call('outsider','select public.intrack_list_enrollments($1) as result',['coordinator']),[]);
});
test('assignment immediately controls adviser reads; repeat receipts and stale revisions are enforced',async()=>{
  assert.deepEqual(await call('adviser','select public.intrack_list_enrollments($1) as result',['adviser']),[]);
  const args=[randomUUID(),enrollment,0,people.adviser.id,'Synthetic assignment'];
  await assert.rejects(call('outsider','select public.intrack_assign_adviser($1,$2,$3,$4,$5) as result',args),e=>e.code==='42501');
  const result=await call('coordinator','select public.intrack_assign_adviser($1,$2,$3,$4,$5) as result',args);
  assert.deepEqual(await call('coordinator','select public.intrack_assign_adviser($1,$2,$3,$4,$5) as result',args),result);
  assert.equal((await call('adviser','select public.intrack_list_enrollments($1) as result',['adviser']))[0].adviserId,people.adviser.id);
  await assert.rejects(call('coordinator','select public.intrack_assign_adviser($1,$2,0,$3,\'stale\')',[randomUUID(),enrollment,people.adviser.id]),e=>e.code==='40001');
  await assert.rejects(call('adviser','select public.intrack_administration_directory()'),e=>e.code==='42501');
  const directory=await call('coordinator','select public.intrack_administration_directory() as result');assert.equal(directory.programs.length,1);
});
test('messages are participant-only and require current relationships; notifications have real unread state',async()=>{
  const args=[randomUUID(),enrollment,'student',people.adviser.id,'Synthetic message'];
  const sent=await call('student','select public.intrack_send_message($1,$2,$3,$4,$5) as result',args);
  assert.deepEqual(await call('student','select public.intrack_send_message($1,$2,$3,$4,$5) as result',args),sent);
  assert.equal((await call('adviser','select public.intrack_list_messages($1,$2) as result',[enrollment,'adviser'])).items.length,1);
  assert.equal((await call('coordinator','select public.intrack_list_messages($1,$2) as result',[enrollment,'coordinator'])).items.length,0);
  await assert.rejects(call('student','select public.intrack_send_message($1,$2,$3,$4,$5)',[randomUUID(),enrollment,'student',people.outsider.id,'foreign']),e=>e.code==='42501');
  await assert.rejects(call('adviser','select public.intrack_list_messages($1,$2)',[enrollment,'adviser'],'aal1'),e=>e.code==='42501');
  const notices=await call('adviser','select public.intrack_list_notifications($1) as result',['adviser']);
  assert.equal(notices.unreadCount,2);
  await assert.rejects(call('student','select public.intrack_read_notification($1,$2,$3)',[randomUUID(),notices.items[0].id,'student']),e=>e.code==='42501');
  await call('adviser','select public.intrack_read_notification($1,$2,$3)',[randomUUID(),notices.items[0].id,'adviser']);
  assert.equal((await call('adviser','select public.intrack_list_notifications($1) as result',['adviser'])).unreadCount,1);
});
test('announcements preserve explicit program, term and role audience boundaries',async()=>{
  const payload={programId:program,title:'Synthetic notice',body:'Synthetic announcement',role:'adviser'};
  const id=randomUUID(),published=await call('coordinator','select public.intrack_publish_announcement($1,$2) as result',[id,payload]);
  assert.deepEqual(await call('coordinator','select public.intrack_publish_announcement($1,$2) as result',[id,payload]),published);
  assert.equal((await call('adviser','select public.intrack_list_announcements($1) as result',['adviser'])).items.length,1);
  assert.equal((await call('student','select public.intrack_list_announcements($1) as result',['student'])).items.length,0);
  assert.equal((await call('outsider','select public.intrack_list_announcements($1) as result',['coordinator'])).items.length,0);
  await assert.rejects(call('outsider','select public.intrack_publish_announcement($1,$2)',[randomUUID(),payload]),e=>e.code==='42501');
});
test('self notice acknowledgment cannot activate a suspended profile or acknowledge a stale notice',async()=>{
  await assert.rejects(call('student',"select public.intrack_acknowledge_notice('stale')"),e=>e.code==='40001');
  await call('student',"select public.intrack_acknowledge_notice('synthetic-notice')");
  await db.query("update intrack.profiles set status='suspended' where id=$1",[people.student.id]);
  await assert.rejects(call('student',"select public.intrack_acknowledge_notice('synthetic-notice')"),e=>e.code==='42501');
});
