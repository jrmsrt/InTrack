import type { ProtectedIdentity } from './protectedIdentity.ts';

/** Recovery never trusts a selected role or routes through default-password setup. */
export function destinationAfterRecovery(identity: ProtectedIdentity): string {
  if (identity.state !== 'ready') return '/account-access';
  if (identity.usableRoles.includes('coordinator')) return '/coordinator/dashboard';
  if (identity.usableRoles.includes('student')) return '/dashboard';
  if (identity.usableRoles.includes('adviser')) return '/adviser/dashboard';
  return '/account-access';
}
