import React, { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, CheckCircle2, Eye, EyeOff, XCircle } from 'lucide-react';
import { BrandedHeader } from '../shared/BrandedHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';

const passwordRules = [
  { label: 'At least 12 characters', test: (value: string) => value.length >= 12 && value.length <= 256 },
  { label: 'At least 1 uppercase letter (A-Z)', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'At least 1 lowercase letter (a-z)', test: (value: string) => /[a-z]/.test(value) },
  { label: 'At least 1 number (0-9)', test: (value: string) => /\d/.test(value) },
  { label: 'At least 1 special character (e.g., @, #, $, %, etc.)', test: (value: string) => /[^A-Za-z0-9]/.test(value) },
];

type PasswordChangePageProps = {
  onSubmit: (password: string, confirmation: string) => Promise<void>;
  ready?: boolean;
  cancelTo?: string;
};

/** Shared page for the verified default-password decision and recovery flows. */
export function PasswordChangePage({ onSubmit, ready = true, cancelTo = '/login' }: PasswordChangePageProps) {
  const [busy, setBusy] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const ruleResults = useMemo(() => passwordRules.map(rule => ({ ...rule, passed: rule.test(newPassword) })), [newPassword]);
  const passwordsMatch = Boolean(confirmPassword) && newPassword === confirmPassword;
  const canSubmit = ruleResults.every(rule => rule.passed) && passwordsMatch;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !ready || pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await onSubmit(newPassword, confirmPassword); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to change your password.'); }
    finally { pending.current = false; setBusy(false); setNewPassword(''); setConfirmPassword(''); }
  }

  const renderPasswordInput = (
    id: string, value: string, onChange: (value: string) => void,
    showValue: boolean, setShowValue: (value: boolean) => void,
    placeholder: string, hasError = false,
  ) => <div className="relative">
    <Input id={id} required disabled={busy} maxLength={256} autoComplete="new-password"
      type={showValue ? 'text' : 'password'} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder}
      className={`h-10 rounded-lg bg-slate-50 px-3 pr-10 text-sm text-slate-950 placeholder:text-slate-400 focus-visible:ring-[#800000]/25 ${hasError ? 'border-[#b00000] shadow-[0_0_12px_rgba(176,0,0,0.18)] focus-visible:ring-[#b00000]' : 'border-[#d9e1ec]'}`} />
    <button type="button" disabled={busy} onClick={() => setShowValue(!showValue)}
      aria-label={`${showValue ? 'Hide' : 'Show'} ${id === 'new-password' ? 'new password' : 'password confirmation'}`} aria-pressed={showValue}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-[#800000] focus:outline-none">
      {showValue ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  </div>;

  return <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
    <BrandedHeader />
    <div className="flex-1 flex items-center justify-center p-6">
      <Card className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white shadow-sm">
        <CardHeader className="text-center px-6 pt-7 pb-3 gap-1">
          <CardTitle className="text-2xl font-bold leading-tight text-slate-900">Change Password</CardTitle>
          <CardDescription className="text-xs text-slate-500">Update your password to secure your account.</CardDescription>
        </CardHeader>
        <CardContent className="px-6 pb-6">
          {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 flex gap-2 text-xs text-red-700">
            <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" /><span>{error}</span>
          </div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="new-password" className="text-xs font-bold uppercase tracking-wider text-slate-500">New Password</Label>
              {renderPasswordInput('new-password', newPassword, setNewPassword, showPassword, setShowPassword, 'Enter new password', Boolean(newPassword) && !ruleResults.every(rule => rule.passed))}
            </div>
            <div className="rounded-lg border-0 bg-[#f6f7f9] px-3.5 py-2.5">
              <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#20242c]">Password Requirements:</p>
              <ul className="space-y-1 text-xs">
                {ruleResults.map(rule => <li key={rule.label} className={`flex items-center gap-1.5 ${rule.passed ? 'text-[#008a4b]' : 'text-[#f12b3d]'}`}>
                  {rule.passed ? <CheckCircle2 className="h-3.5 w-3.5 fill-[#008a4b] text-white" /> : <XCircle className="h-3.5 w-3.5 fill-[#f12b3d] text-white" />}
                  {rule.label}
                </li>)}
              </ul>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-password" className="text-xs font-bold uppercase tracking-wider text-slate-500">Confirm New Password</Label>
              {renderPasswordInput('confirm-password', confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword, 'Confirm new password')}
              {confirmPassword && !passwordsMatch && <p className="text-xs text-red-700">Passwords should match.</p>}
            </div>
            <Button type="submit" disabled={!canSubmit || busy || !ready}
              className="h-11 w-full rounded-lg bg-[#800000] hover:bg-[#6b0000] text-sm font-bold text-white shadow-sm cursor-pointer disabled:cursor-not-allowed disabled:bg-[#b55a5d] disabled:text-slate-200 transition-colors mt-2">
              {busy ? 'Updating…' : 'Update Password'}
            </Button>
          </form>
          <div className="mt-5 border-t border-slate-200 pt-4 text-center">
            <Link to={cancelTo} aria-disabled={busy} className={`inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#800000] ${busy ? 'pointer-events-none' : ''}`}>
              <ArrowLeft className="h-3.5 w-3.5" />Cancel
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>;
}
