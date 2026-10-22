import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emailOtpGateway,normalizeOtpEmail,type EmailOtpAuth} from '../src/app/lib/emailOtp.ts';
test('email OTP never creates users and verifies the exact requested email with Supabase',async()=>{
 const calls:unknown[]=[];const auth:EmailOtpAuth={async signInWithOtp(input){calls.push(input);return {error:null};},async verifyOtp(input){calls.push(input);return {error:null};}};
 const gateway=emailOtpGateway(auth);const email=await gateway.request(' Student@Outlook.COM ');await gateway.verify(email,' 123456 ');
 assert.deepEqual(calls,[{email:'student@outlook.com',options:{shouldCreateUser:false}},{email:'student@outlook.com',token:'123456',type:'email'}]);
});
test('OTP validation rejects invalid email and codes before provider calls; errors disclose no raw provider detail',async()=>{
 let calls=0;const auth:EmailOtpAuth={async signInWithOtp(){calls++;return {error:{message:'private SMTP detail'}};},async verifyOtp(){calls++;return {error:{message:'private token detail'}};}};
 assert.throws(()=>normalizeOtpEmail('student'));
 await assert.rejects(()=>emailOtpGateway(auth).verify('student@outlook.com','abcdef'),/six-digit/);assert.equal(calls,0);
 await assert.rejects(()=>emailOtpGateway(auth).request('student@outlook.com'),error=>error instanceof Error&&!error.message.includes('private'));
 await assert.rejects(()=>emailOtpGateway(auth).verify('student@outlook.com','123456'),error=>error instanceof Error&&!error.message.includes('private'));
});
