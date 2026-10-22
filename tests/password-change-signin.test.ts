import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { completeRecoveryPassword, continueRecoverySignIn, resumePasswordChangeLogin } from '../src/app/lib/passwordRecoveryGateway.ts';

function fixture({ email = 'student@example.test', eligible = true, accepted = true, resumed = true } = {}) {
  const calls: string[] = [];
  const client = {
    auth: { async getSession() { return { data: { session: { user: { email } } }, error: null }; } },
    async rpc() { calls.push('eligible'); return { data: eligible, error: null }; },
    functions: { async invoke(_name: string, input: { body: { action: string; passwordAccessToken: string } }) {
      assert.equal(input.body.action, 'resume'); assert.equal(input.body.passwordAccessToken, 'temporary-proof');
      calls.push('resume'); return { data: { resumed }, error: null };
    } },
  } as unknown as SupabaseClient;
  const createCheck = () => ({ auth: {
    async signInWithPassword(input: { email: string; password: string }) {
      assert.equal(input.email, 'student@example.test'); assert.equal(input.password, 'new-password');
      calls.push('password');
      return { data: { session: accepted ? { access_token: 'temporary-proof' } : null }, error: accepted ? null : { code: 'invalid_credentials' } };
    },
    async signOut() { calls.push('dispose-proof'); return { error: null }; },
  } }) as unknown as SupabaseClient;
  return { client, calls, createCheck };
}

test('immediate sign-in checks the new password, consumes the server receipt and revokes only its temporary proof', async () => {
  const f = fixture();
  assert.equal(await resumePasswordChangeLogin(f.client, ' Student@Example.test ', 'new-password', undefined, f.createCheck), true);
  assert.deepEqual(f.calls, ['eligible', 'password', 'resume', 'dispose-proof']);
});

test('a different account, expired receipt or consumed receipt cannot skip ordinary sign-in', async () => {
  for (const options of [{ email: 'other@example.test' }, { eligible: false }]) {
    const f = fixture(options);
    assert.equal(await resumePasswordChangeLogin(f.client, 'student@example.test', 'new-password', undefined, f.createCheck), false);
    assert.equal(f.calls.includes('password'), false); assert.equal(f.calls.includes('resume'), false);
  }
  const replay = fixture({ resumed: false });
  assert.equal(await resumePasswordChangeLogin(replay.client, 'student@example.test', 'new-password', undefined, replay.createCheck), false);
  assert.equal(replay.calls.at(-1), 'dispose-proof');
});

test('a wrong password never consumes the receipt or signs out the existing verified session', async () => {
  const f = fixture({ accepted: false });
  await assert.rejects(() => resumePasswordChangeLogin(f.client, 'student@example.test', 'new-password', async () => true, f.createCheck), /Password is incorrect/);
  assert.deepEqual(f.calls, ['eligible', 'password']);
});

test('a completed recovery transfers its verified session only after the server confirms a password change', async () => {
  for (const signedIn of [true, false]) {
    const calls: string[] = [];
    const recovery = { auth: {
      mfa: { async listFactors() { return { data: { totp: [{ id: 'factor', status: 'verified' }] }, error: null }; }, async getAuthenticatorAssuranceLevel() { return { data: { currentLevel: 'aal2' }, error: null }; } },
      async getSession() { return { data: { session: { access_token: 'verified', refresh_token: 'refresh' } }, error: null }; },
      async signOut() { calls.push('signout'); return { error: null }; },
    }, functions: { async invoke() { calls.push('save'); return { data: { changed: true, signedIn }, error: null }; } } } as unknown as SupabaseClient;
    const application = { auth: { async setSession(input: unknown) {
      assert.deepEqual(input, { access_token: 'verified', refresh_token: 'refresh' });
      calls.push('transfer'); return { error: null };
    } } } as unknown as SupabaseClient;
    assert.equal(await completeRecoveryPassword(recovery, 'Recovery-Test42!', 'Recovery-Test42!', application), signedIn);
    assert.deepEqual(calls, signedIn ? ['save', 'transfer'] : ['save']);
  }
});

function recoveryFixture({status=503,code='service_unavailable',directError=null as unknown,transferFails=false}={}) {
 const calls:string[]=[];
 const recovery={auth:{
   mfa:{async listFactors(){return {data:{totp:[]},error:null};}},
   async updateUser(){calls.push('direct-save');return {error:directError};},
   async getSession(){return {data:{session:{access_token:'verified',refresh_token:'refresh'}},error:null};},
   async signOut(){calls.push('signout');},
 },functions:{async invoke(){
   calls.push('service');
   if(transferFails)return {data:{changed:true,signedIn:true},error:null};
   return {data:null,error:{name:'FunctionsHttpError',context:new Response(JSON.stringify({code,error:'private provider detail'}),{status})}};
 }}} as unknown as SupabaseClient;
 const application={auth:{async setSession(){calls.push('transfer');throw new Error('transfer unavailable');}}} as unknown as SupabaseClient;
 return {calls,recovery,application};
}

test('an unavailable carryover service falls back to Auth and does not block password saving',async()=>{
 for(const status of [404,503]){
   const f=recoveryFixture({status});
   assert.equal(await completeRecoveryPassword(f.recovery,'Recovery-Test42!','Recovery-Test42!',f.application),false);
   assert.deepEqual(f.calls,['service','direct-save']);
 }
});

test('rejected passwords do not trigger a fallback or pretend that saving succeeded',async()=>{
 const same=recoveryFixture({status:400,code:'same_password'});
 await assert.rejects(()=>completeRecoveryPassword(same.recovery,'Recovery-Test42!','Recovery-Test42!',same.application),/different from your current password/);
 assert.deepEqual(same.calls,['service']);
 const denied=recoveryFixture({directError:{code:'weak_password'}});
 await assert.rejects(()=>completeRecoveryPassword(denied.recovery,'Recovery-Test42!','Recovery-Test42!',denied.application),/stronger password/);
 assert.deepEqual(denied.calls,['service','direct-save']);
});

test('a session-transfer failure cannot turn an already-saved password into a password error',async()=>{
 const f=recoveryFixture({transferFails:true});
 assert.equal(await completeRecoveryPassword(f.recovery,'Recovery-Test42!','Recovery-Test42!',f.application),false);
 assert.deepEqual(f.calls,['service','transfer']);
});

test('automatic sign-in can be retried without writing the password or requesting any code again',async()=>{
 const calls:string[]=[];
 const recovery={auth:{async getSession(){return {data:{session:{access_token:'verified',refresh_token:'refresh'}},error:null};}},
   functions:{async invoke(_name:string,options:unknown){assert.deepEqual(options,{body:{action:'finish-recovery'}});calls.push('finish');return {data:{signedIn:true},error:null};}}} as unknown as SupabaseClient;
 const application={auth:{async setSession(){calls.push('transfer');return {error:null};}}} as unknown as SupabaseClient;
 assert.equal(await continueRecoverySignIn(recovery,application),true);
 assert.deepEqual(calls,['finish','transfer']);
});
