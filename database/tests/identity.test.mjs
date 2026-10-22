import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// PostgreSQL authorization tests with synthetic JWT claims, not real Supabase tokens.
const db = new PGlite();
const subjects = Object.fromEntries(['student', 'other', 'staff', 'invited', 'unverified', 'missing'].map(k => [k, randomUUID()]));
const profiles = Object.fromEntries(Object.keys(subjects).map(k => [k, randomUUID()]));
let program;
before(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key, email text, created_at timestamptz default now(), encrypted_password text,
      email_confirmed_at timestamptz, banned_until timestamptz, deleted_at timestamptz);
    create function auth.jwt() returns jsonb language sql stable as
      $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;`);
  await db.exec(await readFile(new URL('../supabase-model.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/202610100002_protected_identity.sql', import.meta.url), 'utf8'));
  await db.exec(await readFile(new URL('../../supabase/migrations/202610100003_coordinator_bootstrap_activation.sql', import.meta.url), 'utf8'));
  program = (await db.query("select id from intrack.programs where code = 'BSIT'")).rows[0].id;
  for (const [key, id] of Object.entries(subjects)) {
    await db.query('insert into auth.users(id,email_confirmed_at) values ($1,$2)', [id, key === 'unverified' ? null : new Date().toISOString()]);
    if (key === 'missing') continue;
    await db.query(`insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at)
      values ($1,$2,$3,$4,$5)`, [profiles[key], id, `Synthetic ${key}`, key === 'invited' ? 'invited' : 'active', key === 'invited' ? null : new Date().toISOString()]);
    await db.query('insert into intrack.memberships(profile_id,program_id,role) values ($1,$2,$3)', [profiles[key], program, key === 'staff' ? 'adviser' : 'student']);
    await db.query("insert into intrack.privacy_acknowledgments(profile_id,notice_version) values ($1,'synthetic-approved-notice')", [profiles[key]]);
  }
});
after(async () => { await db.close(); });

async function asCaller(key, aal = 'aal1', sql = 'select public.intrack_get_my_identity() as identity', role = 'authenticated') {
  await db.exec('begin');
  try {
    await db.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub: subjects[key], aal, user_metadata: { role: 'coordinator', profile_id: profiles.other } })]);
    await db.exec(`set local role ${role}`);
    return (await db.query(sql)).rows[0]?.identity;
  } finally { await db.exec('rollback'); }
}

test('identity RPC denies anonymous execution and missing subject', async () => {
  await assert.rejects(asCaller('student', 'aal1', undefined, 'anon'), e => e.code === '42501');
  await assert.rejects(asCaller('unknown'), e => e.code === '28000');
});
test('notice is unconfigured by default; configuration and domain tables stay private', async () => {
  const result = await asCaller('student');
  assert.equal(result.state, 'setup_required');
  assert.equal(result.reason, 'notice_not_configured');
  assert.deepEqual(result.usableRoles, []);
  await assert.rejects(asCaller('student', 'aal1', 'select * from intrack.identity_configuration'), e => e.code === '42501');
  await assert.rejects(asCaller('student', 'aal1', 'select * from intrack.profiles'), e => e.code === '42501');
});
test('verified student sees own profile and active memberships; forged metadata grants nothing', async () => {
  await db.query("update intrack.identity_configuration set current_notice_version='synthetic-approved-notice'");
  const result = await asCaller('student');
  assert.equal(result.state, 'ready');
  assert.equal(result.profile.id, profiles.student);
  assert.equal(result.memberships.length, 1);
  assert.deepEqual(result.usableRoles, ['student']);
  assert.ok(!JSON.stringify(result).includes(profiles.other));
  await assert.rejects(asCaller('student', 'aal1', `select public.intrack_get_my_identity('${profiles.other}')`), e => e.code === '42883');
});
test('unverified and unprovisioned Auth identities reveal no profile or memberships', async () => {
  assert.deepEqual(await asCaller('unverified'), { state: 'email_verification_required' });
  assert.deepEqual(await asCaller('missing'), { state: 'unprovisioned' });
});
test('invited identity cannot become ready through a read', async () => {
  const result = await asCaller('invited');
  assert.equal(result.reason, 'activation_required');
  assert.deepEqual(result.usableRoles, []);
});
test('staff need aal2; mixed memberships allow student only at aal1', async () => {
  assert.equal((await asCaller('staff')).state, 'mfa_required');
  assert.deepEqual((await asCaller('staff', 'aal2')).usableRoles, ['adviser']);
  await db.query("insert into intrack.memberships(profile_id,program_id,role) values ($1,$2,'student')", [profiles.staff, program]);
  const mixed = await asCaller('staff');
  assert.equal(mixed.state, 'ready');
  assert.deepEqual(mixed.usableRoles, ['student']);
  assert.equal(mixed.staffMfaRequired, true);
});
test('notice version changes require fresh acknowledgment', async () => {
  await db.query("update intrack.identity_configuration set current_notice_version='synthetic-next-notice'");
  const result = await asCaller('student');
  assert.equal(result.reason, 'notice_acknowledgment_required');
  assert.equal(result.privacy.acknowledgedAt, null);
  await db.query("update intrack.identity_configuration set current_notice_version='synthetic-approved-notice'");
});
test('membership revocation and global suspension take effect with unchanged claims', async () => {
  await db.query("update intrack.memberships set active=false, revoked_at=now(), change_reason='Synthetic test' where profile_id=$1", [profiles.student]);
  const revoked = await asCaller('student');
  assert.equal(revoked.reason, 'membership_required');
  assert.deepEqual(revoked.memberships, []);
  await db.query("update intrack.profiles set status='suspended' where id=$1", [profiles.other]);
  assert.deepEqual(await asCaller('other'), { state: 'disabled' });
});
test('Auth ban and deletion deny access independently of profile state', async () => {
  await db.query("update auth.users set banned_until=now()+interval '1 day' where id=$1", [subjects.staff]);
  assert.deepEqual(await asCaller('staff', 'aal2'), { state: 'disabled' });
  await db.query('update auth.users set deleted_at=now() where id=$1', [subjects.invited]);
  assert.deepEqual(await asCaller('invited'), { state: 'disabled' });
});

const bootstrapCommand=randomUUID(), bootstrapSubject=randomUUID();
let bootstrap;
const reserve=()=>db.query("select public.intrack_reserve_first_coordinator($1,'coordinator@example.test','Synthetic first coordinator',array['BSIT'],'Local synthetic testing') as result",[bootstrapCommand]);
test('bootstrap and activation functions are server-only, not authenticated RPCs',async()=>{
  for(const fn of ['intrack_reserve_first_coordinator(uuid,text,text,text[],text)','intrack_link_first_coordinator(uuid,uuid,text)','intrack_check_activation(uuid,text)','intrack_activate_account(uuid,text)']){
    const grants=await db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed',['authenticated',`public.${fn}`]);
    assert.equal(grants.rows[0].allowed,false);
    assert.equal((await db.query('select has_function_privilege($1,$2,\'EXECUTE\') as allowed',['service_role',`public.${fn}`])).rows[0].allowed,true);
  }
});
test('first coordinator reservation is idempotent, reasoned and cannot create a second coordinator',async()=>{
  bootstrap=(await reserve()).rows[0].result;
  assert.deepEqual((await reserve()).rows[0].result,bootstrap);
  assert.equal(bootstrap.authUserId,null);
  await assert.rejects(db.query("select public.intrack_reserve_first_coordinator($1,'another@example.test','Another',array['BSIT'],'Test')",[randomUUID()]),e=>e.code==='42501');
  await assert.rejects(db.query("select public.intrack_reserve_first_coordinator($1,'changed@example.test','Synthetic first coordinator',array['BSIT'],'Local synthetic testing')",[bootstrapCommand]),e=>e.code==='40001');
});
test('linking requires exact reserved email and new Auth UUID; invitation alone does not activate',async()=>{
  const wrong=randomUUID();
  await db.query("insert into auth.users(id,email) values ($1,'wrong@example.test')",[wrong]);
  await assert.rejects(db.query('select public.intrack_link_first_coordinator($1,$2)',[bootstrapCommand,wrong]),e=>e.code==='42501');
  await db.query("insert into auth.users(id,email) values ($1,'coordinator@example.test')",[bootstrapSubject]);
  assert.equal((await reserve()).rows[0].result.reconciliationRequired,true);
  await db.query('select public.intrack_link_first_coordinator($1,$2)',[bootstrapCommand,bootstrapSubject]);
  await db.query('select public.intrack_link_first_coordinator($1,$2)',[bootstrapCommand,bootstrapSubject]);
  assert.equal((await db.query('select status from intrack.profiles where id=$1',[bootstrap.profileId])).rows[0].status,'invited');
  await assert.rejects(db.query("select public.intrack_activate_account($1,'synthetic-approved-notice')",[bootstrapSubject]),e=>e.code==='42501');
});
test('activation rejects stale notice, missing credential setup and expired invitations',async()=>{
  await db.query('update auth.users set email_confirmed_at=now() where id=$1',[bootstrapSubject]);
  await assert.rejects(db.query("select public.intrack_activate_account($1,'stale-notice')",[bootstrapSubject]),e=>e.code==='22023');
  await assert.rejects(db.query("select public.intrack_activate_account($1,'synthetic-approved-notice')",[bootstrapSubject]),e=>e.code==='42501');
  await db.query("update auth.users set encrypted_password='synthetic-noncredential-fixture' where id=$1",[bootstrapSubject]);
  await db.query("update intrack.account_invitations set sent_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where id=$1",[bootstrap.invitationId]);
  await assert.rejects(db.query("select public.intrack_activate_account($1,'synthetic-approved-notice')",[bootstrapSubject]),e=>e.code==='42501');
  await db.query("update intrack.account_invitations set sent_at=now(),expires_at=now()+interval '1 hour' where id=$1",[bootstrap.invitationId]);
});
test('activation atomically records acknowledgment, accepted invitation and audit; retry adds nothing',async()=>{
  await db.query("select public.intrack_activate_account($1,'synthetic-approved-notice')",[bootstrapSubject]);
  assert.equal((await db.query('select status from intrack.profiles where id=$1',[bootstrap.profileId])).rows[0].status,'active');
  assert.equal((await db.query('select state from intrack.account_invitations where id=$1',[bootstrap.invitationId])).rows[0].state,'accepted');
  const retry=(await db.query("select public.intrack_activate_account($1,'synthetic-approved-notice') as result",[bootstrapSubject])).rows[0].result;
  assert.equal(retry.alreadyActive,true);
  assert.equal((await db.query("select count(*)::int as count from intrack.audit_events where entity_id=$1 and action='account_activated'",[bootstrap.profileId])).rows[0].count,1);
  subjects.bootstrap=bootstrapSubject;
  assert.equal((await asCaller('bootstrap')).state,'mfa_required');
  assert.deepEqual((await asCaller('bootstrap','aal2')).usableRoles,['coordinator']);
  await db.query("update intrack.profiles set status='suspended' where id=$1",[bootstrap.profileId]);
  await assert.rejects(db.query("select public.intrack_activate_account($1,'synthetic-approved-notice')",[bootstrapSubject]),e=>e.code==='42501');
});
