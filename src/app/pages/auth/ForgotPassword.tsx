import React, { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { BrandedHeader } from '../../components/shared/BrandedHeader';
import { sendRecoveryCode } from '../../lib/passwordRecoveryGateway';
import { AdaptiveCaptcha } from '../../components/auth/AdaptiveCaptcha';

const CAPTCHA_THRESHOLD = 2;

export function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [captchaVerified, setCaptchaVerified] = useState(false);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pending.current) return;

    if (failedAttempts >= CAPTCHA_THRESHOLD && !captchaVerified) {
      setError('Complete the security check before requesting another recovery code.');
      return;
    }

    pending.current = true; setBusy(true); setError('');
    try {
      const address = await sendRecoveryCode(email);
      navigate('/reset-password', { state: { recoveryEmail: address, requestedAt: Date.now() } });
    } catch (cause) {
      const nextAttempts = failedAttempts + 1;
      setFailedAttempts(nextAttempts);
      if (nextAttempts >= CAPTCHA_THRESHOLD) {
        setCaptchaVerified(false);
        setCaptchaResetKey((value) => value + 1);
      }
      setError(cause instanceof Error ? cause.message : 'Unable to request password recovery.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <BrandedHeader />
      
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-8">
        <div className="w-full max-w-[400px]">
          <Card className="gap-2 rounded-2xl border border-slate-200 bg-white shadow-sm">
            <CardHeader className="text-center px-6 pt-7 pb-2 gap-1">
              <CardTitle className="text-2xl font-bold leading-tight text-slate-900">Reset Password</CardTitle>
              <CardDescription className="text-xs text-slate-500">Enter your registered PUP Webmail to receive a six-digit recovery code.</CardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-6">
              <form onSubmit={handleSubmit} className="space-y-4">
                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 flex gap-2 text-xs text-red-700">
                      <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                      <span>{error}</span>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-slate-500">PUP Webmail</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your PUP Webmail address"
                      value={email}
                      disabled={busy}
                      onChange={(e) => { setEmail(e.target.value); setError(''); }}
                      className="h-10 rounded-lg border-slate-200 bg-slate-50 px-3 text-sm"
                      required
                    />
                  </div>
                  {failedAttempts >= CAPTCHA_THRESHOLD && (
                    <AdaptiveCaptcha onVerified={() => { setCaptchaVerified(true); setError(''); }} resetKey={captchaResetKey} />
                  )}
 
                  <Button type="submit" disabled={busy} className="h-11 w-full rounded-lg bg-[#800000] hover:bg-[#6b0000] text-sm font-bold text-white shadow-sm cursor-pointer transition-colors mt-2">
                    {busy ? 'Sending…' : 'Send recovery code'}
                  </Button>
 
                  <Link to="/login" className="block w-full">
                    <Button type="button" variant="ghost" className="h-9 w-full rounded-lg text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-slate-700">
                      <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
                      Back to Login
                    </Button>
                  </Link>
                </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
