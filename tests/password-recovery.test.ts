import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openPasswordRecovery,saveRecoveredPassword,requestPasswordRecovery,recoveryPasswordError} from '../src/app/lib/passwordRecovery.ts';

function fixture({verified=true,level='aal1',invalid=false,writeError=false,factorsError=false}={}){
  const calls:string[]=[];
  return {calls,auth:{
    async verifyOtp(input:unknown){calls.push(JSON.stringify(input));return {data:{session:invalid?null:{}},error:invalid?{}:null};},
    mfa:{async listFactors(){return {data:{totp:verified?[{id:'factor',status:'verified'}]:[]},error:factorsError?{}:null};},async getAuthenticatorAssuranceLevel(){return {data:{currentLevel:level},error:null};}},
    async updateUser(){calls.push('write');return {error:writeError?{}:null};},
    async signOut(){calls.push('signout');return {error:null};},
  }};
}

test('recovery checks activation before requesting an email and normalizes the address',async()=>{
 const calls:unknown[]=[];
 const auth={async resetPasswordForEmail(email:string){calls.push({email});return {error:null};}};
 assert.equal(await requestPasswordRecovery(auth,async email=>{calls.push(email);return 'ready';},' Student@Example.test '),'student@example.test');
 assert.deepEqual(calls,['student@example.test',{email:'student@example.test'}]);
});

test('unactivated accounts get default-credential guidance and never request recovery mail',async()=>{
 let sent=0;
 const auth={async resetPasswordForEmail(){sent++;return {error:null};}};
 await assert.rejects(()=>requestPasswordRecovery(auth,async()=>'activation_required','student@example.test'),/Go back to Login.*default password/);
 await assert.rejects(()=>requestPasswordRecovery(auth,async()=>'unavailable','student@example.test'),/not eligible/);
 await assert.rejects(()=>requestPasswordRecovery(auth,async()=>{throw new Error('Activation check unavailable');},'student@example.test'),/Activation check unavailable/);
 assert.equal(sent,0);
});

test('recovery delivery errors never report success',async()=>{
 const auth={async resetPasswordForEmail(){return {error:{message:'private provider detail'}};}};
 await assert.rejects(()=>requestPasswordRecovery(auth,async()=>'ready','student@example.test'),/Unable to send the recovery code/);
});
test('recovery verifies the emailed code with its email and recovery type; invalid or expired codes are rejected',async()=>{
  const f=fixture();assert.equal(await openPasswordRecovery(f.auth,' Student@Example.test ',' 123456 '),'factor');
  assert.deepEqual(JSON.parse(f.calls[0]),{email:'student@example.test',token:'123456',type:'recovery'});
  const invalid=fixture({invalid:true});
  await assert.rejects(()=>openPasswordRecovery(invalid.auth,'student@example.test','123456'),/incorrect, expired, or already used/);
  assert.equal(invalid.calls.includes('write'),false);
});

test('malformed recovery codes and emails never call the provider',async()=>{
  const f=fixture();
  for(const code of ['', '12345', '1234567', '12ab56']) {
    await assert.rejects(()=>openPasswordRecovery(f.auth,'student@example.test',code),/six-digit/);
  }
  await assert.rejects(()=>openPasswordRecovery(f.auth,'invalid-email','123456'),/complete email/);
  assert.deepEqual(f.calls,[]);
});

test('a recovery session is revoked if its authenticator requirements cannot be checked',async()=>{
  const f=fixture({factorsError:true});
  await assert.rejects(()=>openPasswordRecovery(f.auth,'student@example.test','123456'),/Unable to check your authenticator/);
  assert.equal(f.calls.at(-1),'signout');
});
test('enrolled authenticators cannot be bypassed at password write',async()=>{
  const f=fixture();await assert.rejects(()=>saveRecoveredPassword(f.auth,'Recovery-Test42!','Recovery-Test42!'),/authenticator/);
  assert.equal(f.calls.includes('write'),false);
});
test('valid recovery writes once and leaves session transfer or cleanup to its caller; API failures are not successes',async()=>{
  const f=fixture({level:'aal2'});await saveRecoveredPassword(f.auth,'Recovery-Test42!','Recovery-Test42!');assert.deepEqual(f.calls,['write']);
  const failed=fixture({level:'aal2',writeError:true});await assert.rejects(()=>saveRecoveredPassword(failed.auth,'Recovery-Test42!','Recovery-Test42!'),/Unable to save/);assert.deepEqual(failed.calls,['write']);
});

test('password recovery explains recognized failures without exposing provider details',()=>{
 assert.match(recoveryPasswordError({code:'same_password',message:'private detail'}).message,/different from your current password/);
 assert.match(recoveryPasswordError({code:'session_expired'}).message,/session has expired/);
 assert.match(recoveryPasswordError({code:'insufficient_aal'}).message,/authenticator/);
 assert.match(recoveryPasswordError({status:429}).message,/wait/);
 assert.equal(recoveryPasswordError({message:'private internal detail'}).message,'Unable to save your new password right now. Please try again.');
});
test('weak or mismatched passwords never write; unenrolled accounts can recover without granting activation',async()=>{
  const f=fixture({verified:false});await assert.rejects(()=>saveRecoveredPassword(f.auth,'short','short'),/12/);
  await assert.rejects(()=>saveRecoveredPassword(f.auth,'Recovery-Test42!','different'),/match/);assert.deepEqual(f.calls,[]);
  await saveRecoveredPassword(f.auth,'Recovery-Test42!','Recovery-Test42!');assert.deepEqual(f.calls,['write']);
});
