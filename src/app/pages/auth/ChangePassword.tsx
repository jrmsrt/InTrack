import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useProtectedIdentity } from '../../context/useProtectedIdentity';
import { completePasswordDecision } from '../../lib/passwordDecision';
import { PasswordChangePage } from '../../components/auth/PasswordChangePage';

export function ChangePassword() {
  const navigate = useNavigate();
  const location = useLocation();
  const { result } = useProtectedIdentity(true);

  if (result.state === 'loaded' && result.identity.state === 'mfa_required') return <Navigate to="/verify-authenticator" replace state={location.state} />;
  if (result.state === 'signed_out') return <Navigate to="/login" replace />;
  if (result.state === 'loaded' && (!('whitelisted' in result.identity) || !result.identity.whitelisted || ['email_otp_required', 'password_login_required'].includes(result.identity.reason || ''))) return <Navigate to="/account-access" replace />;

  return <PasswordChangePage ready={result.state === 'loaded'} onSubmit={async password => {
    if (result.state !== 'loaded' || !('privacy' in result.identity)) throw new Error('Unable to check your account. Please retry.');
    await completePasswordDecision(result.identity.privacy.currentVersion, 'change', password);
    navigate('/account-access', { replace: true, state: location.state });
  }} />;
}
