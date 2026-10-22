import { createClient } from 'npm:@supabase/supabase-js@2';
import { inspectRequirementBytes, MAX_REQUIREMENT_BYTES } from '../_shared/requirementFile.ts';

const origins=(Deno.env.get('INTRACK_AUTH_ORIGINS')||'http://localhost:5173,http://127.0.0.1:5173').split(',');
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
Deno.serve(async(request:Request)=>{
  const origin=request.headers.get('Origin');
  const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
  if(origin && !origins.includes(origin))return respond(403,{error:'Origin denied'});
  if(origin)headers['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method!=='POST')return respond(405,{error:'POST required'});
  const authorization=request.headers.get('Authorization');
  if(!authorization?.startsWith('Bearer '))return respond(401,{error:'Sign in first.'});
  try {
    const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!;
    const caller=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:authError}=await caller.auth.getUser(authorization.slice(7));
    if(authError||!user)return respond(401,{error:'Invalid or expired session.'});
    // Bound the incoming JSON while reading; never log credentials or file URLs.
    const reader=request.body?.getReader();if(!reader)return respond(400,{error:'Request body required'});
    let raw='',length=0;const decoder=new TextDecoder();
    while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;
      if(length>8192){await reader.cancel();return respond(413,{error:'Request too large'});}raw+=decoder.decode(part.value,{stream:true});}
    raw+=decoder.decode();
    let body;try{body=JSON.parse(raw);}catch{return respond(400,{error:'Invalid JSON'});}
    if(!body || !['finalize','finalize_resolution','finalize_artifact','download'].includes(body.action) || !uuid.test(body.documentId||'') || !['student','adviser','coordinator'].includes(body.role)) {
      return respond(400,{error:'Invalid file command'});
    }
    const rpcError=(error:{code?:string;message?:string})=>respond(error.code==='42501'?403:error.code==='40001'?409:400,
      {error:error.message||'File operation denied. Refresh and retry.',code:error.code});
    // This RPC resolves the exact path after current caller scope/MFA checks.
    const {data:file,error:scopeError}=await caller.rpc('intrack_requirement_file',{document_id:body.documentId,actor_role:body.role});
    if(scopeError)return rpcError(scopeError);
    const worker=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    if(body.action==='download') {
      if(file.status!=='attached')return respond(409,{error:'Only submitted evidence can be downloaded.'});
      const {data,error}=await worker.storage.from('ojt-documents').createSignedUrl(file.path,60,{download:file.name});
      if(error)return respond(503,{error:'File download unavailable. Retry.'});
      // Local workers may use the internal Docker hostname. Return a URL the
      // browser can reach, while retaining only the server-generated path/token.
      const publicUrl=new URL(Deno.env.get('INTRACK_PUBLIC_SUPABASE_URL')||'http://127.0.0.1:54321');
      const signed=new URL(data.signedUrl);
      if(!['http:','https:'].includes(publicUrl.protocol))return respond(503,{error:'Public API URL is not configured.'});
      return respond(200,{url:new URL(signed.pathname+signed.search,publicUrl.origin).href,expiresIn:60});
    }
    if(body.role!=='student'||!uuid.test(body.commandId||'')||!body.payload
      ||body.payload.documentId!==body.documentId)return respond(400,{error:'Invalid submission command'});
    if(file.status==='pending') {
      const {data:blob,error}=await worker.storage.from('ojt-documents').download(file.path);
      if(error||!blob)return respond(409,{error:'Upload bytes are missing. Retry the upload before submitting.',code:'UPLOAD_MISSING'});
      if(blob.size>MAX_REQUIREMENT_BYTES)return respond(413,{error:'File exceeds 10 MB.'});
      const bytes=new Uint8Array(await blob.arrayBuffer());
      const mime=inspectRequirementBytes(bytes);
      const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v=>v.toString(16).padStart(2,'0')).join('');
      // Dedicated privileged worker operation: only measured metadata, no actor.
      const {error:attestError}=await worker.rpc('intrack_attest_requirement_file',{
        document_id:body.documentId,measured_bytes:bytes.length,measured_mime:mime,content_hash:hash,
      });
      if(attestError)return rpcError(attestError);
      if(!mime||mime!==file.mimeType||bytes.length!==file.bytes)return respond(422,{error:'The file contents do not match a valid PDF, JPEG or PNG. Choose a valid file and retry.',code:'FILE_INVALID'});
    }
    // Forward caller JWT for the transaction. Worker credentials cannot submit.
    const {data,error}=body.action==='finalize_resolution'
      ? await caller.rpc('intrack_resolution_file_command',{command_id:body.commandId,action:'finalize',payload:body.payload})
      : body.action==='finalize_artifact'
      ? await caller.rpc('intrack_artifact_file_command',{command_id:body.commandId,action:'finalize',payload:body.payload})
      : await caller.rpc('intrack_requirement_command',{command_id:body.commandId,action:'submit',payload:body.payload});
    if(error)return rpcError(error);
    return respond(200,data);
  }catch{return respond(503,{error:'File service unavailable. Keep the pending operation and retry.'});}
});
