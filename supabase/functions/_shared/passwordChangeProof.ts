import { hasOtpProof, hasPasswordProof } from './otpProof.ts';

function sessionClaims(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false;
  const claims = value as Record<string, unknown>;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return typeof claims.sub === 'string' && uuid.test(claims.sub)
    && typeof claims.session_id === 'string' && uuid.test(claims.session_id);
}

function recentMethod(claims: Record<string, unknown>, method: string, now: number, seconds: number): boolean {
  return Array.isArray(claims.amr) && claims.amr.some(item => item?.method === method
    && typeof item.timestamp === 'number' && Number.isFinite(item.timestamp)
    && item.timestamp <= now + 5 && item.timestamp >= now - seconds);
}

/** Inputs must already be signature/expiry verified by Auth getClaims(). */
export function hasRecentRecoveryProof(claims: unknown, now = Math.floor(Date.now() / 1000)): boolean {
  return sessionClaims(claims) && hasOtpProof(claims) && recentMethod(claims, 'otp', now, 900);
}

/** The database separately checks the recent change receipt and consumes it once. */
export function canResumePasswordChange(current: unknown, password: unknown, now = Math.floor(Date.now() / 1000)): boolean {
  return sessionClaims(current) && sessionClaims(password)
    && (hasOtpProof(current) || hasPasswordProof(current)) && hasPasswordProof(password)
    && current.sub === password.sub && current.session_id !== password.session_id
    && typeof password.iat === 'number' && Number.isFinite(password.iat)
    && password.iat <= now + 5 && password.iat >= now - 120
    && recentMethod(password, 'password', now, 120);
}
