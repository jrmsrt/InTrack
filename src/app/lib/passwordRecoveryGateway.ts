import type { SupabaseClient } from '@supabase/supabase-js';
import { requestPasswordRecovery, saveRecoveredPassword } from './passwordRecovery.ts';
import { normalizeOtpEmail } from './emailOtp.ts';
import { verifyLoginPassword, type LoginEmailLookup } from './passwordEmailLogin.ts';
import { createPasswordCheckClient, getSupabaseClient } from './supabaseClient.ts';

/** Requesting a code must not affect an existing application session. */
export async function sendRecoveryCode(email: string): Promise<string> {
  const client = createPasswordCheckClient();
  return requestPasswordRecovery(client.auth, async address => {
    const { data, error } = await client.rpc('intrack_password_recovery_status', { address });
    if (error || (data !== 'ready' && data !== 'activation_required' && data !== 'unavailable')) {
      throw new Error('Unable to check your account activation status. Please try again.');
    }
    return data;
  }, email);
}

async function transferRecoverySession(client: SupabaseClient, applicationClient: SupabaseClient): Promise<boolean> {
  try {
    const current = await client.auth.getSession();
    if (!current.error && current.data.session) {
      const adopted = await applicationClient.auth.setSession({ access_token: current.data.session.access_token, refresh_token: current.data.session.refresh_token });
      return !adopted.error;
    }
  } catch { /* Keep the recovery session so automatic sign-in can be retried. */ }
  return false;
}

/** Save and adopt the already-verified session without another login or code. */
export async function completeRecoveryPassword(client: SupabaseClient, password: string, confirmation: string, applicationClient: SupabaseClient = getSupabaseClient()): Promise<boolean> {
  let signedIn = false;
  await saveRecoveredPassword({
    mfa: client.auth.mfa,
    async updateUser(input) {
      let result;
      try {
        result = await client.functions.invoke('password-change-session', { body: { action: 'complete-recovery', password: input.password } });
      } catch {
        // Auth still enforces the verified session and MFA if the optional
        // carryover service cannot be reached. Never report a saved password as failed.
        return client.auth.updateUser(input);
      }
      if (result.error) {
        const response = result.error.context;
        const status = response instanceof Response ? response.status : undefined;
        if (status === 404 || (status !== undefined && status >= 500)
          || ['FunctionsFetchError', 'FunctionsRelayError'].includes(result.error.name)) {
          return client.auth.updateUser(input);
        }
        let code: string | undefined;
        if (response instanceof Response) {
          try { const body = await response.clone().json(); if (typeof body.code === 'string') code = body.code; } catch { /* Use the status when no structured error is available. */ }
        }
        return { error: { code, status } };
      }
      if (result.data?.changed !== true) return { error: { code: 'password_update_unavailable' } };
      signedIn = result.data.signedIn === true;
      return { error: null };
    },
  }, password, confirmation);
  return signedIn ? transferRecoverySession(client, applicationClient) : false;
}

/** Retry only session completion; never resubmit or change the saved password. */
export async function continueRecoverySignIn(client: SupabaseClient, applicationClient: SupabaseClient = getSupabaseClient()): Promise<boolean> {
  try {
    const result = await client.functions.invoke('password-change-session', { body: { action: 'finish-recovery' } });
    return !result.error && result.data?.signedIn === true ? transferRecoverySession(client, applicationClient) : false;
  } catch { return false; }
}

/** Browser state is only a hint. The server consumes a short-lived session receipt once. */
export async function resumePasswordChangeLogin(
  client: SupabaseClient, email: string, password: string, lookup?: LoginEmailLookup,
  createCheck: typeof createPasswordCheckClient = createPasswordCheckClient,
): Promise<boolean> {
  const address = normalizeOtpEmail(email);
  const current = await client.auth.getSession();
  if (current.error || current.data.session?.user.email?.toLowerCase() !== address) return false;
  const eligible = await client.rpc('intrack_can_resume_password_change');
  if (eligible.error || eligible.data !== true) return false;
  const check = createCheck();
  let resumed = false;
  await verifyLoginPassword(check.auth, address, password, lookup, async session => {
    if (!session || typeof session !== 'object' || !('access_token' in session) || typeof session.access_token !== 'string') return;
    const result = await client.functions.invoke('password-change-session', { body: { action: 'resume', passwordAccessToken: session.access_token } });
    resumed = !result.error && result.data?.resumed === true;
  });
  return resumed;
}
