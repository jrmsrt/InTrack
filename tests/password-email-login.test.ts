import {test} from 'node:test';
import assert from 'node:assert/strict';
import {requestPasswordEmailLogin,verifyLoginPassword} from '../src/app/lib/passwordEmailLogin.ts';
test('password session is retained while email verification is requested without creating users',async()=>{
 const calls:unknown[]=[];
 const auth={async signInWithPassword(input:unknown){calls.push(input);return {data:{session:{}},error:null};},async signOut(input:unknown){calls.push(input);return {error:null};},async signInWithOtp(input:unknown){calls.push(input);return {error:null};},async verifyOtp(){return {error:null};}};
 assert.equal(await requestPasswordEmailLogin(auth,' A@Example.test ','test password'),'a@example.test');
 assert.deepEqual(calls,[{email:'a@example.test',password:'test password'},{email:'a@example.test',options:{shouldCreateUser:false}}]);
});
test('bad passwords or missing sessions never request email; delivery failures revoke the pending password session',async()=>{
 for(const scenario of ['bad_password','missing_session','delivery_failed']){
  let sent=0,revoked=0;
  const auth={async signInWithPassword(){return {data:{session:scenario==='missing_session'?null:{}},error:scenario==='bad_password'?{message:'private detail'}:null};},async signOut(){revoked++;return {error:null};},async signInWithOtp(){sent++;return {error:{message:'private detail'}};},async verifyOtp(){return {error:null};}};
  await assert.rejects(()=>requestPasswordEmailLogin(auth,'a@example.test','test password'),error=>error instanceof Error&&!error.message.includes('private'));
  assert.equal(sent,scenario==='delivery_failed'?1:0);assert.equal(revoked,scenario==='delivery_failed'?1:0);
 }
});
test('separate current-password checks still revoke their transient session',async()=>{
 let revoked=0;const auth={async signInWithPassword(){return {data:{session:{}},error:null};},async signOut(){revoked++;return {error:null};}};
 await verifyLoginPassword(auth,'a@example.test','test password');assert.equal(revoked,1);
});

test('invalid credentials identify the email or password only when account lookup succeeds',async()=>{
 const auth={async signInWithPassword(){return {data:{session:null},error:{code:'invalid_credentials'}};},async signOut(){return {error:null};},async signInWithOtp(){throw new Error('Must not request a code');},async verifyOtp(){return {error:null};}};
 await assert.rejects(()=>requestPasswordEmailLogin(auth,'unknown@example.test','wrong',async()=>false),/Email is not recognized/);
 await assert.rejects(()=>requestPasswordEmailLogin(auth,'known@example.test','wrong',async()=>true),/Password is incorrect/);
 await assert.rejects(()=>requestPasswordEmailLogin(auth,'known@example.test','wrong',async()=>null),/Check your email and password/);
});

test('provider failures do not guess which credential was wrong',async()=>{
 let lookups=0;
 const auth={async signInWithPassword(){return {data:{session:null},error:{code:'service_unavailable'}};},async signOut(){return {error:null};},async signInWithOtp(){throw new Error('Must not request a code');},async verifyOtp(){return {error:null};}};
 await assert.rejects(()=>requestPasswordEmailLogin(auth,'known@example.test','wrong',async()=>{lookups++;return true;}),/Unable to sign in right now/);
 assert.equal(lookups,0);
});
