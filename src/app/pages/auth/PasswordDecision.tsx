import React, { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Check, Info, KeyRound } from 'lucide-react';
import { useProtectedIdentity } from '../../context/useProtectedIdentity';
import { completePasswordDecision } from '../../lib/passwordDecision';
import { readablePrivacyNotice, privacyNoticeUrl, LOCAL_TEST_NOTICE_VERSION } from '../../lib/privacy';
import { BrandedHeader } from '../../components/shared/BrandedHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

export function PasswordDecision() {
  const navigate = useNavigate();
  const location=useLocation();
  const {result}=useProtectedIdentity(true);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const identity=result.state==='loaded'?result.identity:null;
  const notice=identity&&'privacy' in identity?identity.privacy.currentVersion:null;
  const [accept,setAccept]=useState(false);
  if(result.state==='loaded'&&result.identity.state==='mfa_required')return <Navigate to="/verify-authenticator" replace state={location.state}/>;
  if(result.state==='signed_out')return <Navigate to="/login" replace/>;
  if(identity&&(!('whitelisted' in identity)||!identity.whitelisted||['email_otp_required','password_login_required'].includes(identity.reason||'')))return <Navigate to="/account-access" replace/>;

  const handleLater = async () => {
    if(busy||!accept)return;
    setBusy(true);setError('');
    try{await completePasswordDecision(notice,'keep');navigate('/account-access',{replace:true,state:location.state});}
    catch(cause){setError(cause instanceof Error?cause.message:'Unable to activate your account.');}
    finally{setBusy(false);}
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <BrandedHeader />
      <div className="flex-1 flex items-center justify-center p-6">
        <Card className="w-full max-w-[420px] rounded-2xl border border-slate-200 bg-white text-center shadow-sm">
          <CardHeader className="px-6 pt-7 pb-3 gap-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#1d9257] text-white shadow-[0_0_20px_rgba(29,146,87,0.25)]">
              <Check className="h-7 w-7 stroke-[4]" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl font-bold leading-tight text-slate-900">Account Verified</CardTitle>
              <CardDescription className="text-xs text-slate-500 leading-normal">
                Your account has been successfully verified.<br />
                <span className="font-semibold text-slate-700">Would you like to change your password now?</span>
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {result.state==='loading'&&<p role="status">Checking your verified account…</p>}
            {result.state==='unavailable'&&<p role="alert">Unable to check account access. Refresh and retry.</p>}
            {error&&<p role="alert" className="mb-4 text-xs text-red-700">{error}</p>}
            {!readablePrivacyNotice(notice)&&<p role="alert" className="mb-4 text-xs text-red-700">Your coordinator must make the current privacy notice available before activation.</p>}
            {notice===LOCAL_TEST_NOTICE_VERSION&&<p className="mb-4 text-xs text-slate-500">This activation uses the local development notice, not an approved university deployment notice.</p>}
            <div className="mb-4 flex gap-2 rounded-lg border border-[#73d7ed] bg-[#ccf5ff]/50 px-3.5 py-2.5 text-left text-xs leading-normal text-[#075569]">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 fill-[#075569] text-white" />
              <span>You are currently using the temporary default password. Changing it now ensures your account remains secure.</span>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="mb-2 text-left text-xs text-slate-600"><input type="checkbox" checked={accept} disabled={busy} onChange={event=>setAccept(event.target.checked)}/> I have read the <Link to={privacyNoticeUrl(notice)} target="_blank" className="text-[#800000] underline">current privacy notice</Link> and acknowledge it for account activation.</label>
              <Button
                type="button"
                disabled={busy||!identity||!accept||!readablePrivacyNotice(notice)}
                onClick={() => navigate('/change-password',{state:location.state})}
                className="h-11 w-full rounded-lg bg-[#800000] hover:bg-[#6b0000] text-sm font-bold text-white shadow-sm cursor-pointer transition-colors"
              >
                <KeyRound className="h-4 w-4 fill-white shrink-0" />
                Change Password Now
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleLater}
                disabled={busy||!identity||!accept||!readablePrivacyNotice(notice)}
                className="h-11 w-full rounded-lg border-slate-200 bg-white text-sm font-bold text-slate-700 hover:bg-slate-50 cursor-pointer transition-colors"
              >
                Do It Later
              </Button>
            </div>

            <p className="mt-6 text-center text-[10px] leading-relaxed text-slate-400">
              If you choose to do it later, you will be prompted to change it again next time you log in.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
