import { welcomeName } from '../../lib/welcomeName';
import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { BrandedHeader } from '../../components/shared/BrandedHeader';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { useProtectedIdentity } from '../../context/useProtectedIdentity';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { clearLoginChallenge } from '../../lib/loginChallenge';
import { clearBackendDrafts } from '../../lib/backendDrafts';
import { readablePrivacyNotice, privacyNoticeUrl } from '../../lib/privacy';

export function AccountAccess() {
  const { result, refresh } = useProtectedIdentity(true);
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [password, setPassword] = useState('');
  const identity = result.state === 'loaded' ? result.identity : null;
  const notice = identity && 'privacy' in identity ? identity.privacy.currentVersion : null;
  // Never acknowledge a database version while displaying different notice text.
  const readableNotice = readablePrivacyNotice(notice);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError('');
    try { await action(); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to complete this action. Please retry.'); }
    finally { setBusy(false); setPassword(''); }
  }
  if(identity?.state==='mfa_required')return <Navigate to="/verify-authenticator" replace state={location.state}/>;
  if (result.state === 'signed_out') return <Navigate to="/login" replace />;
  // Only the server's ready projection can enter the portal. MFA-required
  // identities remain below until their authenticator challenge is verified.
  if (identity?.state === 'ready' && identity.usableRoles.includes('coordinator')) return <Navigate to="/coordinator/dashboard" replace />;
  if(identity?.state==='ready'&&identity.usableRoles.includes('student'))return <Navigate to="/dashboard" replace/>;
  if(identity?.state==='ready'&&identity.usableRoles.includes('adviser'))return <Navigate to="/adviser/enrollment" replace/>;
  if(identity?.state==='setup_required'&&identity.reason==='activation_required'&&identity.whitelisted)return <Navigate to="/password-decision" replace state={location.state}/>;
  return <div className="min-h-screen bg-slate-50"><BrandedHeader /><main className="mx-auto max-w-xl p-6 sm:py-12">
    <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
      <h1 className="text-2xl font-bold text-slate-900">Your InTrack account</h1>
      {result.state === 'loading' && <p role="status">Checking account access…</p>}
      {result.state === 'unavailable' && <><p role="alert">We could not check your account access.</p><Button onClick={() => void refresh()}>Retry</Button></>}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      {identity && !('profile' in identity) && <p>Your account is unavailable or has not been registered for InTrack. Contact your coordinator.</p>}
      {identity && 'profile' in identity && <p>Welcome, {welcomeName(identity.profile.displayName)}.</p>}
      {identity?.state==='setup_required'&&['email_otp_required','password_login_required'].includes(identity.reason||'')&&<p>Complete password sign-in and email verification before continuing. <Link className="underline" to="/login">Return to login</Link></p>}
      {identity?.state === 'setup_required' && !['email_otp_required','password_login_required'].includes(identity.reason||'') && <>
        <p>{readableNotice ? 'Complete the required account setup to continue.' : 'Account setup is awaiting the current privacy notice. Contact your coordinator.'}</p>
        {readableNotice && notice && <form className="space-y-4" onSubmit={event => { event.preventDefault(); void run(async () => {
          if (!accepted) throw new Error('Read and acknowledge the current notice first.');
          const client = getSupabaseClient();
          if (identity.reason === 'activation_required') {
            const { data, error } = await client.functions.invoke('activate-account', { body: { password, noticeVersion: notice, acceptNotice: true } });
            if (error || !data?.activated) throw new Error('Unable to activate your account. Contact your coordinator if this continues.');
          } else if (identity.reason === 'notice_acknowledgment_required') {
            const { error } = await client.rpc('intrack_acknowledge_notice', { notice_version: notice });
            if (error) throw new Error('The notice could not be acknowledged. Refresh and retry.');
          } else throw new Error('Your coordinator must complete the remaining account setup.');
          setAccepted(false); await refresh();
        }); }}>
          <p className="text-sm">Current notice version: {notice}. <Link className="text-[#800000] underline" to={privacyNoticeUrl(notice)}>Read notice</Link></p>
          <label className="block text-sm"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} disabled={busy} /> I have read and acknowledge the current notice.</label>
          {identity.reason === 'activation_required' && <label className="block text-sm">Choose your account password<Input type="password" required autoComplete="new-password" minLength={12} maxLength={256} value={password} disabled={busy} onChange={event => setPassword(event.target.value)} /><span>Use at least 12 characters.</span></label>}
          <Button disabled={busy || !accepted} className="bg-[#800000] text-white">Complete setup</Button>
        </form>}
      </>}
      {identity?.state === 'ready' && <div className="space-y-3"><p className="text-green-800">Your account is verified and account access is ready.</p>
        <p className="text-sm text-slate-600">Your OJT portal is still being connected to saved records. Account verification does not open the prototype dashboard.</p>
        {import.meta.env.DEV && <a className="block text-[#800000] underline" href="/?requirementsTest=1">Open saved requirements workspace</a>}
        {identity.usableRoles.includes('coordinator') && <><Link className="block text-[#800000] underline" to="/coordinator/students">Student Management</Link><Link className="block text-[#800000] underline" to="/coordinator/advisers">Adviser Management</Link></>}
      </div>}
      <Button variant="outline" disabled={busy} onClick={() => void run(async () => {
        const { error } = await getSupabaseClient().auth.signOut({ scope: 'local' });
        if (error) throw new Error('Unable to sign out. Please retry.');
        clearLoginChallenge(); clearBackendDrafts(); navigate('/login', { replace: true });
      })}>Sign out</Button>
    </section>
  </main></div>;
}
