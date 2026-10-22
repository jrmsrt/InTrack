import {useEffect,useRef,useState} from 'react';
import {getSupabaseClient} from '../../lib/supabaseClient';
import {emailOtpGateway,OTP_REQUEST_INTERVAL_MS} from '../../lib/emailOtp';
export function EmailOtpSignIn({onVerified,localPreview=true}:{onVerified:()=>Promise<void>;localPreview?:boolean}){
 const [email,setEmail]=useState(''),[sentTo,setSentTo]=useState<string|null>(null),[code,setCode]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[waitUntil,setWaitUntil]=useState(0),[now,setNow]=useState(Date.now());
 const generation=useRef(0);useEffect(()=>()=>{++generation.current;},[]);
 useEffect(()=>{if(waitUntil<=Date.now())return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[waitUntil]);
 const seconds=Math.max(0,Math.ceil((waitUntil-now)/1000));
 const request=async()=>{const n=++generation.current;setBusy(true);setCode('');
  try{const target=await emailOtpGateway(getSupabaseClient().auth).request(email);
   if(n===generation.current){setSentTo(target);setWaitUntil(Date.now()+OTP_REQUEST_INTERVAL_MS);setNow(Date.now());setMessage(localPreview?'If sign-in is available, your code is in local Mailpit. Real inbox delivery needs the sending service configured.':'If sign-in is available, check your inbox and junk folder for the latest code.');}
  }catch(error){if(n===generation.current)setMessage(error instanceof Error?error.message:'Code request unavailable');}finally{if(n===generation.current)setBusy(false);}
 };
 const verify=async()=>{if(!sentTo)return;const n=++generation.current;setBusy(true);
  try{await emailOtpGateway(getSupabaseClient().auth).verify(sentTo,code);if(n!==generation.current)return;setCode('');setMessage('Signed in. Checking account access…');await onVerified();}
  catch(error){if(n===generation.current)setMessage(error instanceof Error?error.message:'Code verification unavailable');}finally{if(n===generation.current)setBusy(false);}
 };
 return <section className="space-y-3 rounded border p-4"><h2 className="text-xl font-bold">Sign in with an email code</h2>
  <p>Use the address registered by your coordinator. Outlook and PUP webmail receive the same kind of code. Staff still need their authenticator.</p>
  <form onSubmit={e=>{e.preventDefault();void request();}} className="space-y-3">
   <label className="block">Registered email<input disabled={busy} className="block w-full border p-2" type="email" autoComplete="email" required maxLength={254} value={email} onChange={e=>{++generation.current;setEmail(e.target.value);setSentTo(null);setCode('');setMessage('');}}/></label>
   <button disabled={busy||seconds>0} className="rounded border p-2">{seconds>0?`Request again in ${seconds}s`:sentTo?'Send a new code':'Send sign-in code'}</button>
  </form>
  {sentTo&&<form onSubmit={e=>{e.preventDefault();void verify();}} className="space-y-3">
   <label className="block">Six-digit code<input disabled={busy} className="block w-full border p-2" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label>
   <button disabled={busy} className="rounded border p-2">Verify code and sign in</button>
  </form>}
  <p role="status" aria-live="polite">{message}</p>
 </section>;
}
