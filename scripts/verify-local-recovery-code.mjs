// Local Auth acceptance without sending mail or touching an existing account.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { openPasswordRecovery, saveRecoveredPassword } from '../src/app/lib/passwordRecovery.ts';
import { createSupabaseApiFetch } from '../src/app/lib/supabaseApiFetch.ts';

const url = new URL(process.env.INTRACK_OPERATOR_SUPABASE_URL || 'http://invalid');
if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '54321') {
  throw new Error('Only local Supabase on port 54321 is supported.');
}
const key = process.env.INTRACK_OPERATOR_SECRET_KEY;
if (!key) throw new Error('Load the local operator environment before running this check.');
const browserKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!browserKey) throw new Error('Load the browser environment before running this check.');
const options = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } };
const admin = createClient(url.origin, key, options);
const client = createClient(url.origin, browserKey, { ...options, global: { fetch: createSupabaseApiFetch(browserKey) } });
const email = `recovery-code-${randomUUID()}@example.test`;
const password = `Test-${randomUUID()}!`;
const nextPassword = `Reset-${randomUUID()}!`;
let subject;
let phase = 'create synthetic account';
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Synthetic account creation failed.');
  subject = created.data.user.id;
  phase = 'generate a recovery code without sending mail';
  const generated = await admin.auth.admin.generateLink({ type: 'recovery', email });
  const code = generated.data.properties?.email_otp;
  if (generated.error || !code || !/^\d{6}$/.test(code)) throw new Error('Recovery code generation failed.');

  phase = 'reject an incorrect recovery code';
  const wrong = `${code[0] === '0' ? '1' : '0'}${code.slice(1)}`;
  await assert.rejects(() => openPasswordRecovery(client.auth, email, wrong), /incorrect, expired, or already used/);
  phase = 'verify recovery code and save new password';
  assert.equal(await openPasswordRecovery(client.auth, email, code), null);
  await saveRecoveredPassword(client.auth, nextPassword, nextPassword);
  await client.auth.signOut({ scope: 'local' });
  assert.equal((await client.auth.getSession()).data.session, null);

  phase = 'reject code reuse';
  await assert.rejects(() => openPasswordRecovery(client.auth, email, code), /incorrect, expired, or already used/);
  phase = 'check the saved password';
  const signedIn = await client.auth.signInWithPassword({ email, password: nextPassword });
  assert.equal(signedIn.error, null);
  assert.equal(signedIn.data.user?.id, subject);
  console.log('Local Auth passed: wrong codes rejected, recovery code verified, password saved, recovery session signed out, code reuse rejected, and new password accepted. No email was sent.');
} catch {
  console.error(`Local recovery-code check failed during: ${phase}. Credentials were withheld.`);
  process.exitCode = 1;
} finally {
  await client.auth.signOut({ scope: 'local' });
  if (subject) {
    const deleted = await admin.auth.admin.deleteUser(subject);
    if (deleted.error) { console.error('Synthetic account cleanup failed.'); process.exitCode = 1; }
    else console.log('Synthetic recovery account removed.');
  }
}
