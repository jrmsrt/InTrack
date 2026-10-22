import test from 'node:test';
import assert from 'node:assert/strict';
import { decideLifecycle, type LifecycleSnapshot, type LifecycleAction } from '../src/app/domain/lifecycle.ts';
import type { IdentityContext } from '../src/app/domain/identity.ts';

const coordinator: IdentityContext = { authUserId: 'auth-c', emailVerified: true, assurance: 'aal2', profile: { id: 'coordinator', authUserId: 'auth-c', status: 'active', activatedAt: '2026-10-10T00:00:00Z' }, memberships: [{ role: 'coordinator', programId: 'it', active: true }] };
function snapshot(): LifecycleSnapshot {
  const approved = () => [{ approved: true, waiverAuthorized: false, waiverReason: '' }];
  return { enrollment: { id: 'enrollment', studentId: 'student', programId: 'it', termId: 'term', policyVersionId: 'policy', component: 1, lifecycle: 'pre_ojt', clearance: 'not_issued', revision: 4, requiredMinutes: 30000, creditedMinutes: 30000, outcome: 'active' }, currentAdviserId: 'adviser', policyConfirmed: true, placementId: 'placement', placementReady: true, acceptedMoa: { versionId: 'moa', status: 'SIGNED AND NOTARIZED' }, clearanceBasis: { placementId: 'placement', moaVersionId: 'moa' }, requirements: { pre: approved(), during: approved(), post: approved(), portfolio: approved() }, portfolioAdviserApproved: true, portfolioCoordinatorApproved: true, unresolvedDisputes: 0, openSessions: 0 };
}
const decide = (s: LifecycleSnapshot, action: LifecycleAction) => decideLifecycle(coordinator, s, action, 4, 'Reviewed evidence');

test('coordinator clearance starts training atomically; SAS acceptance is equally eligible', () => {
  const s = snapshot();
  assert.deepEqual(decide(s, 'issue_clearance').next, { lifecycle: 'during_ojt', outcome: 'active', clearance: 'active' });
  s.acceptedMoa!.status = 'SAS COPY SUBMITTED';
  assert.equal(decide(s, 'issue_clearance').allowed, true);
  s.acceptedMoa!.status = 'FOR NOTARIZATION';
  assert.equal(decide(s, 'issue_clearance').allowed, false);
});
test('clearance rejects missing settings, empty requirements, and unauthorized waivers', () => {
  const s = snapshot(); s.policyConfirmed = false;
  assert.equal(decide(s, 'issue_clearance').allowed, false);
  s.policyConfirmed = true; s.requirements.pre = [];
  assert.equal(decide(s, 'issue_clearance').allowed, false);
  s.requirements.pre = [{ approved: false, waiverAuthorized: false, waiverReason: 'An explanation alone is not authority' }];
  assert.equal(decide(s, 'issue_clearance').allowed, false);
});
test('scope, MFA, self-approval, reason, and stale revision cannot be bypassed', () => {
  const s = snapshot();
  assert.equal(decideLifecycle({ ...coordinator, assurance: 'aal1' }, s, 'issue_clearance', 4, 'reason').allowed, false);
  s.enrollment.programId = 'oa'; assert.equal(decide(s, 'issue_clearance').allowed, false);
  s.enrollment.programId = 'it'; s.enrollment.studentId = 'coordinator'; assert.equal(decide(s, 'issue_clearance').allowed, false);
  s.enrollment.studentId = 'student';
  assert.equal(decideLifecycle(coordinator, s, 'issue_clearance', 3, 'reason').allowed, false);
  assert.equal(decideLifecycle(coordinator, s, 'issue_clearance', 4, ' ').allowed, false);
});
test('suspension is immediate even with open attendance; changed basis cannot resume', () => {
  const s = snapshot(); s.enrollment.lifecycle = 'during_ojt'; s.enrollment.clearance = 'active'; s.openSessions = 1;
  assert.equal(decide(s, 'suspend_clearance').next?.clearance, 'suspended');
  s.enrollment.clearance = 'suspended';
  assert.equal(decide(s, 'resume_clearance').allowed, false);
  s.openSessions = 0; assert.equal(decide(s, 'resume_clearance').allowed, true);
  s.placementId = 'replacement'; assert.equal(decide(s, 'resume_clearance').allowed, false);
  assert.equal(decide(s, 'revoke_clearance').next?.clearance, 'revoked');
});
test('hours never skip stages and unresolved sessions block Post-OJT', () => {
  const s = snapshot(); assert.equal(decide(s, 'enter_post_ojt').allowed, false);
  s.enrollment.lifecycle = 'during_ojt'; s.enrollment.creditedMinutes = 29999;
  assert.equal(decide(s, 'enter_post_ojt').allowed, false);
  s.enrollment.creditedMinutes = 30000; s.openSessions = 1;
  assert.equal(decide(s, 'enter_post_ojt').allowed, false);
  s.openSessions = 0;
  assert.deepEqual(decide(s, 'enter_post_ojt').next, { lifecycle: 'post_ojt', outcome: 'active', clearance: 'revoked' });
});
test('completion checks earlier evidence and both portfolio decisions; reopen grants no attendance', () => {
  const s = snapshot(); s.enrollment.lifecycle = 'post_ojt';
  assert.equal(decide(s, 'complete').allowed, false);
  assert.equal(decide(s, 'enter_portfolio').allowed, true);
  s.enrollment.lifecycle = 'portfolio'; s.portfolioAdviserApproved = false;
  assert.equal(decide(s, 'complete').allowed, false);
  s.portfolioAdviserApproved = true; s.requirements.pre[0].approved = false;
  assert.equal(decide(s, 'complete').allowed, false);
  s.requirements.pre[0].approved = true; assert.equal(decide(s, 'complete').allowed, true);
  s.enrollment.lifecycle = 'completed'; s.enrollment.outcome = 'completed';
  assert.equal(decide(s, 'issue_clearance').allowed, false);
  assert.deepEqual(decide(s, 'reopen_completion').next, { lifecycle: 'portfolio', outcome: 'active', clearance: 'revoked' });
  assert.equal(decide(s, 'reopen_completion').invalidatePortfolioApprovals, true);
});
test('return to training requires new clearance and withdrawal is terminal', () => {
  const s = snapshot(); s.enrollment.lifecycle = 'portfolio';
  assert.equal(decide(s, 'return_to_training').next?.clearance, 'revoked');
  s.enrollment.lifecycle = 'during_ojt'; s.enrollment.clearance = 'active'; s.openSessions = 1;
  assert.deepEqual(decide(s, 'withdraw').next, { lifecycle: 'during_ojt', outcome: 'withdrawn', clearance: 'revoked' });
  s.enrollment.outcome = 'withdrawn'; assert.equal(decide(s, 'issue_clearance').allowed, false);
  assert.equal(decide(s, 'reopen_completion').allowed, false);
});
