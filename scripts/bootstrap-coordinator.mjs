import { createClient } from '@supabase/supabase-js';
import { parseArgs } from 'node:util';
import { createSupabaseApiFetch } from '../src/app/lib/supabaseApiFetch.ts';

// Run from the operator's terminal, never from the browser or a public endpoint.
const { values } = parseArgs({ options: {
  email: { type: 'string' }, name: { type: 'string' }, programs: { type: 'string' },
  reason: { type: 'string' }, 'command-id': { type: 'string' },
  'reconcile-auth-user': { type: 'string' },
} });
const url = process.env.INTRACK_OPERATOR_SUPABASE_URL;
const key = process.env.INTRACK_OPERATOR_SECRET_KEY;
if (!url || !key) throw new Error('Set operator URL and secret key in .env.');
const target = new URL(url);
if (!['localhost', '127.0.0.1'].includes(target.hostname) || target.port !== '54321' || target.protocol !== 'http:') {
  throw new Error('This development bootstrap command only supports local Supabase on port 54321.');
}
if (!key.startsWith('sb_secret_')) {
  let role;
  try {
    if (key.split('.').length === 3) {
      role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8')).role;
    }
  } catch { /* Never include the operator credential in diagnostics. */ }
  if (role !== 'service_role') {
    console.error('Invalid operator API key. Set INTRACK_OPERATOR_SECRET_KEY to the local SERVICE_ROLE_KEY from npx supabase status -o env (or a local sb_secret_ API key). Do not use JWT_SECRET, an anon/publishable key, or a dashboard password.');
    process.exit(1);
  }
}
for (const field of ['email','name','programs','reason','command-id']) {
  if (!values[field]?.trim()) throw new Error(`Missing --${field}. Use the same command ID for retries.`);
}
const admin = createClient(url,key,{
  auth:{persistSession:false,autoRefreshToken:false},
  global:{fetch:createSupabaseApiFetch(key)},
});
const params = {
  command_id: values['command-id'], email: values.email.trim().toLowerCase(),
  display_name: values.name.trim(), program_codes: values.programs.split(',').map(v=>v.trim()), reason:values.reason.trim(),
};
try {
  const { data: reservation, error } = await admin.rpc('intrack_reserve_first_coordinator',params);
  if (error) throw new Error(`Reservation failed (${error.code}). ${error.message}`);
  if (reservation.authUserId) {
    console.log('Coordinator identity is already linked. Continue with the original invitation; this command does not resend it.');
    process.exit(0);
  }
  let authUserId = values['reconcile-auth-user'];
  if (reservation.reconciliationRequired && !authUserId) {
    throw new Error('An Auth account already exists for the reserved email. No invitation was resent. Verify its UUID in local Studio and re-run with --reconcile-auth-user plus that UUID and the original command parameters.');
  }
  if (!authUserId) {
    const { data, error: invitationError } = await admin.auth.admin.inviteUserByEmail(params.email, {
      redirectTo:'http://localhost:5173/?authSetup=1',
    });
    if (invitationError || !data.user) {
      throw new Error('Invitation could not be confirmed. The reservation is preserved. Check local Auth and Mailpit before retrying; reconcile an existing new Auth UUID explicitly rather than creating another account.');
    }
    authUserId = data.user.id;
  }
  const { error: linkError } = await admin.rpc('intrack_link_first_coordinator', {
    command_id: params.command_id, auth_user_id: authUserId,
    reconciliation_reason: values['reconcile-auth-user'] ? params.reason : null,
  });
  if (linkError) {
    console.error(`Link pending. Auth UUID: ${authUserId}. Re-run the same command with --reconcile-auth-user and this UUID after resolving the database error.`);
    throw new Error(`Link failed (${linkError.code}).`);
  }
  console.log('Coordinator invitation linked. Open local Mailpit at http://127.0.0.1:54324. Activation and staff MFA are still required.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Coordinator bootstrap failed.');
  process.exitCode=1;
}
