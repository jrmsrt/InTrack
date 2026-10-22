import test from 'node:test';
import assert from 'node:assert/strict';
import { decideRequirement, moaRoutingBlockers, type RequirementSnapshot, type RequirementAction, type MoaRoutingSnapshot } from '../src/app/domain/requirements.ts';
import type { IdentityContext } from '../src/app/domain/identity.ts';
import type { Role } from '../src/app/domain/contracts.ts';

function identity(role: Role): IdentityContext {
  const id = role === 'student' ? 'student' : role;
  return { authUserId: `auth-${id}`, emailVerified: true, assurance: 'aal2', profile: { id, authUserId: `auth-${id}`, status: 'active', activatedAt: '2026-10-10T00:00:00Z' }, memberships: [{ role, programId: 'it', active: true }] };
}
function snapshot(): RequirementSnapshot {
  return { requirementId: 'requirement', enrollment: { id: 'enrollment', studentId: 'student', programId: 'it', termId: 'term', policyVersionId: 'policy', component: 1, lifecycle: 'pre_ojt', clearance: 'not_issued', revision: 3, requiredMinutes: 30000, creditedMinutes: 0, outcome: 'active' }, currentAdviserId: 'adviser', definition: { id: 'requirement', policyVersionId: 'policy', published: true, reviewer: 'both', evidenceType: 'file', allowedSubmissionStages: ['pre_ojt', 'during_ojt'] }, submission: { id: 'submission', version: 1, revision: 2, status: 'submitted', submittedBy: 'student', submittedAt: '2026-10-10T00:00:00Z', latest: true, adviserApproved: false, coordinatorApproved: false, reviewStarted: false }, document: { id: 'document', requirementId: 'requirement', enrollmentId: 'enrollment', uploadedBy: 'student', status: 'validated', sha256: 'a'.repeat(64), bytes: 100, mimeType: 'application/pdf' }, verification: null };
}
const decide = (s: RequirementSnapshot, role: Role, action: RequirementAction, remarks = '') => decideRequirement(identity(role), role, s, action, 3, 2, remarks);

test('both review steps refer to one version and adviser approval alone cannot complete it', () => {
  const s = snapshot();
  assert.equal(decide(s, 'coordinator', 'approve').allowed, false);
  const first = decide(s, 'adviser', 'approve');
  assert.equal(first.nextStatus, 'under_review'); assert.equal(first.approvalStep, 'adviser');
  s.submission.status = 'under_review'; s.submission.adviserApproved = true;
  assert.equal(decide(s, 'adviser', 'approve').allowed, false);
  assert.equal(decide(s, 'coordinator', 'approve').nextStatus, 'approved');
});
test('review requires current assignment, staff MFA, correct role and no self-review', () => {
  const s = snapshot(); s.currentAdviserId = 'replacement';
  assert.equal(decide(s, 'adviser', 'approve').allowed, false);
  s.currentAdviserId = 'adviser';
  assert.equal(decideRequirement({ ...identity('adviser'), assurance: 'aal1' }, 'adviser', s, 'approve', 3, 2).allowed, false);
  assert.equal(decide(s, 'student', 'approve').allowed, false);
  s.submission.submittedBy = 'adviser'; assert.equal(decide(s, 'adviser', 'approve').allowed, false);
});
test('stale revisions, missing timestamp and historical versions cannot be reviewed', () => {
  const s = snapshot();
  assert.equal(decideRequirement(identity('adviser'), 'adviser', s, 'approve', 3, 1).allowed, false);
  s.submission.submittedAt = null; assert.equal(decide(s, 'adviser', 'approve').allowed, false);
  s.submission.submittedAt = '2026-10-10T00:00:00Z'; s.submission.latest = false;
  assert.equal(decide(s, 'adviser', 'approve').allowed, false);
});
test('invalid file bytes, foreign ownership and quarantined evidence cannot be submitted or approved', () => {
  const s = snapshot(); s.document!.status = 'quarantined';
  assert.equal(decide(s, 'adviser', 'approve').allowed, false);
  s.submission.status = 'draft'; assert.equal(decide(s, 'student', 'submit').allowed, false);
  s.document!.status = 'validated'; s.document!.enrollmentId = 'other';
  assert.equal(decide(s, 'student', 'submit').allowed, false);
  s.document!.enrollmentId = 'enrollment'; s.document!.bytes = 10485761;
  assert.equal(decide(s, 'student', 'submit').allowed, false);
  s.document!.bytes = 100; s.document!.requirementId = 'another-occurrence';
  assert.equal(decide(s, 'student', 'submit').allowed, false);
});
test('withdrawal ends when review starts; revision creates a fresh version without approvals', () => {
  const s = snapshot(); assert.equal(decide(s, 'student', 'withdraw').allowed, true);
  s.submission.reviewStarted = true; assert.equal(decide(s, 'student', 'withdraw').allowed, false);
  assert.equal(decide(s, 'student', 'create_revision').allowed, false);
  assert.equal(decide(s, 'adviser', 'request_revision').allowed, false);
  const revise = decide(s, 'adviser', 'request_revision', 'Please correct the document');
  assert.equal(revise.nextStatus, 'needs_revision'); assert.equal(revise.clearCurrentApprovals, true);
  s.submission.status = 'needs_revision';
  const fresh = decide(s, 'student', 'create_revision');
  assert.equal(fresh.createNewVersion, true); assert.equal(fresh.clearCurrentApprovals, true);
});
test('physical evidence is a staff record, never a replacement PDF or student assertion', () => {
  const s = snapshot(); s.definition.evidenceType = 'staff_verification'; s.document = null;
  assert.equal(decide(s, 'adviser', 'approve').allowed, false);
  assert.equal(decide(s, 'student', 'verify_evidence', 'I attended').allowed, false);
  assert.equal(decide(s, 'adviser', 'verify_evidence', 'Checked attendance register').allowed, true);
  s.verification = { submissionVersionId: 'submission', verifiedBy: 'adviser', verifiedAt: '2026-10-10T00:00:00Z', note: 'Checked register', authorized: true };
  assert.equal(decide(s, 'adviser', 'approve').allowed, true);
  s.verification.authorized = false; assert.equal(decide(s, 'adviser', 'approve').allowed, false);
  s.verification.authorized = true; s.verification.submissionVersionId = 'old-version';
  assert.equal(decide(s, 'adviser', 'approve').allowed, false);
});

