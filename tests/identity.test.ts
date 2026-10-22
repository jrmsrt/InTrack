import test from 'node:test';
import assert from 'node:assert/strict';
import { identityGate, enrollmentAccess, canManageMembership, validateMasterlist as validateImport, type IdentityContext, type MasterlistRow } from '../src/app/domain/identity.ts';

// Synthetic configuration for these tests; deployment allowlists require confirmation.
const validateMasterlist = (rows: MasterlistRow[], programs: string[], existing: Pick<MasterlistRow, 'studentNumber' | 'email'>[] = []) =>
  validateImport(rows, programs, existing, ['iskolarngbayan.pup.edu.ph']);

function identity(role: 'student' | 'adviser' | 'coordinator'): IdentityContext {
  return { authUserId: 'auth-1', emailVerified: true, assurance: 'aal2', profile: { id: 'profile-1', authUserId: 'auth-1', status: 'active', activatedAt: '2026-10-08T00:00:00Z' }, memberships: [{ role, programId: 'bsit', active: true }] };
}
test('an Auth session alone cannot activate or provision an application account', () => {
  const user = identity('student');
  assert.deepEqual(identityGate({ ...user, profile: null }, 'student'), { allowed: false, reason: 'not_provisioned' });
  assert.deepEqual(identityGate({ ...user, profile: { ...user.profile!, authUserId: 'other' } }, 'student'), { allowed: false, reason: 'not_provisioned' });
  assert.deepEqual(identityGate({ ...user, profile: { ...user.profile!, status: 'invited' } }, 'student'), { allowed: false, reason: 'activate' });
});
test('suspension blocks already signed-in accounts and membership revocation removes role access', () => {
  const user = identity('student');
  assert.deepEqual(identityGate({ ...user, profile: { ...user.profile!, status: 'suspended' } }, 'student'), { allowed: false, reason: 'suspended' });
  assert.deepEqual(identityGate({ ...user, memberships: [] }, 'student'), { allowed: false, reason: 'role_unavailable' });
  assert.deepEqual(identityGate({ ...user, memberships: [{ role: 'student', programId: 'bsit', active: false }] }, 'student'), { allowed: false, reason: 'role_unavailable' });
});
test('role selection grants nothing and staff access requires MFA', () => {
  assert.equal(identityGate(identity('student'), 'coordinator').allowed, false);
  assert.equal(identityGate({ ...identity('student'), assurance: 'aal1' }, 'student').allowed, true);
  assert.deepEqual(identityGate({ ...identity('adviser'), assurance: 'aal1' }, 'adviser'), { allowed: false, reason: 'mfa_required' });
});
test('students use profile identity and advisers require current assignment in the permitted program', () => {
  const record = { programId: 'bsit', studentId: 'profile-1', currentAdviserId: 'profile-1' };
  assert.equal(enrollmentAccess(identity('student'), 'student', record).allowed, true);
  assert.equal(enrollmentAccess(identity('student'), 'student', { ...record, studentId: 'auth-1' }).allowed, false);
  assert.equal(enrollmentAccess(identity('adviser'), 'adviser', record).allowed, true);
  assert.equal(enrollmentAccess(identity('adviser'), 'adviser', { ...record, currentAdviserId: 'replacement' }).allowed, false);
  assert.equal(enrollmentAccess(identity('coordinator'), 'coordinator', { ...record, programId: 'bsoa' }).allowed, false);
});
test('coordinators cannot promote themselves, create coordinators, or change another program', () => {
  const user = identity('coordinator');
  assert.equal(canManageMembership(user, { profileId: 'other', role: 'student', programId: 'bsit' }), true);
  assert.equal(canManageMembership(user, { profileId: 'profile-1', role: 'adviser', programId: 'bsit' }), false);
  assert.equal(canManageMembership(user, { profileId: 'other', role: 'coordinator', programId: 'bsit' }), false);
  assert.equal(canManageMembership(user, { profileId: 'other', role: 'adviser', programId: 'bsoa' }), false);
});
test('masterlist normalization keeps names intact and rejects cross-program imports atomically', () => {
  const row = { studentNumber: ' 2023-00001-pq-0 ', email: ' Student@iskolarngbayan.pup.edu.ph ', name: ' Maria Dela Cruz ', programId: 'bsit', section: '4-1' };
  const result = validateMasterlist([row], ['bsit']);
  assert.equal(result.valid, true);
  assert.equal(result.rows[0].name, 'Maria Dela Cruz');
  assert.equal(result.rows[0].studentNumber, '2023-00001-PQ-0');
  assert.equal(result.rows[0].email, 'student@iskolarngbayan.pup.edu.ph');
  const denied = validateMasterlist([row, { ...row, studentNumber: 'different', email: 'other@iskolarngbayan.pup.edu.ph', programId: 'bsoa' }], ['bsit']);
  assert.equal(denied.valid, false);
  assert.deepEqual(denied.rows, []);
});
test('masterlist duplicates and conflicting identity mappings cannot silently replace accounts', () => {
  const row = { studentNumber: 'number-1', email: 'student@iskolarngbayan.pup.edu.ph', name: 'Student', programId: 'bsit', section: '4-1' };
  assert.equal(validateMasterlist([row, row], ['bsit']).valid, false);
  assert.equal(validateMasterlist([row], ['bsit'], [{ studentNumber: 'NUMBER-1', email: 'other@iskolarngbayan.pup.edu.ph' }]).valid, false);
  assert.equal(validateMasterlist([{ ...row, email: 'student@example.com' }], ['bsit']).valid, false);
  assert.equal(validateMasterlist([], ['bsit']).valid, false);
  assert.equal(validateMasterlist([row], ['bsit'], [{ studentNumber: 'NUMBER-1', email: row.email }]).valid, true);
});

test('imports fail closed until email domains are configured and reject lookalike domains', () => {
  const row = { studentNumber: 'number-1', email: 'student@iskolarngbayan.pup.edu.ph', name: 'Student', programId: 'bsit', section: '4-1' };
  assert.equal(validateImport([row], ['bsit']).valid, false);
  assert.equal(validateMasterlist([{ ...row, email: 'student@iskolarngbayan.pup.edu.ph.example.com' }], ['bsit']).valid, false);
});
