import {createClient} from 'npm:@supabase/supabase-js@2';
import {boundedJson} from '../_shared/boundedJson.ts';
import {hasOtpProof, hasPasswordProof, canBindLoginEmail} from '../_shared/otpProof.ts';
const origins=(Deno.env.get('INTRACK_AUTH_ORIGINS')||'http://localhost:5173,http://127.0.0.1:5173').split(',');
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('Origin');
 const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS'};
 if(origin&&origins.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.includes(origin))return respond(403,{error:'Origin denied'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(request.method!=='POST')return respond(405,{error:'POST required'});
 const authorization=request.headers.get('Authorization');
 if(!authorization?.startsWith('Bearer '))return respond(401,{error:'Password sign-in required.'});
 try{
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!;
  const verifier=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const password=await verifier.auth.getClaims(authorization.slice(7));
  if(password.error||!hasPasswordProof(password.data?.claims))return respond(403,{error:'Password sign-in required.'});
  const body=await boundedJson(request);
  if(!body||typeof body!=='object'||!('otpAccessToken' in body)||typeof body.otpAccessToken!=='string'||body.otpAccessToken.length>16000)return respond(400,{error:'Email verification required.'});
  const email=await verifier.auth.getClaims(body.otpAccessToken);
  if(email.error||!hasOtpProof(email.data?.claims)||!canBindLoginEmail(password.data?.claims,email.data?.claims))return respond(403,{error:'Matching recent password and email verification required.'});
  const claims=password.data!.claims;
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const saved=await admin.rpc('intrack_record_login_email',{subject:claims.sub,password_session:claims.session_id,email_session:email.data!.claims.session_id});
  if(saved.error)return respond(403,{error:'Account access could not be confirmed.'});
  return respond(200,{verified:true});
 }catch{return respond(503,{error:'Email verification unavailable. Sign in again.'});}
});
