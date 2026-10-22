import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, Info, ShieldCheck, Smartphone } from 'lucide-react';
import { BrandedHeader } from '../../components/shared/BrandedHeader';
import { Button } from '../../components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../../components/ui/input-otp';
import { useProtectedIdentity } from '../../context/useProtectedIdentity';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { readMyProtectedIdentity } from '../../lib/protectedIdentity';
import { destinationAfterEmailOtp } from '../../lib/firstLogin';
import { welcomeName } from '../../lib/welcomeName';
import { clearLoginChallenge } from '../../lib/loginChallenge';
import { clearBackendDrafts } from '../../lib/backendDrafts';

type Factor = { id: string; unfinished: boolean; qr?: string };
export function AuthenticatorVerification() {
  const { result } = useProtectedIdentity(true);
  const navigate = useNavigate(), location = useLocation();
  const identity = result.state === 'loaded' ? result.identity : null;
  const needsMfa = identity?.state === 'mfa_required';
  const [factor, setFactor] = useState<Factor|null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [code, setCode] = useState('');
  const [retry, setRetry] = useState(0);
  const pending = useRef(false), alive = useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    if(!needsMfa)return;
    let cancelled=false;
    setLoading(true);setError('');
    void (async()=>{
      try{
        const {data,error}=await getSupabaseClient().auth.mfa.listFactors();
        if(error)throw new Error('Unable to check your authenticator. Please retry.');
        const saved=data.totp.find(item=>item.status==='verified')||data.totp.find(item=>item.status==='unverified');
        if(!cancelled)setFactor(saved?{id:saved.id,unfinished:saved.status==='unverified'}:null);
      }catch(cause){if(!cancelled)setError(cause instanceof Error?cause.message:'Unable to check your authenticator.');}
      finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[needsMfa,retry]);
  async function run(action:()=>Promise<void>){
    if(pending.current)return;
    pending.current=true;setBusy(true);setError('');
    try{await action();}catch(cause){if(alive.current)setError(cause instanceof Error?cause.message:'Unable to complete verification. Please retry.');}
    finally{pending.current=false;if(alive.current){setBusy(false);setCode('');}}
  }
  async function enroll(){
    const {data,error}=await getSupabaseClient().auth.mfa.enroll({factorType:'totp',friendlyName:'InTrack'});
    if(error)throw new Error('Unable to set up your authenticator. Please retry.');
    const qr=data.totp.qr_code;
    if(alive.current)setFactor({id:data.id,unfinished:true,qr:qr.startsWith('data:')?qr:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(qr)}`});
  }
  if(result.state==='signed_out')return <Navigate to="/login" replace/>;
  if(identity&&!needsMfa)return <Navigate to={destinationAfterEmailOtp(identity)} replace state={location.state}/>;
  return <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
    <BrandedHeader/>
    <main className="flex-1 flex items-center justify-center p-4 py-10">
      <section aria-labelledby="authenticator-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#800000]/5 text-[#800000]"><ShieldCheck className="h-6 w-6"/></div>
        <h1 id="authenticator-title" className="text-center text-2xl font-bold text-slate-900">Authenticator Verification</h1>
        {identity&&'profile' in identity&&<p className="mt-2 text-center text-sm font-semibold text-slate-700">Welcome, {welcomeName(identity.profile.displayName)}!</p>}
        <p className="mt-2 text-center text-xs leading-relaxed text-slate-500">{factor?.unfinished||(!factor&&!loading)?'Connect your authenticator app to secure your InTrack account.':'Enter the code from your authenticator app to continue.'}</p>
        <div className="my-6 flex items-center justify-center gap-2 text-xs text-slate-500"><CheckCircle2 className="h-4 w-4 text-green-700"/><span>Account identified</span><span aria-hidden="true" className="mx-1 h-px w-6 bg-slate-200"/><ShieldCheck className="h-4 w-4 text-[#800000]"/><span className="font-semibold text-[#800000]">Authenticator</span></div>
        {(result.state==='loading'||(needsMfa&&loading))&&<p role="status" className="py-6 text-center text-sm text-slate-500">Checking your authenticator…</p>}
        {result.state==='unavailable'&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">Unable to check account access. Refresh this page to retry.</p>}
        {error&&<div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}{!factor&&<button type="button" className="ml-2 font-semibold underline" disabled={busy} onClick={()=>setRetry(value=>value+1)}>Retry</button>}</div>}
        {needsMfa&&!loading&&!error&&!factor&&<div className="space-y-5">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-center"><Smartphone className="mx-auto mb-3 h-7 w-7 text-slate-500"/><h2 className="text-sm font-semibold text-slate-800">Set up your authenticator</h2><p className="mt-2 text-xs leading-relaxed text-slate-500">Open Microsoft Authenticator or Google Authenticator on your phone. Add an account by scanning the QR code in the next step.</p></div>
          <Button disabled={busy} onClick={()=>void run(enroll)} className="h-12 w-full rounded-lg bg-[#800000] text-sm font-bold text-white hover:bg-[#6b0000]">{busy?'Preparing setup…':'Set Up Authenticator'}</Button>
        </div>}
        {needsMfa&&!loading&&factor&&<form onSubmit={event=>{event.preventDefault();if(code.length!==6)return;void run(async()=>{
          const {error}=await getSupabaseClient().auth.mfa.challengeAndVerify({factorId:factor.id,code});
          if(error)throw new Error('The code was not accepted. Enter the current code from your authenticator app.');
          const verified=await readMyProtectedIdentity();
          if(verified.state==='mfa_required')throw new Error('Verification is still required. Please retry.');
          navigate(destinationAfterEmailOtp(verified),{replace:true,state:location.state});
        });}}>
          {factor.qr&&<div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-center"><p className="mb-3 text-xs font-semibold text-slate-700">1. Scan with your authenticator app</p><img src={factor.qr} width={184} height={184} className="mx-auto rounded-lg border border-slate-200 bg-white p-2" alt="Scan this private QR code with your authenticator app"/><p className="mt-3 text-[11px] text-slate-500">Keep this QR code private.</p></div>}
          {factor.unfinished&&!factor.qr&&<p className="mb-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">Use the authenticator you previously connected. If you did not scan its QR code, restart unfinished setup below.</p>}
          <label htmlFor="authenticator-code" className="mb-3 block text-center text-xs font-bold uppercase tracking-wider text-slate-500">{factor.qr?'2. Enter 6-digit code':'Enter 6-digit code'}</label>
          <InputOTP id="authenticator-code" aria-describedby="authenticator-help" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" required maxLength={6} value={code} disabled={busy} onChange={value=>setCode(value.replace(/\D/g,'').slice(0,6))} containerClassName="justify-center">
            <InputOTPGroup className="gap-2 sm:gap-3">{Array.from({length:6},(_,index)=><InputOTPSlot key={index} index={index} className="h-12 w-9 sm:w-10 rounded-lg first:rounded-lg last:rounded-lg border border-slate-200 bg-slate-50 text-lg font-bold text-slate-900 data-[active=true]:border-[#800000] data-[active=true]:ring-[#800000]/20"/>)}</InputOTPGroup>
          </InputOTP>
          <p id="authenticator-help" className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">Use the current code shown in your app.<br/>This code is separate from your email OTP.</p>
          <Button type="submit" disabled={busy||code.length!==6} className="mt-5 h-12 w-full rounded-lg bg-[#800000] text-sm font-bold text-white hover:bg-[#6b0000]">{busy?'Verifying…':'Verify Authenticator'}</Button>
          {factor.unfinished&&<button type="button" disabled={busy} className="mt-4 w-full text-xs font-semibold text-[#800000] disabled:text-slate-400" onClick={()=>void run(async()=>{
            const auth=getSupabaseClient().auth;
            const {data,error}=await auth.mfa.listFactors();
            if(error||!data.totp.some(item=>item.id===factor.id&&item.status==='unverified'))throw new Error('Only unfinished setup can be restarted.');
            const removed=await auth.mfa.unenroll({factorId:factor.id});
            if(removed.error)throw new Error('Unable to restart unfinished setup. Please retry.');
            setFactor(null);await enroll();
          })}>Restart Unfinished Setup</button>}
        </form>}
        <div className="mt-6 flex gap-2 rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 text-xs leading-relaxed text-cyan-900"><Info className="mt-0.5 h-4 w-4 shrink-0"/><p>Your authenticator adds another layer of protection. Never share your verification codes.</p></div>
        <div className="mt-6 border-t border-slate-200 pt-5 text-center"><button type="button" disabled={busy} className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500 disabled:opacity-50" onClick={()=>void run(async()=>{
          const {error}=await getSupabaseClient().auth.signOut({scope:'local'});
          if(error)throw new Error('Unable to cancel sign-in. Please retry.');
          clearLoginChallenge();clearBackendDrafts();navigate('/login',{replace:true});
        })}><ArrowLeft className="h-3.5 w-3.5"/>Cancel Sign-In</button></div>
      </section>
    </main>
  </div>;
}
