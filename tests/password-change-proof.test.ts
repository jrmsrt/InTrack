import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canResumePasswordChange, hasRecentRecoveryProof } from '../supabase/functions/_shared/passwordChangeProof.ts';

const current = { sub: '11111111-1111-4111-8111-111111111111', session_id: '22222222-2222-4222-8222-222222222222', aal: 'aal2', iat: 1000, amr: [{ method: 'otp', timestamp: 1000 }, { method: 'totp', timestamp: 1001 }] };
const password = { ...current, session_id: '33333333-3333-4333-8333-333333333333', iat: 1010, amr: [{ method: 'password', timestamp: 1010 }] };

test('recovery completion requires a recent real OTP method, never user metadata', () => {
  assert.equal(hasRecentRecoveryProof(current, 1015), true);
  assert.equal(hasRecentRecoveryProof({ ...current, amr: [{ method: 'password', timestamp: 1000 }] }, 1015), false);
  assert.equal(hasRecentRecoveryProof({ ...current, amr: [], user_metadata: current }, 1015), false);
  assert.equal(hasRecentRecoveryProof(current, 2000), false);
  assert.equal(hasRecentRecoveryProof({ ...current, session_id: 'forged' }, 1015), false);
});

test('resume binds a fresh password proof to the same user and a different verified session', () => {
  assert.equal(canResumePasswordChange(current, password, 1015), true);
  assert.equal(canResumePasswordChange({ ...current, amr: [{ method: 'password', timestamp: 1000 }] }, password, 1015), true);
  for (const invalid of [
    { ...password, sub: '44444444-4444-4444-8444-444444444444' },
    { ...password, session_id: current.session_id },
    { ...password, iat: 1 },
    { ...password, iat: 2000 },
    { ...password, amr: [{ method: 'password', timestamp: 1 }] },
    { ...password, amr: [{ method: 'otp', timestamp: 1010 }] },
    { ...password, amr: [], user_metadata: password },
  ]) assert.equal(canResumePasswordChange(current, invalid, 1015), false);
});
