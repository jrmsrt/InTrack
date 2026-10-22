import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Info } from 'lucide-react';
import { BrandedHeader } from '../../components/shared/BrandedHeader';
import { PrivacyConsentDialog } from '../../components/auth/PrivacyConsentDialog';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { requestPasswordEmailLogin } from '../../lib/passwordEmailLogin';
import { resumePasswordChangeLogin } from '../../lib/passwordRecoveryGateway';
import { readMyProtectedIdentity } from '../../lib/protectedIdentity';
import { destinationAfterEmailOtp } from '../../lib/firstLogin';
import { clearLoginChallenge, saveLoginChallenge } from '../../lib/loginChallenge';

export function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [privacyOpen, setPrivacyOpen] = useState(true);
  const [privacyRead, setPrivacyRead] = useState(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    clearLoginChallenge();
    for (const key of ['lastOtpPreview', 'pendingOtpVerification', 'verifiedOtpAccount', 'user', 'userRole']) {
      try { localStorage.removeItem(key); } catch {}
    }
    return () => { alive.current = false; };
  }, []);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    if (!privacyRead) { setPrivacyOpen(true); return; }
    pending.current = true; setBusy(true); setError('');
    try {
      const client = getSupabaseClient();
      const lookup = async (address: string) => {
        const { data, error } = await client.rpc('intrack_login_email_exists', { address });
        return error || typeof data !== 'boolean' ? null : data;
      };
      if (await resumePasswordChangeLogin(client, email, password, lookup)) {
        const identity = await readMyProtectedIdentity();
        if (alive.current) navigate(destinationAfterEmailOtp(identity), { replace: true });
        return;
      }
      const signedOut = await client.auth.signOut({ scope: 'local' });
      if (signedOut.error) throw new Error('Unable to start a new sign-in. Please retry.');
      const address = await requestPasswordEmailLogin(client.auth, email, password, lookup);
      if (!alive.current) return;
      saveLoginChallenge({ email: address, requestedAt: Date.now() });
      navigate('/verify-otp');
    } catch (cause) {
      if (alive.current) setError(cause instanceof Error ? cause.message : 'Unable to sign in. Please retry.');
    } finally { pending.current = false; if (alive.current) { setBusy(false); setPassword(''); } }
  }
  return <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
    <BrandedHeader />
    <div className="flex-1 flex flex-col items-center justify-center p-4 py-8">
      <Card className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="text-center px-6 pt-8 pb-3 gap-1">
          <CardTitle className="text-2xl font-bold text-slate-900">Welcome Back</CardTitle>
          <CardDescription className="text-xs text-slate-500">Sign in to continue to the OJT monitoring system.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          <form onSubmit={submit} className="space-y-5">
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 flex gap-2 text-xs text-red-700"><AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span></div>}
            <div className="space-y-1.5">
              <Label htmlFor="login-email" className="text-xs font-bold uppercase tracking-wider text-slate-500">PUP Webmail</Label>
              <Input id="login-email" type="email" placeholder="Enter your webmail" autoComplete="username" required maxLength={254} disabled={busy} value={email} onChange={event => { setEmail(event.target.value); setError(''); }}
                className="h-11 rounded-lg border-slate-200 bg-slate-50 px-3 text-sm focus-visible:border-[#800000] focus-visible:ring-[#800000]/20" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between"><Label htmlFor="login-password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</Label><Link to="/forgot-password" className="text-xs font-medium text-[#800000] hover:underline">Forgot Password?</Link></div>
              <div className="relative">
                <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your account password" autoComplete="current-password" required maxLength={256} disabled={busy} value={password} onChange={event => { setPassword(event.target.value); setError(''); }}
                  className="h-11 rounded-lg border-slate-200 bg-slate-50 px-3 pr-10 text-sm focus-visible:border-[#800000] focus-visible:ring-[#800000]/20" />
                <button type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} className="absolute inset-y-0 right-3 flex items-center text-slate-500" disabled={busy}>{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
              </div>
            </div>
            <Button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-[#800000] hover:bg-[#6b0000] text-sm font-bold text-white shadow-sm">{busy ? 'Logging in…' : 'Login'}</Button>
          </form>
          <div className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50/50 p-3 flex items-start gap-3 text-xs text-cyan-900">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-center leading-relaxed">Users must activate their account before first use.<br />Use your PUP Webmail and the default password provided by the administrator.</p>
          </div>
          <p className="mt-7 text-center text-[10px] leading-relaxed text-slate-400">By using this service, you understand and agree to the PUP Online Services <a href="https://www.pup.edu.ph/terms/" target="_blank" rel="noopener noreferrer" className="text-blue-700">Terms of Use</a> and <Link to="/privacy-notice" className="text-blue-700">Privacy Notice</Link>.</p>
        </CardContent>
      </Card>
    </div>
    <PrivacyConsentDialog open={privacyOpen} onOpenChange={setPrivacyOpen} onAccept={() => { setPrivacyRead(true); setPrivacyOpen(false); }} />
  </div>;
}
