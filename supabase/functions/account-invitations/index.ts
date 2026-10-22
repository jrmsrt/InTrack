import {createClient} from 'npm:@supabase/supabase-js@2';
import {boundedJson} from '../_shared/boundedJson.ts';
const origins=(Deno.env.get('INTRACK_AUTH_ORIGINS')||'http://localhost:5173,http://127.0.0.1:5173').split(',');
Deno.serve(async(request:Request)=>{
  const origin=request.headers.get('Origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin',
    'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS'};
  const respond=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers});
  if(origin&&!origins.includes(origin))return respond(403,{error:'Origin denied'});if(origin)headers['Access-Control-Allow-Origin']=origin;
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});if(request.method!=='POST')return respond(405,{error:'POST required'});
  const authorization=request.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return respond(401,{error:'Sign in first'});
  try{
    const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_ANON_KEY')!;
    const caller=createClient(url,key,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:{user},error}=await caller.auth.getUser(authorization.slice(7));if(error||!user)return respond(401,{error:'Invalid or expired session'});
    let body:any;try{body=await boundedJson(request);}catch(error){return respond(error instanceof Error&&error.message==='BODY_TOO_LARGE'?413:400,{error:'Invalid or oversized JSON'});}
    if(!body||typeof body.commandId!=='string'||!body.payload)return respond(400,{error:'Command required'});
    const {data:reservation,error:reserveError}=await caller.rpc('intrack_reserve_account_invitation',{command_id:body.commandId,payload:body.payload});
    if(reserveError)return respond(reserveError.code==='42501'?403:409,{error:reserveError.message});
    if(reservation.state==='membership_granted')return respond(200,reservation);
    const {data:context,error:contextError}=await caller.rpc('intrack_account_invitation_context',{invitation_id:reservation.invitationId});
    if(contextError)return respond(403,{error:'Invitation scope unavailable'});
    const whitelist=body.mode==='whitelist';
    if(context.authUserId){
      if(whitelist){const registered=await caller.rpc('intrack_register_whitelist',{invitation_id:reservation.invitationId});if(registered.error)return respond(409,{error:'Whitelist setup requires trusted reconciliation.'});}
      return respond(200,{...reservation,state:whitelist?'whitelisted':context.state});
    }
    const worker=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    let subject=body.reconcileAuthUserId;
    if(context.reconciliationRequired&&!subject)return respond(409,{error:'Auth already contains this reserved email. No invitation was resent. Trusted reconciliation of the exact new Auth UUID is required.'});
    if(!subject){
      if(whitelist){
        const temporaryPassword=Deno.env.get('INTRACK_DEFAULT_PASSWORD');
        if(typeof temporaryPassword!=='string'||temporaryPassword.length<12||temporaryPassword.length>256)return respond(503,{error:'The shared default password must be configured privately on the server before whitelisting users.'});
        // The administrative confirmation enables password checking only. The
        // whitelist identity gate still requires a genuine OTP Auth session.
        const created=await worker.auth.admin.createUser({email:context.email,password:temporaryPassword,email_confirm:true});
        if(created.error||!created.data.user)return respond(409,{error:'Account creation could not be confirmed. Preserve the reservation and reconcile any existing new Auth identity; do not reset its password.'});
        subject=created.data.user.id;
      }else{
        const redirect=Deno.env.get('INTRACK_APP_URL')||'http://localhost:5173';
        const invited=await worker.auth.admin.inviteUserByEmail(context.email,{redirectTo:`${redirect}/?authSetup=1`});
        if(invited.error||!invited.data.user)return respond(409,{error:'Invitation delivery could not be confirmed. Reservation is preserved; check Auth and Mailpit before retrying.'});
        subject=invited.data.user.id;
      }
    }
    const {error:linkError}=await caller.rpc(whitelist?'intrack_link_whitelist':'intrack_link_account_invitation',{invitation_id:reservation.invitationId,auth_user_id:subject});
    if(linkError)return respond(409,{error:'Auth invitation exists but linking is pending. Preserve the command ID and reconcile the exact Auth UUID through trusted administration.'});
    return respond(200,{...reservation,state:whitelist?'whitelisted':'sent'});
  }catch{return respond(503,{error:'Invitation unavailable. Preserve the original command ID and check delivery before retrying.'});}
});
