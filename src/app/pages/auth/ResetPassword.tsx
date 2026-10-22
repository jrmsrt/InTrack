import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { createPasswordCheckClient } from '../../lib/supabaseClient';
import { openPasswordRecovery, RECOVERY_RESEND_INTERVAL_MS } from '../../lib/passwordRecovery';
import { completeRecoveryPassword, continueRecoverySignIn, sendRecoveryCode } from '../../lib/passwordRecoveryGateway';
import { readMyProtectedIdentity } from '../../lib/protectedIdentity';
import { destinationAfterRecovery } from '../../lib/recoveryDestination';
import { BrandedHeader } from '../../components/shared/BrandedHeader';
import { PasswordChangePage } from '../../components/auth/PasswordChangePage';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

const buttonClass = 'w-full bg-[#800000] text-white hover:bg-[#6b0000]';

export function ResetPassword() {
  const navigate = useNavigate();
  const { state, pathname } = useLocation();
  const [email, setEmail] = useState(() => typeof state?.recoveryEmail === 'string' ? state.recoveryEmail : '');
  const [requestedAt, setRequestedAt] = useState(() =>
    typeof state?.requestedAt === 'number' && Number.isFinite(state.requestedAt) && state.requestedAt <= Date.now()
      ? state.requestedAt : 0);
  const [now, setNow] = useState(Date.now());
  const client = useRef<ReturnType<typeof createPasswordCheckClient> | null>(null);
  const [stage, setStage] = useState<'code' | 'authenticator' | 'password' | 'saved'>('code');
  const [factor, setFactor] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const pending = useRef(false);
  const alive = useRef(true);
  const transferred = useRef(false);
  useEffect(() => {
    alive.current = true;
    return () => { alive.current = false; if (!transferred.current) void client.current?.auth.signOut({ scope: 'local' }); };
  }, []);
  useEffect(() => {
    if (stage !== 'code') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [stage]);
  const resendWait = Math.max(0, Math.ceil((requestedAt + RECOVERY_RESEND_INTERVAL_MS - now) / 1000));

  async function run(action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError(''); setMessage('');
    try { await action(); }
    catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : 'Unable to reset your password. Please retry.');
    } finally {
      pending.current = false;
      if (alive.current) { setBusy(false); setCode(''); }
    }
  }

  async function resend() {
    if (resendWait > 0) return;
    await run(async () => {
      const address = await sendRecoveryCode(email);
      if (!alive.current) return;
      const sentAt = Date.now();
      setEmail(address); setRequestedAt(sentAt); setNow(sentAt);
      setMessage('A new recovery code has been requested. Check your PUP Webmail Inbox, Junk, or Spam folder.');
    });
  }

  async function openDashboard() {
    const identity = await readMyProtectedIdentity();
    if (alive.current) navigate(destinationAfterRecovery(identity), { replace: true });
  }

  async function continueToDashboard() {
    await run(async () => {
      if (!client.current) throw new Error('Your verified recovery session is unavailable.');
      if (!transferred.current) transferred.current = await continueRecoverySignIn(client.current);
      if (!transferred.current) throw new Error('Your password is saved, but automatic sign-in is temporarily unavailable. Please try again shortly.');
      await openDashboard();
    });
  }

  const passwordPage = pathname.replace(/\/+$/, '') === '/reset-password/new';
  // Navigation metadata never grants recovery access: refresh/direct entry
  // must verify a code again before the isolated session can change a password.
  if (passwordPage && stage !== 'password' && stage !== 'saved') return <Navigate to="/reset-password" state={state} replace />;
  if (!passwordPage && (stage === 'password' || stage === 'saved')) return <Navigate to="/reset-password/new" state={state} replace />;

  if (stage === 'password') return <PasswordChangePage cancelTo="/forgot-password" onSubmit={async (password, confirmation) => {
    if (!client.current) throw new Error('Your recovery session is unavailable. Request a new recovery code.');
    transferred.current = await completeRecoveryPassword(client.current, password, confirmation);
    if (!alive.current) return;
    if (transferred.current) {
      try { await openDashboard(); return; } catch { /* Saving succeeded; retry account routing without resaving. */ }
    }
    setStage('saved');
  }} />;

  return <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
    <BrandedHeader />
    <main className="flex-1 flex items-center justify-center p-4 py-8">
      <section className="w-full max-w-[400px] rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-center text-2xl font-bold text-slate-900">{stage === 'code' ? 'Verify Recovery Code' : stage === 'saved' ? 'Password Changed' : 'Reset Password'}</h1>
        <p className="mt-2 mb-6 text-center text-xs text-slate-500">
          {stage === 'code' ? 'Enter the six-digit recovery code sent to your PUP Webmail. Check your Junk or Spam folder if you do not see it in your Inbox.'
            : stage === 'authenticator' ? 'Enter the code from your connected authenticator app.'
              : stage === 'saved' ? 'Your new password has been saved. We could not open your dashboard yet. Please continue to retry automatic sign-in.'
                : 'Choose a new password for your InTrack account.'}
        </p>
        {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-lg bg-sky-50 p-3 text-xs text-slate-600">{message}</p>}

        {stage === 'code' && <>
          <form className="space-y-4" onSubmit={event => {
            event.preventDefault();
            void run(async () => {
              client.current ??= createPasswordCheckClient();
              const id = await openPasswordRecovery(client.current.auth, email, code);
              if (alive.current) { setFactor(id); setStage(id ? 'authenticator' : 'password'); }
            });
          }}>
            <div className="space-y-2">
              <Label htmlFor="recovery-email">PUP Webmail</Label>
              <Input id="recovery-email" type="email" placeholder="Enter your PUP Webmail address" autoComplete="email" maxLength={254} required disabled={busy} value={email}
                onChange={event => { setEmail(event.target.value); setCode(''); setError(''); setMessage(''); }} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-recovery-code">Recovery code</Label>
              <Input id="email-recovery-code" placeholder="Enter your six-digit recovery code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code}
                onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
            </div>
            <Button disabled={busy || code.length !== 6 || !email.trim()} className={buttonClass}>{busy ? 'Please wait…' : 'Verify recovery code'}</Button>
          </form>
          <div className="mt-5 text-center text-xs text-slate-500">
            Didn't receive a code?{' '}
            <button type="button" onClick={() => void resend()} disabled={busy || resendWait > 0 || !email.trim()} className="font-semibold text-[#800000] disabled:text-slate-400">
              {resendWait > 0 ? `Resend code in ${resendWait}s` : 'Resend recovery code'}
            </button>
          </div>
        </>}

        {stage === 'authenticator' && <form className="space-y-4" onSubmit={event => {
          event.preventDefault();
          void run(async () => {
            if (!client.current || !factor) return;
            const { error } = await client.current.auth.mfa.challengeAndVerify({ factorId: factor, code });
            if (error) throw new Error('The authenticator code was not accepted. Enter the current code from your app.');
            if (alive.current) setStage('password');
          });
        }}>
          <div className="space-y-2">
            <Label htmlFor="recovery-authenticator-code">Authenticator code</Label>
            <Input id="recovery-authenticator-code" placeholder="Enter your authenticator code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required disabled={busy} value={code}
              onChange={event => setCode(event.target.value.replace(/\D/g, '').slice(0, 6))} />
          </div>
          <Button disabled={busy || code.length !== 6} className={buttonClass}>{busy ? 'Verifying…' : 'Verify Authenticator'}</Button>
          <p className="text-xs text-slate-500">If you have lost your authenticator, contact your coordinator for account recovery.</p>
        </form>}

        {stage === 'saved' ? <Button type="button" disabled={busy} onClick={() => void continueToDashboard()} className={buttonClass}>{busy ? 'Opening dashboard…' : 'Continue to dashboard'}</Button>
          : <div className="mt-6 border-t border-slate-200 pt-4 text-center">
            <Link className={`text-xs font-semibold text-[#800000] ${busy ? 'pointer-events-none' : ''}`} aria-disabled={busy} to="/forgot-password">Request a new recovery code</Link>
          </div>}
      </section>
    </main>
  </div>;
}
