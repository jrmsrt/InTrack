import { createClient } from 'npm:@supabase/supabase-js@2';
import { boundedJson } from '../_shared/boundedJson.ts';
import { hasVerifiedLoginProof } from '../_shared/otpProof.ts';

const origins = (Deno.env.get('INTRACK_AUTH_ORIGINS') || 'http://localhost:5173,http://127.0.0.1:5173').split(',');
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');
  const headers: Record<string,string> = {
    'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods':'POST, OPTIONS',
  };
  if (origin && !origins.includes(origin)) return new Response(JSON.stringify({error:'Origin denied'}),{status:403,headers});
  if (origin) headers['Access-Control-Allow-Origin']=origin;
  const respond = (status:number, body:unknown) => new Response(JSON.stringify(body),{status,headers});
  if (request.method==='OPTIONS') return new Response(null,{status:204,headers});
  if (request.method!=='POST') return respond(405,{error:'POST required'});
  const authorization=request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401,{error:'Sign in through your invitation first.'});
  try {
    const url=Deno.env.get('SUPABASE_URL')!;
    const publicKey=Deno.env.get('SUPABASE_ANON_KEY')!;
    const secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const caller=createClient(url,publicKey,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error:identityError}=await caller.auth.getUser(authorization.slice(7));
    if (identityError || !user) return respond(401,{error:'Invalid or expired session.'});
    // Bound and parse without logging credential payloads.
    let body:any;
    try { body=await boundedJson(request); } catch(error) { return respond(error instanceof Error&&error.message==='BODY_TOO_LARGE'?413:400,{error:'Invalid or oversized request.'}); }
    if (!body || body.acceptNotice!==true || typeof body.noticeVersion!=='string' || body.noticeVersion.length>100) {
      return respond(400,{error:'Acknowledge the configured notice version.'});
    }
    // A password session or editable browser flag cannot satisfy first-login OTP.
    const identity=await caller.rpc('intrack_get_my_identity');
    if(identity.error)return respond(403,{error:'Account access could not be checked.'});
    const whitelist=identity.data?.whitelisted===true;
    const decision=body.decision;
    let verifiedSession: string | undefined;
    if(whitelist){
      if(identity.data?.state==='mfa_required'||['email_otp_required','password_login_required'].includes(identity.data?.reason))return respond(403,{error:'Complete password, email and authenticator verification first.'});
      const verified=await caller.auth.getClaims(authorization.slice(7));
      if(verified.error||!hasVerifiedLoginProof(verified.data?.claims))return respond(403,{error:'Verify your emailed code and authenticator app code before completing your password decision.'});
      verifiedSession=verified.data!.claims.session_id as string;
      if(decision!=='keep'&&decision!=='change')return respond(400,{error:'Choose whether to keep or change your password.'});
    }else if(decision)return respond(403,{error:'A whitelisted account is required for this password decision.'});
    const {data: eligibility,error:checkError}=await admin.rpc('intrack_check_activation',{subject:user.id,notice_version:body.noticeVersion});
    if (checkError) return respond(403,{error:'Activation blocked. Check invitation, membership, and current notice configuration.'});
    if (eligibility.alreadyActive&&!whitelist) return respond(200,{activated:true,alreadyActive:true});
    if ((!whitelist||decision==='change')&&(typeof body.password!=='string' || body.password.length<12 || body.password.length>256)) {
      return respond(400,{error:'Use a password of 12–256 characters.'});
    }
    // Forward the verified caller token to Auth. A server SDK client has no persisted
    // refresh-token session, so SDK updateUser() would report a missing session.
    if(!whitelist||decision==='change'){
    const passwordResponse=await fetch(`${url}/auth/v1/user`,{
      method:'PUT',headers:{Authorization:authorization,apikey:publicKey,'Content-Type':'application/json'},
      body:JSON.stringify({password:body.password}),
    });
    if (!passwordResponse.ok) return respond(400,{error:'Supabase could not accept the password. Choose a different password or recheck the invitation session.'});
    }
    const {error:activationError}=await admin.rpc(whitelist?'intrack_finish_password_decision':'intrack_activate_account',{
      subject:user.id,notice_version:body.noticeVersion,...(whitelist?{password_changed:decision==='change'}:{}),
    });
    if (activationError) return respond(409,{error:'Password setup succeeded but activation is pending. Keep this session and retry; access has not been granted.'});
    if (whitelist && decision==='change' && verifiedSession) {
      const receipt=await admin.rpc('intrack_record_password_change',{subject:user.id,verified_session:verifiedSession});
      return respond(200,{activated:true,resumable:!receipt.error});
    }
    return respond(200,{activated:true});
  } catch {
    return respond(503,{error:'Activation unavailable. Retry without restarting account setup.'});
  }
});
