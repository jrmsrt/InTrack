// Real local Auth/MFA/Edge/database acceptance. Only disposable synthetic data;
// no email is sent and no existing account's password or access is changed.
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseApiFetch } from '../src/app/lib/supabaseApiFetch.ts';
import { openPasswordRecovery } from '../src/app/lib/passwordRecovery.ts';
import { completeRecoveryPassword, continueRecoverySignIn } from '../src/app/lib/passwordRecoveryGateway.ts';
import { destinationAfterRecovery } from '../src/app/lib/recoveryDestination.ts';

const endpoint = new URL(process.env.INTRACK_OPERATOR_SUPABASE_URL || 'http://invalid');
if (endpoint.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(endpoint.hostname) || endpoint.port !== '54321') throw new Error('Only the local InTrack stack is supported.');
const key = process.env.INTRACK_OPERATOR_SECRET_KEY, publicKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!key || !publicKey) throw new Error('Load the local browser/operator environments.');
const browserTransport = (input, init) => {
  const headers = new Headers(init?.headers); headers.set('Origin', 'http://localhost:5173');
  return fetch(input, { ...init, headers });
};
const options = k => ({ global: { fetch: createSupabaseApiFetch(k, browserTransport) }, auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
const admin = createClient(endpoint.origin, key, options(key));
const recovery = createClient(endpoint.origin, publicKey, options(publicKey));
const application = createClient(endpoint.origin, publicKey, options(publicKey));
const password = createClient(endpoint.origin, publicKey, options(publicKey));
const second = createClient(endpoint.origin, publicKey, options(publicKey));
const docker = join(process.env.LOCALAPPDATA, 'Programs/DockerDesktop/resources/bin/docker.exe');
const sql = query => execFileSync(docker, ['exec', 'supabase_db_InTrack', 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function totp(secret) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let value = 0, bits = 0; const bytes = [];
  for (const char of secret.replace(/=/g, '').toUpperCase()) {
    const digit = alphabet.indexOf(char); if (digit < 0) throw new Error('Invalid synthetic authenticator secret.');
    value = (value << 5) | digit; bits += 5;
    if (bits >= 8) { bits -= 8; bytes.push((value >>> bits) & 255); }
  }
  const counter = Buffer.alloc(8); counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest(), offset = digest.at(-1) & 15;
  return String((digest.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, '0');
}

const email = `recent-change-${randomUUID()}@example.test`, profile = randomUUID();
const oldPassword = `Old-${randomUUID()}!`, newPassword = `New-${randomUUID()}!`;
let subject, phase = 'local Edge availability';
try {
  const available = await fetch(`${endpoint.origin}/functions/v1/password-change-session`, { method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(available.status, 401);
  phase = 'synthetic student creation';
  const created = await admin.auth.admin.createUser({ email, password: oldPassword, email_confirm: true });
  if (created.error || !created.data.user) throw new Error('Synthetic Auth creation failed.');
  subject = created.data.user.id;
  sql(`begin;
    insert into intrack.profiles(id,auth_user_id,display_name,status,activated_at) values('${profile}','${subject}','Synthetic recent-change student','active',now());
    insert into intrack.memberships(profile_id,program_id,role) select '${profile}',id,'student' from intrack.programs where code='BSIT';
    insert into intrack.privacy_acknowledgments(profile_id,notice_version) select '${profile}',current_notice_version from intrack.identity_configuration where singleton;
    commit;`);
  phase = 'synthetic authenticator enrollment';
  assert.equal((await recovery.auth.signInWithPassword({ email, password: oldPassword })).error, null);
  const enrolled = await recovery.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Synthetic recent-change verification' });
  if (enrolled.error) throw new Error('Synthetic MFA enrollment failed.');
  const factor = enrolled.data.id, secret = enrolled.data.totp.secret;
  assert.equal((await recovery.auth.mfa.challengeAndVerify({ factorId: factor, code: totp(secret) })).error, null);
  await recovery.auth.signOut({ scope: 'local' });

  phase = 'real recovery-code verification';
  const generated = await admin.auth.admin.generateLink({ type: 'recovery', email });
  if (generated.error) throw new Error('Synthetic recovery code generation failed.');
  assert.equal(await openPasswordRecovery(recovery.auth, email, generated.data.properties.email_otp), factor);
  phase = 'existing MFA proof during recovery';
  // Use a new time step so MFA replay protection is exercised correctly.
  await new Promise(resolve => setTimeout(resolve, 30000 - (Date.now() % 30000) + 1000));
  assert.equal((await recovery.auth.mfa.challengeAndVerify({ factorId: factor, code: totp(secret) })).error, null);
  phase = 'trusted password update and automatic sign-in';
  assert.equal(await completeRecoveryPassword(recovery, newPassword, newPassword, application), true);
  const identity = await application.rpc('intrack_get_my_identity');
  assert.equal(identity.error, null); assert.equal(identity.data.state, 'ready'); assert.deepEqual(identity.data.usableRoles, ['student']);
  assert.equal(destinationAfterRecovery(identity.data), '/dashboard');
  assert.equal((await application.rpc('intrack_can_resume_password_change')).data, false);
  phase = 'retry automatic continuation without changing the password';
  assert.equal(await continueRecoverySignIn(recovery,application),true);
  phase = 'protected dashboard profile access';
  const portal=await application.rpc('intrack_student_portal_profile');
  assert.equal(portal.error,null);assert.equal(portal.data.id,profile);
  phase = 'ordinary fresh sessions still require verification';
  assert.equal((await second.auth.signInWithPassword({ email, password: newPassword })).error, null);
  assert.equal((await second.rpc('intrack_get_my_identity')).data.reason, 'email_otp_required');
  console.log('Local acceptance passed: recovery and MFA verified once, password updated, automatically signed in with protected dashboard access and no further password or OTP entry. Ordinary fresh sessions still require verification. No email was sent.');
} catch {
  console.error(`Recent-password-change acceptance failed during ${phase}. Private details withheld.`); process.exitCode = 1;
} finally {
  for (const client of [recovery, application, password, second]) await client.auth.signOut({ scope: 'local' });
  if (subject) {
    try {
      sql(`begin; delete from intrack.privacy_acknowledgments where profile_id='${profile}'; delete from intrack.memberships where profile_id='${profile}'; delete from intrack.profiles where id='${profile}' and auth_user_id='${subject}'; commit;`);
      const removed = await admin.auth.admin.deleteUser(subject); if (removed.error) throw new Error('Synthetic cleanup failed.');
      console.log('Synthetic student, authenticator, sessions and profile removed.');
    } catch { console.error('Synthetic recent-change fixture cleanup failed.'); process.exitCode = 1; }
  }
}
