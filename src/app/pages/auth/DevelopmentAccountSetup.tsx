import { useEffect, useState } from 'react';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { readMyProtectedIdentity, type ProtectedIdentity } from '../../lib/protectedIdentity';
import { clearBackendDrafts } from '../../lib/backendDrafts';
import { EmailOtpSignIn } from '../../components/backend/EmailOtpSignIn';

let invitationVerification: Promise<unknown> | undefined;
/** Local development harness, separate from the legacy demo providers. */
export function DevelopmentAccountSetup({localOnly=true}:{localOnly?:boolean}={}) {
  const [identity,setIdentity]=useState<ProtectedIdentity | null>(null);
  const [message,setMessage]=useState('Checking invitation session…');
  const [password,setPassword]=useState('');
  const [email,setEmail]=useState('');
  const [accept,setAccept]=useState(false);
  const [busy,setBusy]=useState(false);
  const [factor,setFactor]=useState<{id:string;qr:string | null;unverified:boolean} | null>(null);
  const [code,setCode]=useState('');
  const [recovery,setRecovery]=useState(new URLSearchParams(window.location.search).get('type')==='recovery');
  const local=(()=>{try{const url=new URL(import.meta.env.VITE_SUPABASE_URL || '');return url.protocol==='http:' && ['localhost','127.0.0.1'].includes(url.hostname) && url.port==='54321';}catch{return false;}})();
  const connectionAllowed=local||(!localOnly&&(()=>{try{return new URL(import.meta.env.VITE_SUPABASE_URL||'').protocol==='https:';}catch{return false;}})());
  const load=async()=>{
    const result=await readMyProtectedIdentity(); setIdentity(result); setMessage(`Account state: ${result.state}`);
  };
  useEffect(()=>{
    if (!connectionAllowed) { setMessage('Configure the Supabase connection before signing in. Development preview requires local Supabase on port 54321.'); return; }
    let alive=true;
    const params=new URLSearchParams(window.location.search);
    const token=params.get('token_hash');
    if (token && !invitationVerification) {
      const type=params.get('type')==='recovery'?'recovery':'invite';
      invitationVerification=getSupabaseClient().auth.verifyOtp({token_hash:token,type}).then(({error})=>{if(error) throw error;});
      // Do not leave the invitation credential in the address bar/history.
      window.history.replaceState(null,'','/?authSetup=1');
    }
    (async()=>{
      try {
        if (invitationVerification) await invitationVerification;
        const {data,error}=await getSupabaseClient().auth.getSession();
        if(error) throw error;
        if(!alive) return;
        if(!data.session) {setMessage('Open your Mailpit invitation, or sign in to resume setup.');return;}
        const result=await readMyProtectedIdentity();
        if(alive){setIdentity(result);setMessage(`Account state: ${result.state}`);}
      } catch {if(alive)setMessage('Invitation/session check failed. Check whether the link expired or was already used.');}
    })();
    return ()=>{alive=false;};
  },[connectionAllowed]);
  const run=async(action:()=>Promise<void>)=>{
    setBusy(true);
    try {await action();} catch(error){setMessage(error instanceof Error?error.message:'Operation failed. Retry.');}
    finally {setBusy(false);setPassword('');}
  };
  useEffect(()=>{
    if(!recovery&&!busy&&identity?.state==='ready'&&identity.usableRoles.includes('coordinator'))window.location.replace('/coordinator/dashboard');
  },[identity,recovery,busy]);
  if(!connectionAllowed)return <main className="p-8">{message}</main>;
  const notice=identity && 'privacy' in identity?identity.privacy.currentVersion:null;
  return <main className="mx-auto max-w-xl space-y-5 p-8">
    <h1 className="text-2xl font-bold">{localOnly?'Local account setup':'InTrack account access'}</h1>
    {localOnly&&<><a className="underline" href="/?requirementsTest=1">Open saved requirements workspace</a>
    <a className="ml-3 underline" href="/?backendTest=1">Open backend administration workspace</a></>}
    <p>{localOnly?'Complete your local account setup, then open the available portal pages below.':'Sign in to check your registered account access.'}</p>
    <p role="status">{message}</p>
    {!identity&&<EmailOtpSignIn onVerified={load} localPreview={local&&import.meta.env.VITE_AUTH_EMAIL_DELIVERY!=='smtp'}/>}
    {!identity && <form className="space-y-3" onSubmit={e=>{e.preventDefault();void run(async()=>{
      const {error}=await getSupabaseClient().auth.signInWithPassword({email,password});if(error)throw new Error('Sign-in failed. Check your credentials.');await load();
    });}}>
      <label className="block">Email<input className="block w-full border p-2" type="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
      <label className="block">Password<input className="block w-full border p-2" type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="rounded border p-2" disabled={busy}>Sign in to resume</button>
      <a className="ml-3 underline" href="/forgot-password">Reset password using a recovery code</a>
    </form>}
    {recovery&&identity&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void run(async()=>{
      const {error}=await getSupabaseClient().auth.updateUser({password});if(error)throw new Error('Password update failed. Request a recovery code from Forgot Password.');setRecovery(false);await load();
    });}}>
      <p>Recovery changes credentials only. It does not restore roles, activation, or clearance.</p>
      <label className="block">New password<input className="block w-full border p-2" type="password" minLength={12} maxLength={256} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="rounded border p-2" disabled={busy}>Save recovered password</button>
    </form>}
    {identity?.state==='setup_required'&&identity.reason==='notice_acknowledgment_required'&&<form className="space-y-3" onSubmit={e=>{e.preventDefault();void run(async()=>{
      const {error}=await getSupabaseClient().rpc('intrack_acknowledge_notice',{notice_version:notice});if(error)throw new Error(error.message);await load();
    });}}><p>Current notice: {notice}. This acknowledgment is separate from optional consent.</p>
      <label><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)}/> I acknowledge the configured notice.</label>
      <button className="rounded border p-2" disabled={busy||!accept||!notice}>Acknowledge current notice</button>
    </form>}
    {identity?.state==='setup_required'&&identity.reason==='activation_required'&&!recovery && <form className="space-y-3" onSubmit={e=>{e.preventDefault();void run(async()=>{
      const {data,error}=await getSupabaseClient().functions.invoke('activate-account',{body:{password,noticeVersion:notice,acceptNotice:accept}});
      if(error){const response=(error as {context?:Response}).context;let detail='Activation failed. Check the local function is running.';if(response){try{detail=(await response.json()).error||detail;}catch{}}throw new Error(detail);}
      if(!data?.activated)throw new Error('Activation did not complete.');await load();
    });}}>
      <p>Configured notice: {notice || 'Not configured; activation is blocked.'}</p>
      <p>For synthetic development testing only: account, membership, and acknowledgment records are stored in your local Supabase database. This test acknowledgment does not approve university processing of real personal data.</p>
      <label className="block"><input type="checkbox" checked={accept} onChange={e=>setAccept(e.target.checked)}/> I acknowledge this configured local test notice.</label>
      <label className="block">Choose your password<input className="block w-full border p-2" type="password" minLength={12} maxLength={256} required autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
      <button className="rounded border p-2" disabled={busy || !notice || !accept}>Complete activation</button>
    </form>}
    {identity && 'staffMfaRequired' in identity && identity.staffMfaRequired && identity.state!=='setup_required' && <section className="space-y-3">
      <button className="rounded border p-2" disabled={busy || !!factor} onClick={()=>void run(async()=>{
        const client=getSupabaseClient();const {data,error}=await client.auth.mfa.listFactors();if(error)throw error;
        const existing=data.totp.find(f=>f.status==='verified');
        if(existing){setFactor({id:existing.id,qr:null,unverified:false});return;}
        const unfinished=data.totp.find(f=>f.status==='unverified');
        if(unfinished){setFactor({id:unfinished.id,qr:null,unverified:true});setMessage('Resume the code from your previously scanned authenticator. If you never scanned it, remove this unfinished setup and enroll again.');return;}
        const enrolled=await client.auth.mfa.enroll({factorType:'totp',friendlyName:'InTrack local development'});if(enrolled.error)throw enrolled.error;
        const qr=enrolled.data.totp.qr_code;setFactor({id:enrolled.data.id,unverified:true,qr:qr.startsWith('data:')?qr:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`});
      })}>Set up / verify authenticator</button>
      {factor && <form onSubmit={e=>{e.preventDefault();void run(async()=>{
        const {error}=await getSupabaseClient().auth.mfa.challengeAndVerify({factorId:factor.id,code});if(error)throw new Error('Authenticator code was not accepted.');setCode('');setFactor(null);await load();
      });}}>
        {factor.qr && <img src={factor.qr} alt="Scan with your authenticator app" width={220} height={220}/>}
        <label className="block">Authenticator code<input className="block border p-2" inputMode="numeric" pattern="[0-9]{6}" required value={code} onChange={e=>setCode(e.target.value)}/></label>
        <button className="rounded border p-2" disabled={busy}>Verify MFA</button>
        {factor.unverified&&<button className="ml-3 underline" type="button" disabled={busy} onClick={()=>void run(async()=>{
          const client=getSupabaseClient();const {data,error}=await client.auth.mfa.listFactors();if(error)throw error;
          if(!data.totp.some(f=>f.id===factor.id&&f.status==='unverified'))throw new Error('Verified MFA requires trusted recovery; this control only removes unfinished setup.');
          const removed=await client.auth.mfa.unenroll({factorId:factor.id});if(removed.error)throw removed.error;setFactor(null);setCode('');setMessage('Unfinished setup removed. Enroll an authenticator again.');
        })}>Remove unfinished MFA setup</button>}
      </form>}
    </section>}
    {identity && 'usableRoles' in identity && <p>Usable roles: {identity.usableRoles.join(', ') || 'none'}</p>}
    {identity?.state==='ready'&&identity.usableRoles.includes('coordinator')&&<nav className="space-y-2"><a className="block font-semibold text-[#800000] underline" href="/coordinator/students">Open Student Management</a><a className="block font-semibold text-[#800000] underline" href="/coordinator/advisers">Open Adviser Management</a></nav>}
    {identity && <button className="rounded border p-2" disabled={busy} onClick={()=>void run(async()=>{
      const {error}=await getSupabaseClient().auth.signOut();if(error)throw error;try{clearBackendDrafts();}catch{}setIdentity(null);setFactor(null);setCode('');setRecovery(false);invitationVerification=undefined;setMessage('Signed out.');
    })}>Sign out</button>}
    <p><a className="underline" href="/">{localOnly?'Return to demo':'Return to InTrack'}</a></p>
  </main>;
}
