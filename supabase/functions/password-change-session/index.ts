import { createClient } from 'npm:@supabase/supabase-js@2';
import { boundedJson } from '../_shared/boundedJson.ts';
import { canResumePasswordChange, hasRecentRecoveryProof } from '../_shared/passwordChangeProof.ts';

const origins = (Deno.env.get('INTRACK_AUTH_ORIGINS') || 'http://localhost:5173,http://127.0.0.1:5173').split(',');
Deno.serve(async (request: Request) => {
  const origin = request.headers.get('Origin');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (origin && origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  const respond = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  if (origin && !origins.includes(origin)) return respond(403, { error: 'Origin denied' });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return respond(405, { error: 'POST required' });
  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return respond(401, { error: 'Verified session required.' });
  try {
    const url = Deno.env.get('SUPABASE_URL')!, key = Deno.env.get('SUPABASE_ANON_KEY')!;
    const verifier = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const claims = await verifier.auth.getClaims(authorization.slice(7));
    const identity = await verifier.auth.getUser(authorization.slice(7));
    if (claims.error || identity.error || !identity.data.user || claims.data?.claims.sub !== identity.data.user.id) {
      return respond(401, { code: 'session_expired', error: 'Verified session expired. Request a new recovery code.' });
    }
    const caller = createClient(url, key, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = await boundedJson(request, 20000);
    if (!body || typeof body !== 'object' || !('action' in body)) return respond(400, { error: 'Invalid request.' });
    const verified = claims.data!.claims;
    if (body.action === 'complete-recovery' || body.action === 'finish-recovery') {
      if (!hasRecentRecoveryProof(verified)) return respond(403, { code: 'recovery_verification_required', error: 'Verify a new recovery code first.' });
      const user = identity.data.user;
      if (user.factors?.some(factor => factor.status === 'verified') && verified.aal !== 'aal2') {
        return respond(403, { code: 'authenticator_required', error: 'Verify your authenticator before changing your password.' });
      }
      const eligible = await caller.rpc('intrack_password_recovery_status', { address: user.email });
      if (eligible.error) return respond(503, { error: 'Account verification is temporarily unavailable.' });
      if (eligible.data !== 'ready') return respond(403, { code: 'account_not_activated', error: 'An activated account is required for password recovery.' });
      if (body.action === 'finish-recovery') {
        const finished = await admin.rpc('intrack_finish_recovery_session', { subject: user.id, verified_session: verified.session_id });
        return respond(finished.error ? 503 : 200, { signedIn: !finished.error && finished.data === true });
      }
      const password = 'password' in body ? body.password : null;
      if (typeof password !== 'string' || password.length < 12 || password.length > 256
        || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        return respond(400, { error: 'Use 12–256 characters with uppercase, lowercase, a number and a special character.' });
      }
      const saved = await fetch(`${url}/auth/v1/user`, {
        method: 'PUT', headers: { Authorization: authorization, apikey: key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!saved.ok) {
        const failure = await saved.json().catch(() => ({}));
        const known = ['same_password', 'weak_password', 'insufficient_aal', 'session_not_found', 'session_expired', 'bad_jwt', 'jwt_expired', 'refresh_token_not_found'];
        return respond(saved.status, { code: known.includes(failure.code) ? failure.code : 'password_update_failed', error: 'Password update was not accepted.' });
      }
      let signedIn = false;
      try {
        const receipt = await admin.rpc('intrack_record_password_change', { subject: user.id, verified_session: verified.session_id });
        if (!receipt.error) {
          const finished = await admin.rpc('intrack_finish_recovery_session', { subject: user.id, verified_session: verified.session_id });
          signedIn = !finished.error && finished.data === true;
        }
      } catch { /* Saving succeeded even if the carryover service is unavailable. */ }
      return respond(200, { changed: true, signedIn });
    }
    if (body.action === 'resume') {
      if (!('passwordAccessToken' in body) || typeof body.passwordAccessToken !== 'string' || body.passwordAccessToken.length > 16000) {
        return respond(400, { error: 'Password verification required.' });
      }
      const password = await verifier.auth.getClaims(body.passwordAccessToken);
      if (password.error || !canResumePasswordChange(verified, password.data?.claims)) return respond(403, { error: 'Matching recent password verification required.' });
      const result = await admin.rpc('intrack_resume_password_change', {
        subject: verified.sub, verified_session: verified.session_id, password_session: password.data!.claims.session_id,
      });
      if (result.error) return respond(403, { error: 'Verified sign-in could not be resumed.' });
      return respond(200, { resumed: result.data === true });
    }
    return respond(400, { error: 'Invalid request.' });
  } catch { return respond(503, { error: 'Password verification unavailable. Please retry.' }); }
});
