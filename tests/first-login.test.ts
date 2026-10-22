import {test} from 'node:test';
import assert from 'node:assert/strict';
import {destinationAfterEmailOtp} from '../src/app/lib/firstLogin.ts';
import type {ProtectedIdentity} from '../src/app/lib/protectedIdentity.ts';
const identity: ProtectedIdentity={state:'setup_required',reason:'activation_required',profile:{id:'fixture',displayName:'Synthetic student',studentNumber:null,status:'invited',activatedAt:null,revision:1},memberships:[],usableRoles:[],staffMfaRequired:false,privacy:{currentVersion:null,acknowledgedAt:null},whitelisted:true,passwordChangeSuggested:true};
test('whitelisted first login and retained default lead to the password decision after OTP',()=>{
  assert.equal(destinationAfterEmailOtp(identity),'/password-decision');
  assert.equal(destinationAfterEmailOtp({...identity,state:'ready',reason:null}),'/password-decision');
  assert.equal(destinationAfterEmailOtp({...identity,state:'mfa_required',reason:'authenticator_required'}),'/verify-authenticator');
});
test('changed passwords, non-whitelisted accounts and disabled/OTP-incomplete identities do not enter that decision',()=>{
  assert.equal(destinationAfterEmailOtp({...identity,state:'ready',reason:null,passwordChangeSuggested:false}),'/account-access');
  assert.equal(destinationAfterEmailOtp({...identity,whitelisted:false}),'/account-access');
  assert.equal(destinationAfterEmailOtp({...identity,reason:'email_otp_required'}),'/account-access');
  assert.equal(destinationAfterEmailOtp({state:'disabled'}),'/account-access');
});

test('ready coordinators go directly to their dashboard, while MFA and setup cannot bypass account access',()=>{
  const coordinator:ProtectedIdentity={...identity,state:'ready',reason:null,whitelisted:false,passwordChangeSuggested:false,usableRoles:['coordinator'],staffMfaRequired:true};
  assert.equal(destinationAfterEmailOtp(coordinator),'/coordinator/dashboard');
  assert.equal(destinationAfterEmailOtp({...coordinator,state:'mfa_required',reason:'staff_mfa_required',usableRoles:[]}),'/verify-authenticator');
  assert.equal(destinationAfterEmailOtp({...coordinator,state:'setup_required',reason:'notice_acknowledgment_required',usableRoles:[]}),'/account-access');
  assert.equal(destinationAfterEmailOtp({...coordinator,usableRoles:['adviser']}),'/adviser/enrollment');
});

test('all roles use the shared authenticator page until MFA succeeds',()=>{
 for(const role of ['student','adviser','coordinator'] as const){
  assert.equal(destinationAfterEmailOtp({...identity,state:'mfa_required',reason:'authenticator_required',memberships:[{id:'m',programId:'p',programCode:'BSIT',role}]}),'/verify-authenticator');
 }
});

test('verified students with a changed password enter their original dashboard',()=>{
 assert.equal(destinationAfterEmailOtp({...identity,state:'ready',reason:null,passwordChangeSuggested:false,usableRoles:['student']}),'/dashboard');
 assert.equal(destinationAfterEmailOtp({...identity,state:'mfa_required',reason:'authenticator_required',passwordChangeSuggested:false,usableRoles:[]}),'/verify-authenticator');
});
