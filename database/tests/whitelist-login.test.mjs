import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const db=new PGlite();
const coordinator={id:randomUUID(),subject:randomUUID()};
const student={id:randomUUID(),subject:randomUUID()};
let program, invitation;
before(async()=>{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;
    create table auth.users(id uuid primary key,email text,created_at timestamptz default now(),encrypted_password text,email_confirmed_at timestamptz,banned_until timestamptz,deleted_at timestamptz);
    create table auth.sessions(id uuid primary key,user_id uuid,created_at timestamptz default now());
    create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;`);
  for(const file of ['../supabase-model.sql','../../supabase/migrations/202610100002_protected_identity.sql','../../supabase/migrations/202610100003_coordinator_bootstrap_activation.sql','../../supabase/migrations/202610140006_administration_foundation.sql','../../supabase/migrations/202610140007_policy_enrollment_projection.sql','../../supabase/migrations/202610140008_communications.sql','../../supabase/migrations/202610140014_scoped_account_invitations.sql','../../supabase/migrations/202610160033_whitelist_password_decision.sql','../../supabase/migrations/202610160034_coordinator_rosters.sql','../../supabase/migrations/202610160035_operator_session_recovery.sql','../../supabase/migrations/202610160036_roster_transaction_mode.sql','../../supabase/migrations/202610160037_adviser_section_filter.sql','../../supabase/migrations/202610160038_whitelist_authenticator.sql','../../supabase/migrations/202610170039_password_replaced_email_otp.sql','../../supabase/migrations/202610170040_mfa_all_roles.sql','../../supabase/migrations/202610170041_password_session_email_proof.sql','../../supabase/migrations/202610170042_student_portal_profile.sql'])await db.exec(await readFile(new URL(file,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/202610210054_recent_password_change_signin.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/202610220055_recovery_auto_signin.sql',import.meta.url),'utf8'));
  program=(await db.query("select id from intrack.programs where code='BSIT'")).rows[0].id;
  await db.exec("update intrack.identity_configuration set current_notice_version='synthetic-notice'");
  for(const [name,p] of Object.entries({coordinator,student})){
    await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,$2,now(),'synthetic-hash-only')",[p.subject,`${name}@example.test`]);
    await db.query('insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,$3,$4,$5)',[p.id,p.subject,name,name==='coordinator'?'active':'invited',name==='coordinator'?new Date().toISOString():null]);
    await db.query('insert into intrack.memberships(profile_id,program_id,role) values($1,$2,$3)',[p.id,program,name]);
  }
  await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'synthetic-notice')",[coordinator.id]);
  await db.query("insert into intrack.program_configuration(program_id,student_email_domains,staff_email_domains,approval_reference) values($1,array['example.test'],array['example.test'],'Synthetic test only') on conflict(program_id) do update set student_email_domains=excluded.student_email_domains,staff_email_domains=excluded.staff_email_domains",[program]);
  const membership=(await db.query('select id from intrack.memberships where profile_id=$1',[student.id])).rows[0].id;
  invitation=(await db.query("insert into intrack.account_invitations(profile_id,membership_id,email,requested_by,state,sent_at,expires_at) values($1,$2,'student@example.test',$3,'sent',now(),now()+interval '1 hour') returning id",[student.id,membership,coordinator.id])).rows[0].id;
});
after(async()=>db.close());
async function call(person,sql,args=[],method='otp',role='authenticated',aal='aal1',iat=Math.floor(Date.now()/1000),transactionMode='read write'){
  if(!person.session){person.session=randomUUID();await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[person.session,person.subject]);await db.query('insert into intrack.login_email_checks(session_id,auth_user_id) values($1,$2)',[person.session,person.subject]);}
  const session=method==='password'?randomUUID():person.session;
  const proof=method==='email_only'?'otp':method==='totp'?'totp':'password';
  await db.exec('begin '+transactionMode);
  try{
    await db.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:person.subject,session_id:session,aal,iat,amr:[{method:proof,timestamp:Math.floor(Date.now()/1000)}],user_metadata:{role:'coordinator',amr:[{method:'otp'}]}})]);
    await db.exec(`set local role ${role}`);
    const result=(await db.query(sql,args)).rows[0]?.result;await db.exec('commit');return result;
  }catch(error){await db.exec('rollback');throw error;}
}
test('only scoped MFA coordinators can register a whitelist; setup tables and activation stay private',async()=>{
  await assert.rejects(call(student,'select public.intrack_register_whitelist($1)',[invitation]),error=>error.code==='42501');
  await assert.rejects(call(coordinator,'select public.intrack_register_whitelist($1)',[invitation]),error=>error.code==='42501');
  await call(coordinator,'select public.intrack_register_whitelist($1) as result',[invitation],'otp','authenticated','aal2');
  await call(coordinator,'select public.intrack_register_whitelist($1) as result',[invitation],'otp','authenticated','aal2');
  assert.equal((await db.query("select count(*)::int n from intrack.audit_events where action='account_whitelisted'")).rows[0].n,1);
  await assert.rejects(call(student,'select * from intrack.whitelist_login_setup'),error=>error.code==='42501');
  await assert.rejects(call(student,"select public.intrack_finish_password_decision($1,'synthetic-notice',false)",[student.subject]),error=>error.code==='42501');
});
test('default password alone and forged metadata cannot open a whitelist account; OTP alone does not activate it',async()=>{
  const password=await call(student,'select public.intrack_get_my_identity() as result',[],'password');
  assert.equal(password.reason,'email_otp_required');assert.deepEqual(password.usableRoles,[]);
  const emailOnly=await call(student,'select public.intrack_get_my_identity() as result',[],'email_only','authenticated','aal2');assert.equal(emailOnly.reason,'password_login_required');assert.deepEqual(emailOnly.usableRoles,[]);
  const verified=await call(student,'select public.intrack_get_my_identity() as result');
  assert.equal(verified.state,'mfa_required');assert.equal(verified.reason,'authenticator_required');assert.deepEqual(verified.usableRoles,[]);assert.equal(verified.passwordChangeSuggested,true);
  const mfa=await call(student,'select public.intrack_get_my_identity() as result',[],'otp','authenticated','aal2');
  assert.equal(mfa.reason,'activation_required');
  assert.equal((await db.query('select status from intrack.profiles where id=$1',[student.id])).rows[0].status,'invited');
});
test('whitelist is not an expiring invitation link; keep decision activates once and retains change suggestion',async()=>{
  await db.query("update intrack.account_invitations set sent_at=now()-interval '2 days',expires_at=now()-interval '1 day' where id=$1",[invitation]);
  await assert.rejects(call(student,'select public.intrack_finish_password_decision($1,$2,false) as result',[student.subject,'wrong-notice'],'otp','service_role'),error=>error.code==='22023');
  const result=await call(student,'select public.intrack_finish_password_decision($1,$2,false) as result',[student.subject,'synthetic-notice'],'otp','service_role');
  assert.equal(result.activated,true);assert.equal(result.passwordChangeSuggested,true);
  await call(student,'select public.intrack_finish_password_decision($1,$2,false) as result',[student.subject,'synthetic-notice'],'otp','service_role');
  const limited=await call(student,'select public.intrack_get_my_identity() as result');assert.equal(limited.state,'mfa_required');assert.deepEqual(limited.usableRoles,[]);
  const identity=await call(student,'select public.intrack_get_my_identity() as result',[],'otp','authenticated','aal2');assert.equal(identity.state,'ready');assert.deepEqual(identity.usableRoles,['student']);
  assert.equal((await db.query("select count(*)::int n from intrack.audit_events where action='password_decision_completed'")).rows[0].n,1);
  assert.equal((await call(student,'select public.intrack_get_my_identity() as result',[],'password')).reason,'email_otp_required');
});
test('confirmed password replacement clears suggestion; later keep cannot restore it, and revocation still blocks',async()=>{
  await call(student,'select public.intrack_finish_password_decision($1,$2,true) as result',[student.subject,'synthetic-notice'],'otp','service_role');
  await call(student,'select public.intrack_finish_password_decision($1,$2,false) as result',[student.subject,'synthetic-notice'],'otp','service_role');
  const changed=await call(student,'select public.intrack_get_my_identity() as result');
  assert.equal(changed.passwordChangeSuggested,false);assert.equal(changed.state,'mfa_required');assert.deepEqual(changed.usableRoles,[]);
  const confirmed=await call(student,'select public.intrack_get_my_identity() as result',[],'otp','authenticated','aal2');assert.equal(confirmed.state,'ready');assert.deepEqual(confirmed.usableRoles,['student']);
  assert.equal((await call(student,'select public.intrack_get_my_identity() as result',[],'password')).reason,'email_otp_required');
  await db.query("update intrack.memberships set active=false,revoked_at=now(),change_reason='Synthetic test' where profile_id=$1",[student.id]);
  await assert.rejects(call(student,'select public.intrack_finish_password_decision($1,$2,false) as result',[student.subject,'synthetic-notice'],'otp','service_role'),error=>error.code==='42501');
});


let rosterBatch;
test('coordinator roster rejects students, anonymous callers and missing MFA before returning personal rows',async()=>{
  for(const [person,role,aal] of [[student,'authenticated','aal1'],[coordinator,'authenticated','aal1'],[coordinator,'anon','aal2']])
    await assert.rejects(call(person,"select public.intrack_coordinator_roster('student') as result",[],'otp',role,aal),error=>error.code==='42501');
  await assert.rejects(call(coordinator,"select public.intrack_coordinator_roster('student',$1)",[{page:-1}],'otp','authenticated','aal2'),error=>error.code==='22023');
});
test('roster shows server activation/access and no invented placement for a saved student',async()=>{
  await db.query("update intrack.profiles set student_number='WHITELIST-001' where id=$1",[student.id]);
  rosterBatch=(await db.query("insert into intrack.import_batches(imported_by,content_hash,row_count,imported_count,unchanged_count) values($1,'fixture',1,1,0) returning id",[coordinator.id])).rows[0].id;
  await db.query("insert into intrack.eligible_students(program_id,student_number,email,display_name,section,import_batch_id,imported_by,invited_profile_id) values($1,'WHITELIST-001','student@example.test','Synthetic Student','3-1',$2,$3,$4)",[program,rosterBatch,coordinator.id,student.id]);
  const result=await call(coordinator,"select public.intrack_coordinator_roster('student') as result",[],'otp','authenticated','aal2');
  assert.equal(result.total,1);assert.equal(result.items[0].activated,true);assert.equal(result.items[0].accessEnabled,false);assert.equal(result.items[0].membershipActive,false);
  assert.equal(result.items[0].enrollmentId,null);assert.equal(result.items[0].adviserName,null);assert.equal(result.items[0].stage,null);
  assert.equal(result.items[0].name,'Synthetic Student');assert.equal(result.programs.length,1);assert.deepEqual(result.sections,['3-1']);
  assert.equal(JSON.stringify(result).includes('synthetic-hash'),false);
});
test('roster pagination/filtering stays scoped, stable and bounded to 100 rows',async()=>{
  const otherProgram=(await db.query("select id from intrack.programs where code='BSHM'")).rows[0].id;
  await db.query("insert into intrack.eligible_students(program_id,student_number,email,display_name,section,import_batch_id,imported_by) select $1,'PAGE-'||n,'page-'||n||'@example.test','Page Student '||lpad(n::text,3,'0'),'4-1',$2,$3 from generate_series(1,105) n",[program,rosterBatch,coordinator.id]);
  await db.query("insert into intrack.eligible_students(program_id,student_number,email,display_name,section,import_batch_id,imported_by) values($1,'HIDDEN-1','hidden@example.test','Other Program Student','4-1',$2,$3)",[otherProgram,rosterBatch,coordinator.id]);
  const first=await call(coordinator,"select public.intrack_coordinator_roster('student',$1) as result",[{search:'Page Student'}],'otp','authenticated','aal2');
  const second=await call(coordinator,"select public.intrack_coordinator_roster('student',$1) as result",[{search:'Page Student',page:1}],'otp','authenticated','aal2');
  assert.equal(first.total,105);assert.equal(first.items.length,100);assert.equal(first.hasMore,true);assert.equal(second.items.length,5);assert.equal(second.hasMore,false);
  assert.equal(first.items.some(row=>second.items.some(other=>other.id===row.id)),false);
  const hidden=await call(coordinator,"select public.intrack_coordinator_roster('student',$1) as result",[{search:'hidden'}],'otp','authenticated','aal2');assert.equal(hidden.total,0);
  const filtered=await call(coordinator,"select public.intrack_coordinator_roster('student',$1) as result",[{section:'3-1',activation:'activated',access:'disabled'}],'otp','authenticated','aal2');assert.equal(filtered.total,1);
});
test('adviser contacts/sections are saved with revisions and cannot be edited through another role or replayed with changed data',async()=>{
  const profile=randomUUID(),subject=randomUUID();
  await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'adviser-roster@example.test',now(),'synthetic-hash')",[subject]);
  await db.query("insert into intrack.profiles(id,auth_user_id,display_name) values($1,$2,'Synthetic Adviser')",[profile,subject]);
  const membership=(await db.query("insert into intrack.memberships(profile_id,program_id,role) values($1,$2,'adviser') returning id",[profile,program])).rows[0].id;
  const id=randomUUID();
  const sql='select public.intrack_save_adviser_roster_details($1,$2,$3,$4,$5) as result';const args=[id,membership,0,'test contact',['3-1','4-1']];
  await assert.rejects(call(student,sql,args),error=>error.code==='42501');
  const saved=await call(coordinator,sql,args,'otp','authenticated','aal2');assert.equal(saved.revision,1);
  assert.deepEqual(await call(coordinator,sql,args,'otp','authenticated','aal2'),saved);
  await assert.rejects(call(coordinator,sql,[id,membership,0,'changed',['3-1']],'otp','authenticated','aal2'),error=>error.code==='40001');
  await assert.rejects(call(coordinator,sql,[randomUUID(),membership,0,'changed',['3-1']],'otp','authenticated','aal2'),error=>error.code==='40001');
  const result=await call(coordinator,"select public.intrack_coordinator_roster('adviser') as result",[],'otp','authenticated','aal2');
  assert.equal(result.items[0].phone,'test contact');assert.deepEqual(result.items[0].sections,['3-1','4-1']);assert.equal(result.items[0].workload,0);assert.equal(result.items[0].activated,false);
  for(const section of ['3-1','4-1']){const filtered=await call(coordinator,"select public.intrack_coordinator_roster('adviser',$1) as result",[{section}],'otp','authenticated','aal2');assert.equal(filtered.total,1);assert.equal(filtered.items[0].membershipId,membership);}
  const absent=await call(coordinator,"select public.intrack_coordinator_roster('adviser',$1) as result",[{section:'4-2'}],'otp','authenticated','aal2');assert.equal(absent.total,0);
});

test('roster POST transaction mode permits authorization locks without changing privileges',async()=>{
  const metadata=()=>db.query("select provolatile,proacl::text acl,prosecdef,proconfig from pg_proc where oid='public.intrack_coordinator_roster(text,jsonb)'::regprocedure");
  const original=(await metadata()).rows[0];
  assert.equal(original.provolatile,'v');assert.equal(original.prosecdef,true);
  const sql="select public.intrack_coordinator_roster('student') as result";
  await db.exec('alter function public.intrack_coordinator_roster(text,jsonb) stable');
  try{await assert.rejects(call(coordinator,sql,[],'otp','authenticated','aal2',Math.floor(Date.now()/1000),'read only'),error=>error.code==='25006'&&/FOR SHARE/.test(error.message));}
  finally{await db.exec(await readFile(new URL('../../supabase/migrations/202610160036_roster_transaction_mode.sql',import.meta.url),'utf8'));}
  const fixed=(await metadata()).rows[0];assert.equal(fixed.provolatile,'v');assert.equal(fixed.acl,original.acl);assert.deepEqual(fixed.proconfig,original.proconfig);
  const roster=await call(coordinator,sql,[],'otp','authenticated','aal2',Math.floor(Date.now()/1000),'read write');
  assert.ok(roster.total>=60);assert.ok(Array.isArray(roster.items));
});

test('trusted coordinator recovery blocks previous JWTs, invalidates old sessions, and leaves MFA required for fresh sign-in',async()=>{
  const adminInvitation=(await db.query("insert into intrack.account_invitations(profile_id,membership_id,email,requested_by) select $1,id,'coordinator@example.test',$1 from intrack.memberships where profile_id=$1 and role='coordinator' returning id",[coordinator.id])).rows[0].id;
  await db.query("insert into intrack.bootstrap_requests(command_id,email,display_name,program_codes,reason,profile_id,invitation_id) values($1,'coordinator@example.test','Synthetic coordinator',array['BSIT'],'Synthetic recovery fixture',$2,$3)",[randomUUID(),coordinator.id,adminInvitation]);
  await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[randomUUID(),coordinator.subject]);
  const sql='select public.intrack_invalidate_coordinator_sessions($1,$2)';
  await assert.rejects(call(coordinator,sql,[coordinator.subject,'Synthetic test'],'otp','authenticated','aal2'),error=>error.code==='42501');
  await call(coordinator,sql,[coordinator.subject,'Synthetic test'],'otp','service_role','aal2');
  assert.equal((await db.query('select count(*)::int n from auth.sessions where user_id=$1',[coordinator.subject])).rows[0].n,0);
  const old=await call(coordinator,'select public.intrack_get_my_identity() as result',[],'otp','authenticated','aal2',1);assert.deepEqual(old,{state:'disabled'});
  coordinator.session=null;
  const fresh=await call(coordinator,'select public.intrack_get_my_identity() as result',[],'otp','authenticated','aal1',Math.floor(Date.now()/1000)+60);assert.equal(fresh.state,'mfa_required');
});
test('changed passwords never bypass MFA for advisers or coordinator memberships',async()=>{
  const person={id:randomUUID(),subject:randomUUID()};
  await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'otp-adviser@example.test',now(),'synthetic-hash')",[person.subject]);
  await db.query("insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,'OTP Adviser','active',now())",[person.id,person.subject]);
  const membership=(await db.query("insert into intrack.memberships(profile_id,program_id,role) values($1,$2,'adviser') returning id",[person.id,program])).rows[0].id;
  const invitationId=(await db.query("insert into intrack.account_invitations(profile_id,membership_id,email,requested_by,state,accepted_at) values($1,$2,'otp-adviser@example.test',$3,'accepted',now()) returning id",[person.id,membership,coordinator.id])).rows[0].id;
  await db.query('insert into intrack.whitelist_login_setup(profile_id,invitation_id) values($1,$2)',[person.id,invitationId]);
  await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'synthetic-notice')",[person.id]);
  const identity=()=>call(person,'select public.intrack_get_my_identity() as result');
  assert.equal((await identity()).state,'mfa_required');
  await db.query('update intrack.whitelist_login_setup set requires_password_change=false where profile_id=$1',[person.id]);
  assert.equal((await identity()).state,'mfa_required');
  await db.query('update intrack.whitelist_login_setup set password_changed_at=now() where profile_id=$1',[person.id]);
  const limited=await identity();assert.equal(limited.state,'mfa_required');assert.deepEqual(limited.usableRoles,[]);assert.equal(limited.staffMfaRequired,true);
  const ready=await call(person,'select public.intrack_get_my_identity() as result',[],'otp','authenticated','aal2');assert.equal(ready.state,'ready');assert.deepEqual(ready.usableRoles,['adviser']);
  assert.equal((await call(person,'select public.intrack_get_my_identity() as result',[],'password')).reason,'email_otp_required');
  await db.query("insert into intrack.memberships(profile_id,program_id,role) values($1,$2,'coordinator')",[person.id,program]);
  const elevated=await identity();assert.equal(elevated.state,'mfa_required');assert.deepEqual(elevated.usableRoles,[]);
});
test('email receipts are private, bound to matching Auth sessions and expire without granting access',async()=>{
 const pass=randomUUID(),email=randomUUID(),foreign=randomUUID();
 await db.query('insert into auth.sessions(id,user_id) values($1,$3),($2,$3)',[pass,email,coordinator.subject]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[foreign,student.subject]);
 const sql='select public.intrack_record_login_email($1,$2,$3)';
 await assert.rejects(call(coordinator,sql,[coordinator.subject,pass,email],'otp','authenticated','aal2'),error=>error.code==='42501');
 await assert.rejects(call(coordinator,sql,[coordinator.subject,pass,foreign],'otp','service_role','aal2'),error=>error.code==='42501');
 await call(coordinator,sql,[coordinator.subject,pass,email],'otp','service_role','aal2');
 const oldSession=coordinator.session;coordinator.session=pass;
 const valid=await call(coordinator,'select public.intrack_get_my_identity() as result',[],'bound','authenticated','aal2',Math.floor(Date.now()/1000)+60);assert.equal(valid.state,'ready');
 await db.query("update intrack.login_email_checks set expires_at=now()-interval '1 second' where session_id=$1",[pass]);
 const expired=await call(coordinator,'select public.intrack_get_my_identity() as result',[],'bound','authenticated','aal2',Math.floor(Date.now()/1000)+60);assert.equal(expired.reason,'email_otp_required');assert.deepEqual(expired.usableRoles,[]);
 coordinator.session=oldSession;
 await assert.rejects(call(coordinator,'select * from intrack.login_email_checks',[],'otp','authenticated','aal2'),error=>error.code==='42501');
});
test('student portal profile uses the verified caller only and rejects missing MFA and other roles',async()=>{
 const person={id:randomUUID(),subject:randomUUID()};
 await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'own-portal@example.test',now(),'synthetic-hash')",[person.subject]);
 await db.query("insert into intrack.profiles(id,auth_user_id,display_name,student_number,status,activated_at) values($1,$2,'Own Student','OWN-PORTAL','active',now())",[person.id,person.subject]);
 await db.query("insert into intrack.memberships(profile_id,program_id,role) values($1,$2,'student')",[person.id,program]);
 await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'synthetic-notice')",[person.id]);
 const sql='select public.intrack_student_portal_profile() as result';
 await assert.rejects(call(person,sql),error=>error.code==='42501');
 await assert.rejects(call(coordinator,sql,[],'otp','authenticated','aal2',Math.floor(Date.now()/1000)+60),error=>error.code==='42501');
 const own=await call(person,sql,[],'otp','authenticated','aal2');
 assert.equal(own.id,person.id);assert.equal(own.name,'Own Student');assert.equal(own.email,'own-portal@example.test');assert.equal(own.studentNumber,'OWN-PORTAL');
 assert.deepEqual(own.programs.map(p=>p.code),['BSIT']);assert.deepEqual(own.placements,[]);assert.deepEqual(own.advisers,[]);
 assert.ok(own.policies.every(p=>p.programId===program));
});

test('recent password-change verification is private, session-bound, expires and is consumed once without inventing MFA',async()=>{
 const person={id:randomUUID(),subject:randomUUID(),session:randomUUID()};
 const password=randomUUID(),foreign=randomUUID(),oldPassword=randomUUID();
 await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'recent-recovery@example.test',now(),'synthetic-hash')",[person.subject]);
 await db.query("insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,'Recovery Student','active',now())",[person.id,person.subject]);
 await db.query("insert into intrack.memberships(profile_id,program_id,role) values($1,$2,'student')",[person.id,program]);
 await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'synthetic-notice')",[person.id]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$3),($2,$3)',[person.session,password,person.subject]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[foreign,student.subject]);
 await db.query("insert into auth.sessions(id,user_id,created_at) values($1,$2,now()-interval '1 hour')",[oldPassword,person.subject]);
 const record='select public.intrack_record_password_change($1,$2)';
 const resume='select public.intrack_resume_password_change($1,$2,$3) as result';
 const args=[person.subject,person.session];
 const eligible=()=>call(person,'select public.intrack_can_resume_password_change() as result',[],'email_only');
 assert.equal(await eligible(),false);
 await assert.rejects(call(person,record,args,'email_only','authenticated','aal2'),error=>error.code==='42501');
 await call(person,record,args,'email_only','service_role','aal2');
 assert.equal(await eligible(),true);
 assert.equal((await call(person,'select public.intrack_get_my_identity() as result',[],'email_only','authenticated','aal2')).reason,'password_login_required');
 await assert.rejects(call(person,'select * from intrack.password_change_sessions',[],'email_only'),error=>error.code==='42501');
 await assert.rejects(call(person,resume,[...args,password],'email_only','authenticated','aal2'),error=>error.code==='42501');
 for(const proof of [foreign,oldPassword,person.session]){
   await assert.rejects(call(person,resume,[...args,proof],'email_only','service_role','aal2'),error=>error.code==='42501');
 }
 await db.query("update intrack.password_change_sessions set resume_until=now()-interval '1 second' where session_id=$1",[person.session]);
 assert.equal(await eligible(),false);
 assert.equal(await call(person,resume,[...args,password],'email_only','service_role','aal2'),false);
 await db.query("update intrack.password_change_sessions set resume_until=now()+interval '5 minutes' where session_id=$1",[person.session]);
 assert.equal(await call(person,resume,[...args,password],'email_only','service_role','aal2'),true);
 assert.equal(await eligible(),false);
 assert.equal(await call(person,resume,[...args,password],'email_only','service_role','aal2'),false);
 const ready=await call(person,'select public.intrack_get_my_identity() as result',[],'email_only','authenticated','aal2');
 assert.equal(ready.state,'ready');assert.deepEqual(ready.usableRoles,['student']);
 const limited=await call(person,'select public.intrack_get_my_identity() as result',[],'email_only','authenticated','aal1');
 assert.equal(limited.state,'mfa_required');assert.deepEqual(limited.usableRoles,[]);
 await db.query("update intrack.password_change_sessions set access_until=now()-interval '1 second' where session_id=$1",[person.session]);
 assert.equal((await call(person,'select public.intrack_get_my_identity() as result',[],'email_only','authenticated','aal2')).reason,'password_login_required');
 await db.query('delete from auth.sessions where id=$1',[person.session]);
 assert.equal((await db.query('select count(*)::int n from intrack.password_change_sessions where session_id=$1',[person.session])).rows[0].n,0);
});

test('trusted recovery completion authorizes its existing verified session without a second password login',async()=>{
 const person={id:randomUUID(),subject:randomUUID(),session:randomUUID()};
 await db.query("insert into auth.users(id,email,email_confirmed_at,encrypted_password) values($1,'auto-recovery@example.test',now(),'synthetic-hash')",[person.subject]);
 await db.query("insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values($1,$2,'Auto Recovery Student','active',now())",[person.id,person.subject]);
 await db.query("insert into intrack.memberships(profile_id,program_id,role) values($1,$2,'student')",[person.id,program]);
 await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values($1,'synthetic-notice')",[person.id]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2)',[person.session,person.subject]);
 const finish='select public.intrack_finish_recovery_session($1,$2) as result',args=[person.subject,person.session];
 await assert.rejects(call(person,finish,args,'email_only','authenticated','aal2'),error=>error.code==='42501');
 assert.equal(await call(person,finish,args,'email_only','service_role','aal2'),false);
 await call(person,'select public.intrack_record_password_change($1,$2)',args,'email_only','service_role','aal2');
 assert.equal(await call(person,finish,[student.subject,person.session],'email_only','service_role','aal2'),false);
 assert.equal(await call(person,finish,args,'email_only','service_role','aal2'),true);
 assert.equal(await call(person,finish,args,'email_only','service_role','aal2'),true);
 assert.equal((await call(person,'select public.intrack_get_my_identity() as result',[],'email_only','authenticated','aal2')).state,'ready');
 assert.equal((await db.query('select count(*)::int n from auth.sessions where user_id=$1',[person.subject])).rows[0].n,1);
 assert.equal((await call(person,'select public.intrack_get_my_identity() as result',[],'email_only','authenticated','aal1')).state,'mfa_required');
 await db.query("update intrack.password_change_sessions set access_until=now()-interval '1 second' where session_id=$1",[person.session]);
 assert.equal(await call(person,finish,args,'email_only','service_role','aal2'),false);
});
