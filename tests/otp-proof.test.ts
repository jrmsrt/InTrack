import {test} from 'node:test';
import assert from 'node:assert/strict';
import {hasOtpProof} from '../supabase/functions/_shared/otpProof.ts';
test('password or MFA alone and forged user metadata cannot prove email OTP',()=>{
  for(const value of [null,{}, {amr:null},{amr:'otp'},{amr:['otp']},{amr:[{method:'password'}]}, {amr:[{method:'totp'}]}, {user_metadata:{amr:[{method:'otp'}]}}, {amr:[{method:'password'}],user_metadata:{amr:[{method:'otp'}]}}])assert.equal(hasOtpProof(value),false);
  assert.equal(hasOtpProof({amr:[{method:'otp',timestamp:1}]}),true);
  assert.equal(hasOtpProof({amr:[{method:'totp'},{method:'otp'}]}),true);
});

import {hasVerifiedLoginProof} from '../supabase/functions/_shared/otpProof.ts';
test('password decision requires password AMR and MFA assurance, not two possession methods',()=>{
  for(const claims of [null,{}, {aal:'aal1',amr:[{method:'otp'}]}, {aal:'aal2',amr:[{method:'totp'}]}, {aal:'aal1',amr:[{method:'otp'}],user_metadata:{aal:'aal2'}}])assert.equal(hasVerifiedLoginProof(claims),false);
  assert.equal(hasVerifiedLoginProof({aal:'aal2',amr:[{method:'otp'},{method:'totp'}]}),false);
  assert.equal(hasVerifiedLoginProof({aal:'aal2',amr:[{method:'password'},{method:'totp'}]}),true);
});

import {canBindLoginEmail} from '../supabase/functions/_shared/otpProof.ts';
test('email proof binds only recent verified sessions for the same user',()=>{
 const password={sub:'user',session_id:'11111111-1111-4111-8111-111111111111',iat:1000,amr:[{method:'password',timestamp:1000}]};
 const email={sub:'user',session_id:'22222222-2222-4222-8222-222222222222',iat:1001,amr:[{method:'otp',timestamp:1001}]};
 assert.equal(canBindLoginEmail(password,email,1010),true);
 assert.equal(canBindLoginEmail(password,{...email,sub:'other'},1010),false);
 assert.equal(canBindLoginEmail(password,{...email,session_id:password.session_id},1010),false);
 assert.equal(canBindLoginEmail({...password,amr:[{method:'otp'}]},email,1010),false);
 assert.equal(canBindLoginEmail({...password,iat:1},email,1010),false);
 assert.equal(canBindLoginEmail(password,{...email,iat:3000},1010),false);
 assert.equal(canBindLoginEmail(password,{...email,session_id:'not-a-session'},1010),false);
 assert.equal(canBindLoginEmail({...password,amr:[{method:'password',timestamp:1}]},email,1010),false);
});
