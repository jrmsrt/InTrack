// Sends one Supabase-owned OTP to the explicitly supplied test recipient.
// No application roles are provisioned; a newly created test Auth row is removed.
import {createClient} from '@supabase/supabase-js';
import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {createSupabaseApiFetch} from '../src/app/lib/supabaseApiFetch.ts';
const {values}=parseArgs({options:{email:{type:'string'}}});
const email=values.email?.trim().toLowerCase();
if(!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Supply the authorized test email.');
const url=process.env.INTRACK_OPERATOR_SUPABASE_URL,key=process.env.INTRACK_OPERATOR_SECRET_KEY;
if(!url||!key)throw new Error('Load the operator environment first.');
const target=new URL(url);
if(target.protocol!=='http:'||!['localhost','127.0.0.1'].includes(target.hostname)||target.port!=='54321')throw new Error('Only the local InTrack backend is supported.');
const config=await readFile('supabase/config.toml','utf8');
if(!/^\[auth\.email\.smtp\]\s*\n\s*enabled\s*=\s*true/m.test(config))throw new Error('Configure SMTP before sending an external delivery test.');
const env=await readFile('.env','utf8');
const publicKey=env.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');
if(!publicKey)throw new Error('Browser public key unavailable.');
const options=k=>({global:{fetch:createSupabaseApiFetch(k)},auth:{persistSession:false,autoRefreshToken:false}});
const worker=createClient(url,key,options(key)),browser=createClient(url,publicKey,options(publicKey));let created;
try{
 let existing;for(let page=1;page<=20;page++){
  const {data,error}=await worker.auth.admin.listUsers({page,perPage:1000});if(error)throw new Error('Auth directory unavailable');
  existing=data.users.find(user=>user.email?.toLowerCase()===email);if(existing||data.users.length<1000)break;
  if(page===20)throw new Error('Directory exceeds the safe test bound');
 }
 if(!existing){const {data,error}=await worker.auth.admin.createUser({email,email_confirm:true});if(error||!data.user)throw new Error('Temporary Auth fixture unavailable');created=data.user.id;}
 const {error}=await browser.auth.signInWithOtp({email,options:{shouldCreateUser:false}});
 if(error){console.error('Supabase did not confirm the OTP request. Private provider response withheld.');process.exitCode=1;}
 else console.log('Supabase accepted the OTP delivery request. Confirm recipient delivery in Brevo logs and the inbox.');
}catch{console.error('Auth email delivery test failed; private output withheld.');process.exitCode=1;}
finally{if(created){const {error}=await worker.auth.admin.deleteUser(created);
 if(error){console.error('Temporary delivery-test Auth row cleanup is pending.');process.exitCode=1;}
 else console.log('Temporary unprovisioned Auth test account removed. This code is delivery proof only; no university roles were granted.');}}
