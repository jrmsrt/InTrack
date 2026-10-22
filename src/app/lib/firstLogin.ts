import type { ProtectedIdentity } from './protectedIdentity.ts';

/** Called after Auth verifies the email code; never uses browser role/activation flags. */
export function destinationAfterEmailOtp(identity: ProtectedIdentity): '/password-decision' | '/account-access' | '/coordinator/dashboard' | '/verify-authenticator' | '/dashboard' | '/adviser/enrollment' {
  if (identity.state === 'mfa_required') return '/verify-authenticator';
  if (identity.state === 'ready' && identity.usableRoles.includes('coordinator')) return '/coordinator/dashboard';
  if (identity.state === 'ready' && identity.usableRoles.includes('adviser') && !identity.whitelisted) return '/adviser/enrollment';
  if (!('profile' in identity) || !identity.whitelisted || ['email_otp_required','password_login_required'].includes(identity.reason||'')) return '/account-access';
  return identity.passwordChangeSuggested || (identity.state === 'setup_required' && identity.reason === 'activation_required')
    ? '/password-decision' : identity.state==='ready'&&identity.usableRoles.includes('student') ? '/dashboard' : identity.state==='ready'&&identity.usableRoles.includes('adviser') ? '/adviser/enrollment' : '/account-access';
}
