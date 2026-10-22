import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../context/AuthContext';
import { AlertTriangle, CheckCircle2, Mail, Send, ShieldCheck } from 'lucide-react';
import { BrandedHeader } from '../../components/shared/BrandedHeader';

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  if (!name || !domain) return 'ju******@gmail.com';
  return `${name.slice(0, 2)}${'*'.repeat(Math.max(4, name.length - 2))}@${domain}`;
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <BrandedHeader />
      <div className="flex-1 flex flex-col items-center justify-center p-4 py-8">
        <div className="w-full max-w-2xl">
          {children}
        </div>
      </div>
    </div>
  );
}

function VerificationEmailPreview({ email }: { email: string }) {
  return (
    <Card className="mt-6 border-slate-200">
      <CardHeader>
        <CardTitle className="text-base font-semibold">Verification Email Preview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Subject: Verify Your InTrack - OJT Monitoring System Account</p>
          <div className="mt-4 rounded-lg bg-slate-50 p-4">
            <div className="flex items-center gap-2">
              <img 
                src="/pup-logo.png" 
                alt="PUP Logo" 
                className="h-8 w-8 object-contain"
              />
              <span className="font-semibold text-slate-900">InTrack - OJT Monitoring System</span>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mt-5">Welcome to InTrack - OJT Monitoring System</h3>
            <p className="text-sm text-slate-600 mt-2">
              Thank you for registering. Please verify your email address to activate your account.
            </p>
            <Button asChild className="mt-4 bg-[#800000] hover:bg-[#6b0000] text-white">
              <Link to={`/email-verified?email=${encodeURIComponent(email)}`}>Verify Email Address</Link>
            </Button>
            <p className="text-xs text-slate-500 mt-4">This verification link will expire in 24 hours.</p>
            <p className="text-xs text-slate-500 mt-1">
              If you did not create this account, you may safely ignore this email.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || 'juan.francisco@gmail.com';
  const { resendVerificationEmail } = useAuth();
  const [secondsLeft, setSecondsLeft] = useState(60);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [secondsLeft]);

  const handleResend = () => {
    resendVerificationEmail(email);
    setSecondsLeft(60);
  };

  return (
    <AuthShell>
      <Card className="shadow-xl rounded-xl border border-slate-200">
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-red-50 text-[#800000] flex items-center justify-center">
            <Mail className="h-10 w-10" />
          </div>
          <div className="mt-6 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
            Registration successful. A verification email has been sent automatically.
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 mt-6">Verify Your Email Address</h1>
          <p className="text-slate-600 mt-3">
            We’ve sent a verification link to your email address. Please check your inbox and click the verification
            link to activate your account.
          </p>
          <div className="mt-4 inline-flex rounded-full bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700">
            {maskEmail(email)}
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button className="bg-[#800000] hover:bg-[#6b0000] text-white gap-2">
              <Mail className="h-4 w-4" />
              Open Email App
            </Button>
            <Button variant="outline" disabled={secondsLeft > 0} onClick={handleResend} className="gap-2">
              <Send className="h-4 w-4" />
              Resend Email
            </Button>
            <Button asChild variant="outline">
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>

          {secondsLeft > 0 && (
            <p className="text-sm text-slate-500 mt-4">You can resend the email in {secondsLeft} seconds.</p>
          )}

          <div className="mt-6 text-sm text-slate-500 space-y-1">
            <p>Didn’t receive the email? Check your spam or junk folder.</p>
            <p>Make sure you entered the correct email address.</p>
          </div>
        </CardContent>
      </Card>

      <VerificationEmailPreview email={email} />
    </AuthShell>
  );
}

export function EmailVerifiedSuccess() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const { verifyEmail } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (email) verifyEmail(email);
  }, [email, verifyEmail]);

  return (
    <AuthShell>
      <Card className="shadow-xl rounded-xl overflow-hidden border border-slate-200">
        <CardContent className="p-8 text-center relative">
          <div className="absolute inset-x-0 top-0 h-1 bg-green-500" />
          <div className="mx-auto h-24 w-24 rounded-full bg-green-100 text-green-700 flex items-center justify-center animate-pulse">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 mt-6">Email Successfully Verified</h1>
          <p className="text-slate-600 mt-3">
            Your account has been successfully activated. You may now log in to InTrack - OJT Monitoring System.
          </p>
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={() => navigate('/login')} className="bg-[#800000] hover:bg-[#6b0000] text-white">
              Proceed to Login
            </Button>
            <Button asChild variant="outline">
              <Link to="/">Return to Homepage</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}

export function VerificationExpired() {
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') || '';
  const { resendVerificationEmail } = useAuth();
  const [sent, setSent] = useState(false);
  const resendTarget = useMemo(() => email || 'your registered email', [email]);

  const handleResend = () => {
    if (email) resendVerificationEmail(email);
    setSent(true);
  };

  return (
    <AuthShell>
      <Card className="shadow-xl rounded-xl border border-slate-200">
        <CardContent className="p-8 text-center">
          <div className="mx-auto h-20 w-20 rounded-full bg-red-100 text-red-700 flex items-center justify-center">
            <AlertTriangle className="h-10 w-10" />
          </div>
          <h1 className="text-3xl font-semibold text-slate-900 mt-6">Verification Link Expired</h1>
          <p className="text-slate-600 mt-3">This verification link is invalid or has expired.</p>
          {sent && (
            <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700 flex justify-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              A new verification email was sent to {resendTarget}.
            </div>
          )}
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button onClick={handleResend} className="bg-[#800000] hover:bg-[#6b0000] text-white">
              Resend Verification Email
            </Button>
            <Button asChild variant="outline">
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </AuthShell>
  );
}
