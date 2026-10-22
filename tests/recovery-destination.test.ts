import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { ProtectedIdentity } from '../src/app/lib/protectedIdentity.ts';
import { destinationAfterRecovery } from '../src/app/lib/recoveryDestination.ts';

test('successful recovery goes directly to the verified role dashboard',()=>{
 for(const [role,path] of [['student','/dashboard'],['adviser','/adviser/dashboard'],['coordinator','/coordinator/dashboard']]){
   const identity={state:'ready',usableRoles:[role],whitelisted:true,passwordChangeSuggested:false} as ProtectedIdentity;
   assert.equal(destinationAfterRecovery(identity),path);
 }
});

test('recovery navigation does not grant dashboard access to an unready identity',()=>{
 for(const state of ['disabled','unprovisioned','setup_required','mfa_required']){
   assert.equal(destinationAfterRecovery({state,usableRoles:['student']} as ProtectedIdentity),'/account-access');
 }
});
