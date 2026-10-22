import test from 'node:test';
import assert from 'node:assert/strict';
import { academicActionBlockers, journalContentBlockers, evaluationTotal, evaluationEvidenceBlockers, portfolioManifestBlockers, type AcademicSnapshot, type ManifestReference } from '../src/app/domain/academic.ts';
import type { IdentityContext } from '../src/app/domain/identity.ts';
function user(role: 'student' | 'adviser' | 'coordinator'): IdentityContext {
  return { authUserId: `auth-${role}`, emailVerified: true, assurance: 'aal2', profile: { id: role, authUserId: `auth-${role}`, status: 'active', activatedAt: '2026-10-10T00:00:00Z' }, memberships: [{ role, programId: 'it', active: true }] };
}
function snapshot(): AcademicSnapshot { return { enrollment: { id: 'e', studentId: 'student', programId: 'it', termId: 'term', policyVersionId: 'policy', component: 1, lifecycle: 'portfolio', clearance: 'revoked', revision: 3, requiredMinutes: 30000, creditedMinutes: 30000, outcome: 'active' }, currentAdviserId: 'adviser', kind: 'portfolio', id: 'p', revision: 1, current: true, status: 'submitted', authorId: 'student', submittedAt: '2026-10-10T00:00:00Z', adviserApproved: false, reviewStarted: false, policyConfirmed: true, allowedSubmissionStages: ['portfolio'] }; }
test('portfolio coordinator verification follows adviser approval of the same current version', () => {
  const s = snapshot();
  assert.ok(academicActionBlockers(user('coordinator'), 'coordinator', s, 'approve', 3, 1).length);
  assert.deepEqual(academicActionBlockers(user('adviser'), 'adviser', s, 'approve', 3, 1), []);
  s.adviserApproved = true; s.status = 'under_review';
  assert.deepEqual(academicActionBlockers(user('coordinator'), 'coordinator', s, 'approve', 3, 1), []);
  assert.ok(academicActionBlockers(user('adviser'), 'adviser', s, 'approve', 3, 1).length);
});
test('academic edits reject submitted content, stale revisions, lost assignment, and completed work', () => {
  const s = snapshot(); assert.ok(academicActionBlockers(user('student'), 'student', s, 'save_draft', 3, 1).length);
  assert.ok(academicActionBlockers(user('adviser'), 'adviser', s, 'approve', 3, 0).length);
  s.currentAdviserId = 'replacement'; assert.ok(academicActionBlockers(user('adviser'), 'adviser', s, 'approve', 3, 1).length);
  s.currentAdviserId = 'adviser'; s.enrollment.outcome = 'completed';
  assert.ok(academicActionBlockers(user('adviser'), 'adviser', s, 'approve', 3, 1).length);
});
test('journals reject foreign, stale or out-of-period task references and unauthorized empty activity', () => {
  const input = { enrollmentId: 'e', startsOn: '2026-10-05', endsOn: '2026-10-11', periodConfirmed: true, reflection: 'Work completed and learning recorded', tasks: [{ id: 'task', enrollmentId: 'e', taskDate: '2026-10-10', revision: 1, currentRevision: 1, status: 'submitted' as const }], tasksMustBeApproved: false, allowNoActivity: false, noActivityReason: '', attendanceReferencesCurrent: true };
  assert.deepEqual(journalContentBlockers(input), []);
  assert.ok(journalContentBlockers({ ...input, tasks: [{ ...input.tasks[0], currentRevision: 2 }] }).length);
  assert.ok(journalContentBlockers({ ...input, tasks: [{ ...input.tasks[0], enrollmentId: 'other' }] }).length);
  assert.ok(journalContentBlockers({ ...input, tasks: [{ ...input.tasks[0], taskDate: '2026-10-12' }] }).length);
  assert.ok(journalContentBlockers({ ...input, tasks: [] }).length);
  assert.deepEqual(journalContentBlockers({ ...input, tasks: [], allowNoActivity: true, noActivityReason: 'Approved no-work period' }), []);
});
test('rubric totals use exact hundredths and reject foreign, missing, duplicate or out-of-range scores', () => {
  const rubric = [{ id: 'a', maxHundredths: 250 }, { id: 'b', maxHundredths: 100 }];
  assert.deepEqual(evaluationTotal(rubric, [{ criterionId: 'a', hundredths: 225 }, { criterionId: 'b', hundredths: 75 }]), { earnedHundredths: 300, possibleHundredths: 350 });
  assert.throws(() => evaluationTotal(rubric, [{ criterionId: 'a', hundredths: 251 }, { criterionId: 'b', hundredths: 75 }]));
  assert.throws(() => evaluationTotal(rubric, [{ criterionId: 'a', hundredths: 225 }]));
  assert.throws(() => evaluationTotal(rubric, [{ criterionId: 'a', hundredths: 225 }, { criterionId: 'a', hundredths: 75 }]));
  assert.throws(() => evaluationTotal(rubric, [{ criterionId: 'a', hundredths: 225 }, { criterionId: 'foreign', hundredths: 75 }]));
});
test('portfolio needs approved requirements and exact current sources, not uploaded-file counts', () => {
  const source: ManifestReference = { kind: 'journal', id: 'journal', requirementId: 'req', enrollmentId: 'e', revision: 2, currentRevision: 2, approvedOrValidated: true, requirementResolved: true, contentHash: 'a'.repeat(64) };
  const input = { enrollmentId: 'e', mandatoryRequirementIds: ['req'], authorizedWaivers: [], sources: [source], creditedSourcesComplete: true };
  assert.deepEqual(portfolioManifestBlockers(input), []);
  assert.ok(portfolioManifestBlockers({ ...input, sources: [{ ...source, currentRevision: 3 }] }).length);
  assert.ok(portfolioManifestBlockers({ ...input, sources: [{ ...source, requirementResolved: false }] }).length);
  assert.ok(portfolioManifestBlockers({ ...input, creditedSourcesComplete: false }).length);
  assert.ok(portfolioManifestBlockers({ ...input, mandatoryRequirementIds: ['req', 'missing'] }).length);
});

test('evaluation approval needs verified signed evidence, matching rubric, and a valid nonfuture date', () => {
  const input = { evaluatorName: 'Named evaluator', affiliation: 'Company', evaluatedOn: '2026-10-10', windowStartsOn: '2026-10-01', windowEndsOn: '2026-10-31', serverDay: '2026-10-10', documentBelongsToEnrollment: true, documentValidated: true, signedEvidenceConfirmed: true, rubricMatchesPolicy: true };
  assert.deepEqual(evaluationEvidenceBlockers(input), []);
  assert.ok(evaluationEvidenceBlockers({ ...input, evaluatedOn: '2026-10-11' }).length);
  assert.ok(evaluationEvidenceBlockers({ ...input, signedEvidenceConfirmed: false }).length);
  assert.ok(evaluationEvidenceBlockers({ ...input, rubricMatchesPolicy: false }).length);
});


