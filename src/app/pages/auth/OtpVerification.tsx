import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Clock } from 'lucide-react';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '../../components/ui/input-otp';
import { BrandedHeader } from '../../components/shared/BrandedHeader';
import { Button } from '../../components/ui/button';
import { emailOtpGateway, OTP_REQUEST_INTERVAL_MS } from '../../lib/emailOtp';
import { createPasswordCheckClient, getSupabaseClient } from '../../lib/supabaseClient';
import { readMyProtectedIdentity } from '../../lib/protectedIdentity';
import { destinationAfterEmailOtp } from '../../lib/firstLogin';
import { clearLoginChallenge, readLoginChallenge, saveLoginChallenge } from '../../lib/loginChallenge';

export function OtpVerification() {
  const navigate = useNavigate();
  const [challenge, setChallenge] = useState(readLoginChallenge);
  const [code, setCode] = useState('');
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => { alive.current = false; window.clearInterval(timer); };
  }, []);
  if (!challenge) return <Navigate to="/login" replace />;
  const resendWait = Math.max(0, Math.ceil((challenge.requestedAt + OTP_REQUEST_INTERVAL_MS - now) / 1000));
  // Match the configured Supabase email OTP lifetime; verification stays server-owned.
  const expiresIn = Math.max(0, Math.ceil((challenge.requestedAt + 600_000 - now) / 1000));
  const expiryLabel = `${Math.floor(expiresIn / 60).toString().padStart(2, '0')}:${(expiresIn % 60).toString().padStart(2, '0')}`;
  async function verify(event: React.FormEvent) {
    event.preventDefault();
    if (!challenge || pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      // Verify email in an isolated session; preserve the password AMR in the app session.
      const temporary=createPasswordCheckClient();
      try{
        await emailOtpGateway(temporary.auth).verify(challenge.email,code);
        const verified=await temporary.auth.getSession();
        const token=verified.data.session?.access_token;
        if(verified.error||!token)throw new Error('Email verification session unavailable.');
        const receipt=await getSupabaseClient().functions.invoke('confirm-login-email',{body:{otpAccessToken:token}});
        if(receipt.error||receipt.data?.verified!==true)throw new Error('Email verification could not be linked to this password sign-in.');
      }finally{await temporary.auth.signOut({scope:'local'});}
      // Whitelisted first-login accounts complete their password decision before activation.
      const identity=await readMyProtectedIdentity();
      if (alive.current) { clearLoginChallenge(); navigate(destinationAfterEmailOtp(identity), { replace: true }); }
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error && cause.message.startsWith('The code') ? cause.message : 'Unable to complete verification. Check the code or retry your account access.');
    } finally { pending.current = false; if (alive.current) { setBusy(false); setCode(''); } }
  }
  async function resend() {
    if (!challenge || pending.current || resendWait > 0) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await emailOtpGateway(getSupabaseClient().auth).request(challenge.email);
      if (!alive.current) return;
      const next = { ...challenge, requestedAt: Date.now() };
      saveLoginChallenge(next); setChallenge(next); setNow(Date.now()); setCode('');
      setMessage('A new code was requested. Check your Inbox and Junk folder.');
    } catch (cause) { if (alive.current) setError(cause instanceof Error ? cause.message : 'Unable to resend. Retry later.'); }
    finally { pending.current = false; if (alive.current) setBusy(false); }
  }
  return <div className="min-h-screen bg-slate-50 flex flex-col font-sans"><BrandedHeader />
    <main className="flex-1 flex items-center justify-center p-4 py-12">
      <section aria-labelledby="otp-title" className="w-full max-w-md rounded-2xl border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <h1 id="otp-title" className="text-center text-2xl font-bold text-slate-900">OTP Verification</h1>
        <p className="mt-1 text-center text-xs text-slate-500">We sent a secure One-Time Password to your PUP Webmail.</p>
        <div className="mt-8 mb-6 flex items-center justify-between rounded-lg border border-amber-300 bg-amber-100/80 px-4 py-3 text-xs text-amber-900">
          <span className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{expiresIn > 0 ? 'Code expires in:' : 'Code expired. Request a new code.'}</span>
          <span role="timer" aria-label="Time until code expires" className="font-bold text-[#800000] tabular-nums">{expiryLabel}</span>
        </div>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{error}</p>}
        {message && <p role="status" className="mb-4 text-xs text-slate-500">{message}</p>}
        <form onSubmit={verify}>
          <label htmlFor="email-code" className="mb-3 block text-center text-xs font-bold uppercase tracking-wider text-slate-500">Enter 6-digit OTP</label>
          <InputOTP id="email-code" aria-describedby="otp-instructions" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" required maxLength={6}
            autoFocus disabled={busy} value={code} onChange={value=>setCode(value.replace(/\D/g,'').slice(0,6))}
            containerClassName="justify-center">
            <InputOTPGroup className="gap-2 sm:gap-3">
              {Array.from({length:6},(_,index)=><InputOTPSlot key={index} index={index} className="h-12 w-9 sm:w-10 rounded-lg first:rounded-lg last:rounded-lg border border-slate-200 bg-slate-50 text-lg font-bold text-slate-900 data-[active=true]:border-[#800000] data-[active=true]:ring-[#800000]/20"/>)}
            </InputOTPGroup>
          </InputOTP>
          <p id="otp-instructions" className="mt-5 text-center text-[10px] leading-relaxed text-slate-400">Please enter the 6-digit verification code sent to<br /><span className="break-words">{challenge.email}.</span></p>
          <Button type="submit" disabled={busy || code.length !== 6 || expiresIn === 0} className="mt-5 h-12 w-full rounded-lg bg-[#800000] hover:bg-[#6b0000] text-sm font-bold text-white shadow-sm">{busy ? 'Please wait…' : 'Verify OTP'}</Button>
        </form>
        <div className="mt-6 text-center text-xs text-slate-500">Didn't receive the code?{' '}
          <button type="button" onClick={() => void resend()} disabled={busy || resendWait > 0} className="font-semibold text-sm text-[#800000] disabled:text-slate-400">{resendWait > 0 ? `Resend OTP (Wait ${resendWait}s)` : 'Resend OTP'}</button>
        </div>
        <div className="mt-7 border-t border-slate-200 pt-5 text-center">
          <Link to="/login" onClick={clearLoginChallenge} aria-disabled={busy} className={`inline-flex items-center gap-2 text-xs font-semibold text-slate-500 ${busy ? 'pointer-events-none' : ''}`}><ArrowLeft className="h-3.5 w-3.5" />Cancel</Link>
        </div>
      </section>
    </main>
  </div>;
}