test('SAS routing requires notarization of the same copy and coordinator evidence', () => {
  const s: MoaRoutingSnapshot = { enrollment: snapshot().enrollment, currentAdviserId: 'adviser', currentStatus: 'SIGNED AND NOTARIZED', currentVersionId: 'moa-1', candidate: { versionId: 'moa-1', validated: true, notarizationConfirmed: true } };
  assert.deepEqual(moaRoutingBlockers(identity('coordinator'), s, 'SAS COPY SUBMITTED', 3, 'Delivered copy', 'SAS receipt recorded'), []);
  s.candidate!.versionId = 'moa-2';
  assert.notEqual(moaRoutingBlockers(identity('coordinator'), s, 'SAS COPY SUBMITTED', 3, 'Delivered', 'receipt').length, 0);
  s.candidate = null;
  assert.deepEqual(moaRoutingBlockers(identity('coordinator'), s, 'NO MOA', 3, 'No agreement available'), []);
  assert.notEqual(moaRoutingBlockers(identity('adviser'), s, 'NO MOA', 3, 'No agreement').length, 0);
});
test('specialized artifacts cannot gain approval through the generic file workflow', () => {
  const s = snapshot(); s.definition.evidenceType = 'moa'; s.definition.reviewer = 'coordinator';
  assert.equal(decide(s, 'coordinator', 'approve').allowed, false);
  s.definition.evidenceType = 'dtr'; assert.equal(decide(s, 'adviser', 'approve').allowed, false);
});
test('revocation requires coordinator authority and reason; completed work must reopen', () => {
  const s = snapshot(); s.submission.status = 'approved'; s.submission.adviserApproved = true; s.submission.coordinatorApproved = true;
  assert.equal(decide(s, 'adviser', 'revoke_approval', 'Incorrect approval').allowed, false);
  assert.equal(decide(s, 'coordinator', 'revoke_approval').allowed, false);
  assert.equal(decide(s, 'coordinator', 'revoke_approval', 'Evidence mismatch; reopen requirement').clearCurrentApprovals, true);
  s.enrollment.outcome = 'completed'; s.enrollment.lifecycle = 'completed';
  assert.equal(decide(s, 'coordinator', 'revoke_approval', 'Evidence mismatch').allowed, false);
});

test('unpublished or mismatched policies and closed submission stages deny student submission', () => {
  const s = snapshot(); s.submission.status = 'draft'; s.definition.published = false;
  assert.equal(decide(s, 'student', 'submit').allowed, false);
  s.definition.published = true; s.definition.policyVersionId = 'different-policy';
  assert.equal(decide(s, 'student', 'submit').allowed, false);
  s.definition.policyVersionId = 'policy'; s.enrollment.lifecycle = 'portfolio';
  assert.equal(decide(s, 'student', 'submit').allowed, false);
});


