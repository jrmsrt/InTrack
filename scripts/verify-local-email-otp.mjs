// Real Auth/Mailpit acceptance using an ephemeral synthetic Auth account.
// Never prints OTPs, sessions, email bodies or API keys; never sends externally.
import {createClient} from '@supabase/supabase-js';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {createSupabaseApiFetch} from '../src/app/lib/supabaseApiFetch.ts';
const url=process.env.INTRACK_OPERATOR_SUPABASE_URL,key=process.env.INTRACK_OPERATOR_SECRET_KEY;
if(!url||!key)throw new Error('Load .env first.');
const endpoint=new URL(url);
if(endpoint.protocol!=='http:'||!['localhost','127.0.0.1'].includes(endpoint.hostname)||endpoint.port!=='54321')throw new Error('Only the local InTrack stack is supported.');
const config=await readFile('supabase/config.toml','utf8');
const smtp=config.match(/^\[auth\.email\.smtp\]([\s\S]*?)(?=^\[|$(?![\s\S]))/m)?.[1]||'';
if(/^enabled\s*=\s*true\s*$/m.test(smtp))throw new Error('This synthetic test requires Mailpit preview, not external delivery.');
const browserEnv=await readFile('.env','utf8');
const publicKey=browserEnv.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m)?.[1]?.trim().replace(/^['"]|['"]$/g,'');
if(!publicKey)throw new Error('Local browser public key is missing.');
const options=k=>({global:{fetch:createSupabaseApiFetch(k)},auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
const worker=createClient(url,key,options(key)),browser=createClient(url,publicKey,options(publicKey));
const email=`otp-proof-${randomUUID()}@example.test`;let subject;let stage='Mailpit availability';
const json=async path=>{const response=await fetch(`http://127.0.0.1:54324${path}`);if(!response.ok)throw new Error('Mailpit unavailable');return response.json();};
try{
 await json('/api/v1/info');
 stage='public signup blocking';
 const signup=await browser.auth.signUp({email:`uninvited-${randomUUID()}@example.test`,password:randomUUID()+'A!'});
 if(!signup.error)throw new Error('Public signup was not blocked');
 stage='synthetic Auth account creation';
 const {data,error}=await worker.auth.admin.createUser({email,email_confirm:true});if(error||!data.user)throw new Error('Fixture creation failed');subject=data.user.id;
 stage='Supabase OTP request';
 const sent=await browser.auth.signInWithOtp({email,options:{shouldCreateUser:false}});if(sent.error){
  const known=['over_email_send_rate_limit','over_request_rate_limit','email_address_not_authorized','otp_disabled','email_provider_disabled','signup_disabled','unexpected_failure'];
  console.error(`Auth response status: ${Number(sent.error.status)||'unavailable'}; category: ${known.includes(sent.error.code)?sent.error.code:'unclassified'}`);
  throw new Error('OTP request failed');}
 stage='Mailpit OTP template';
 let message;
 for(let attempt=0;attempt<15;attempt++){
  const found=await json('/api/v1/search?query='+encodeURIComponent('to:'+email));
  const match=found.messages?.find(item=>item.To?.some(to=>to.Address===email));
  if(match){message=await json('/api/v1/message/'+encodeURIComponent(match.ID));break;}
  await new Promise(resolve=>setTimeout(resolve,500));
 }
 if(!message||!message.To?.some(to=>to.Address===email))throw new Error('Synthetic OTP message not found');
 const token=message.HTML?.match(/letter-spacing:6px[^>]*>\s*(\d{6})\s*</)?.[1]||message.Text?.match(/\b(\d{6})\b/)?.[1];
 if(!token)throw new Error('Six-digit OTP template was not loaded');
 stage='OTP verification and account access';
 const wrong=String((Number(token)+1)%1000000).padStart(6,'0');
 const rejected=await browser.auth.verifyOtp({email,token:wrong,type:'email'});if(!rejected.error)throw new Error('Incorrect OTP was accepted');
 const verified=await browser.auth.verifyOtp({email,token,type:'email'});if(verified.error||verified.data.user?.id!==subject||!verified.data.session)throw new Error('Real OTP verification failed');
 const identity=await browser.rpc('intrack_get_my_identity');if(identity.error||identity.data.state!=='unprovisioned')throw new Error('Unprovisioned access gate failed');
 const records=await browser.rpc('intrack_list_enrollments',{actor_role:'student'});if(!records.error)throw new Error('Unprovisioned enrollment read was accepted');
 const replay=await browser.auth.verifyOtp({email,token,type:'email'});if(!replay.error)throw new Error('Consumed OTP was accepted');
 console.log(JSON.stringify({realAuthVerification:true,mailpitTemplate:true,publicSignupBlocked:true,incorrectCodeRejected:true,consumedCodeRejected:true,unprovisionedIdentityBlocked:true,outlookDeliveryVerified:false}));
}catch{console.error(`Local OTP acceptance failed at ${stage}; private credentials and email content were withheld.`);process.exitCode=1;}
finally{if(subject){const removed=await worker.auth.admin.deleteUser(subject);if(removed.error){console.error('Synthetic Auth account cleanup requires retry; no real account was selected.');process.exitCode=1;}}}
