import { normalizeOtpEmail } from './emailOtp.ts';
export type LoginChallenge = { email: string; requestedAt: number };
export const LOGIN_CHALLENGE_KEY = 'intrack-email-login';
/** Navigation metadata only; cannot prove authentication or account permissions. */
export function parseLoginChallenge(raw: string | null, now = Date.now()): LoginChallenge | null {
  try {
    const value = JSON.parse(raw || 'null');
    if (!value || !Number.isFinite(value.requestedAt) || value.requestedAt > now + 5000
      || now - value.requestedAt > 86400000) return null;
    return { email: normalizeOtpEmail(value.email), requestedAt: value.requestedAt };
  } catch { return null; }
}
export function readLoginChallenge(): LoginChallenge | null {
  try { return parseLoginChallenge(sessionStorage.getItem(LOGIN_CHALLENGE_KEY)); } catch { return null; }
}
export function saveLoginChallenge(value: LoginChallenge) {
  sessionStorage.setItem(LOGIN_CHALLENGE_KEY, JSON.stringify({ email: value.email, requestedAt: value.requestedAt }));
}
export function clearLoginChallenge() {
  try { sessionStorage.removeItem(LOGIN_CHALLENGE_KEY); } catch {}
}
