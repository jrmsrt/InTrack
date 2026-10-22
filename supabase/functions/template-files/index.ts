import {createClient} from 'npm:@supabase/supabase-js@2';
import {boundedJson} from '../_shared/boundedJson.ts';
import {inspectRequirementBytes,MAX_REQUIREMENT_BYTES} from '../_shared/requirementFile.ts';
const origins=(Deno.env.get('INTRACK_AUTH_ORIGINS')||'http://localhost:5173,http://127.0.0.1:5173').split(',');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('Origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
 const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.includes(origin))return respond(403,{error:'Origin denied'});if(origin)headers['Access-Control-Allow-Origin']=origin;
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(request.method!=='POST')return respond(405,{error:'POST required'});
 const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return respond(401,{error:'Sign in first'});
 try {
  const url=Deno.env.get('SUPABASE_URL')!;
  const caller=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:{user},error:authError}=await caller.auth.getUser(authorization.slice(7));if(authError||!user)return respond(401,{error:'Invalid session'});
  let body:any;try{body=await boundedJson(request);}catch(error){return respond(error instanceof Error&&error.message==='BODY_TOO_LARGE'?413:400,{error:'Invalid or oversized request'});}
  if(!body||!['publish','download'].includes(body.action))return respond(400,{error:'Invalid template action'});
  const worker=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(body.action==='download'){
   if(!uuid.test(body.templateId||''))return respond(400,{error:'Template ID required'});
   const {data:file,error}=await caller.rpc('intrack_template_file',{template_id:body.templateId,actor_role:body.role});
   if(error)return respond(403,{error:'Template unavailable'});
   const {data,error:downloadError}=await worker.storage.from('ojt-templates').createSignedUrl(file.path,60,{download:file.name});
   if(downloadError)return respond(503,{error:'Download unavailable'});
   const publicUrl=new URL(Deno.env.get('INTRACK_PUBLIC_SUPABASE_URL')||'http://127.0.0.1:54321');
   if(!['http:','https:'].includes(publicUrl.protocol))return respond(503,{error:'API URL unavailable'});
   const signed=new URL(data.signedUrl);
   return respond(200,{url:new URL(signed.pathname+signed.search,publicUrl.origin).href,expiresIn:60});
  }
  if(!uuid.test(body.commandId||'')||!uuid.test(body.payload?.uploadId||''))return respond(400,{error:'Publication command required'});
  const {data:upload,error:scopeError}=await caller.rpc('intrack_template_upload_context',{upload_id:body.payload.uploadId});
  if(scopeError)return respond(403,{error:'Upload unavailable'});
  if(upload.state==='pending'){
   const {data:blob,error}=await worker.storage.from('ojt-templates').download(upload.path);
   if(error||!blob)return respond(409,{error:'Upload the reserved PDF first'});
   if(blob.size>MAX_REQUIREMENT_BYTES)return respond(413,{error:'PDF exceeds 10 MiB'});
   const bytes=new Uint8Array(await blob.arrayBuffer());
   if(inspectRequirementBytes(bytes)!=='application/pdf')return respond(400,{error:'PDF signature validation failed'});
   const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
   const {error:attestError}=await worker.rpc('intrack_attest_template',{upload_id:body.payload.uploadId,measured_bytes:bytes.length,measured_mime:'application/pdf',content_hash:hash});
   if(attestError)return respond(409,{error:'Upload validation changed; retry the original command'});
  }
  const {data,error}=await caller.rpc('intrack_template_command',{command_id:body.commandId,action:'publish',payload:body.payload});
  if(error)return respond(error.code==='42501'?403:409,{error:error.message});
  return respond(200,data);
 }catch{return respond(503,{error:'Template service unavailable; preserve the command and retry'});}
});
