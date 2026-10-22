import test from 'node:test';
import assert from 'node:assert/strict';
import { manilaDate, canReview, canTransitionSubmission, clearanceBlockers, canClockIn, clearanceAfterDocumentRevision, completionBlockers, netTrainingMinutes, gpsIsUsable, allocateDailyCredit, canSetMoaStatus, moaIsAccepted } from '../src/app/domain/policy.ts';
import { programRequirements, requiredMinutesFor } from '../src/app/domain/programRequirements.ts';
import { moaStatuses } from '../src/app/domain/contracts.ts';

test('program hours and supplied labels are preserved without guessing missing mappings', () => {
  assert.equal(requiredMinutesFor('IT', 1), 30000);
  assert.equal(requiredMinutesFor('HM', 1), 18000);
  assert.equal(requiredMinutesFor('HM', 2), 36000);
  assert.equal(requiredMinutesFor('CpE', 2), 18000);
  assert.equal(requiredMinutesFor('OA', 2), 18000);
  assert.equal(requiredMinutesFor('BSIT', 1), 30000);
  assert.equal(requiredMinutesFor('BSHM', 2), 36000);
  assert.deepEqual(programRequirements.filter(item => item.program === 'BSHM').map(item => [item.yearLevel, item.semester]), [[2, 'summer'], [4, '2']]);
  assert.deepEqual(programRequirements.filter(item => item.program === 'BSIT').map(item => [item.yearLevel, item.semester]), [[4, '2']]);
  assert.deepEqual(programRequirements.filter(item => item.program === 'BSCPE').map(item => [item.yearLevel, item.semester]), [[2, 'summer'], [3, 'summer']]);
  assert.deepEqual(programRequirements.filter(item => item.program === 'BSOA').map(item => [item.yearLevel, item.semester]), [[2, '2'], [4, '2']]);
  assert.equal(requiredMinutesFor('BSCPE', 1), 18000);
  assert.equal(requiredMinutesFor('BSOA', 2), 18000);
  assert.throws(() => requiredMinutesFor('IT', 2));
});

test('MOA routing uses the seven owner-defined states', () => {
  assert.deepEqual([...moaStatuses].sort(), ['SAS COPY SUBMITTED', 'SIGNED AND NOTARIZED', 'FOR NOTARIZATION', 'IN-PROCESS FOR REVISION', 'IN-PROCESS FOR REVIEW OF ULCO', 'FOR COMPANY REVIEW', 'NO MOA'].sort());
});

test('only coordinators can set a supported MOA status', () => {
  assert.equal(canSetMoaStatus('coordinator', 'SIGNED AND NOTARIZED'), true);
  assert.equal(canSetMoaStatus('student', 'FOR COMPANY REVIEW'), false);
  assert.equal(canSetMoaStatus('adviser', 'SIGNED AND NOTARIZED'), false);
  assert.equal(canSetMoaStatus(undefined, 'NO MOA'), false);
  assert.equal(canSetMoaStatus('coordinator', 'SAS COPY'), false);
});

test('SAS submission requires prior notarization and preserves accepted MOA eligibility', () => {
  assert.equal(canSetMoaStatus('coordinator', 'SAS COPY SUBMITTED', 'SIGNED AND NOTARIZED'), true);
  assert.equal(canSetMoaStatus('coordinator', 'SAS COPY SUBMITTED', 'SAS COPY SUBMITTED'), true);
  assert.equal(canSetMoaStatus('coordinator', 'SAS COPY SUBMITTED', 'FOR NOTARIZATION'), false);
  assert.equal(canSetMoaStatus('student', 'SAS COPY SUBMITTED', 'SIGNED AND NOTARIZED'), false);
  assert.equal(moaIsAccepted('SAS COPY SUBMITTED'), true);
  assert.equal(moaIsAccepted('SIGNED AND NOTARIZED'), true);
  assert.equal(moaIsAccepted('FOR NOTARIZATION'), false);
});

test('Philippine early morning belongs to the local date', () => {
  assert.equal(manilaDate('2026-10-07T23:00:00Z'), '2026-10-08');
  assert.equal(manilaDate('2026-10-08T16:00:00Z'), '2026-10-09');
  assert.throws(() => manilaDate('invalid'));
});
test('review scope excludes unrelated advisers, disabled actors, self review and other programs', () => {
  const record = { studentId: 'student', programId: 'bsit', adviserIds: ['assigned'] };
  const actor = { id: 'assigned', role: 'adviser' as const, active: true, programIds: [] };
  assert.equal(canReview(actor, record), true);
  assert.equal(canReview({ ...actor, id: 'other' }, record), false);
  assert.equal(canReview({ ...actor, active: false }, record), false);
  assert.equal(canReview({ ...actor, id: 'student' }, record), false);
  assert.equal(canReview({ ...actor, role: 'coordinator', programIds: ['bsit'] }, record), true);
  assert.equal(canReview({ ...actor, role: 'coordinator', programIds: ['other'] }, record), false);
});
test('submitted evidence is immutable and revision decisions need reasons', () => {
  assert.equal(canTransitionSubmission('draft', 'approved', 'student'), false);
  assert.equal(canTransitionSubmission('approved', 'draft', 'student'), false);
  assert.equal(canTransitionSubmission('submitted', 'needs_revision', 'adviser', ' '), false);
  assert.equal(canTransitionSubmission('submitted', 'needs_revision', 'adviser', 'Missing signature'), true);
});
test('clearance cannot pass an empty checklist or unreasoned waiver', () => {
  const evidence = { activePlacement: true, policyConfirmed: true, finalMoaAccepted: true, mandatoryPreRequirements: [] };
  assert.ok(clearanceBlockers(evidence).length);
  assert.ok(clearanceBlockers({ ...evidence, mandatoryPreRequirements: [{ approved: false, waived: true }] }).length);
  assert.deepEqual(clearanceBlockers({ ...evidence, mandatoryPreRequirements: [{ approved: false, waived: true, waiverReason: 'Verified equivalent evidence' }] }), []);
});
test('revising MOA does not silently revoke clearance', () => assert.equal(clearanceAfterDocumentRevision('active'), 'active'));
test('attendance requires active authority and cannot open a second session', () => {
  const state = { lifecycle: 'during_ojt' as const, clearance: 'active' as const, activePlacement: true, openSession: false, activeEnrollment: true };
  assert.equal(canClockIn(state), true);
  assert.equal(canClockIn({ ...state, openSession: true }), false);
  assert.equal(canClockIn({ ...state, clearance: 'suspended' }), false);
  assert.equal(canClockIn({ ...state, lifecycle: 'completed' }), false);
});
test('completion requires approved credit, both portfolio reviews and no disputes', () => {
  const state = { requiredMinutes: 28800, creditedMinutes: 28800, mandatoryItemsApproved: true, portfolioAdviserApproved: true, portfolioCoordinatorApproved: true, unresolvedDisputes: 0 };
  assert.deepEqual(completionBlockers(state), []);
  assert.ok(completionBlockers({ ...state, creditedMinutes: 28799 }).length);
  assert.ok(completionBlockers({ ...state, unresolvedDisputes: 1 }).length);
  assert.ok(completionBlockers({ ...state, portfolioCoordinatorApproved: false }).length);
});
test('full shift credits eight hours and short shifts deduct actual break overlap', () => {
  const breaks = [{ start: '2026-10-08T12:00:00+08:00', end: '2026-10-08T13:00:00+08:00' }];
  assert.equal(netTrainingMinutes('2026-10-08T08:00:00+08:00', '2026-10-08T17:00:00+08:00', breaks, 480), 480);
  assert.equal(netTrainingMinutes('2026-10-08T11:00:00+08:00', '2026-10-08T12:30:00+08:00', breaks, 480), 60);
  assert.equal(netTrainingMinutes('2026-10-08T08:00:00+08:00', '2026-10-08T10:00:00+08:00', breaks, 480), 120);
});
test('overlapping breaks do not double deduct and invalid intervals fail', () => {
  const start = '2026-10-08T08:00:00Z', end = '2026-10-08T17:00:00Z';
  assert.equal(netTrainingMinutes(start, end, [{ start: '2026-10-08T12:00:00Z', end: '2026-10-08T13:00:00Z' }, { start: '2026-10-08T12:30:00Z', end: '2026-10-08T13:30:00Z' }], 600), 450);
  assert.throws(() => netTrainingMinutes(end, start, [], 480));
});
test('GPS rejects stale, future, inaccurate and malformed coordinates', () => {
  const evidence = { latitude: 14.5, longitude: 121, accuracyMeters: 10, capturedAt: '2026-10-08T08:00:00Z' };
  assert.equal(gpsIsUsable(evidence, '2026-10-08T08:00:30Z', 100, 60), true);
  assert.equal(gpsIsUsable(evidence, '2026-10-08T08:02:00Z', 100, 60), false);
  assert.equal(gpsIsUsable(evidence, '2026-10-08T07:59:00Z', 100, 60), false);
  assert.equal(gpsIsUsable({ ...evidence, accuracyMeters: 200 }, '2026-10-08T08:00:30Z', 100, 60), false);
  assert.equal(gpsIsUsable({ ...evidence, latitude: 91 }, '2026-10-08T08:00:30Z', 100, 60), false);
});

test('multiple shifts share a daily cap and different days have separate budgets', () => {
  const entries = [
    { sessionId: 'morning', day: '2026-10-08', minutes: 300 },
    { sessionId: 'evening', day: '2026-10-08', minutes: 300 },
    { sessionId: 'next-day', day: '2026-10-09', minutes: 300 },
  ];
  assert.deepEqual(allocateDailyCredit(entries, 480).map(item => item.creditedMinutes), [300, 180, 300]);
  assert.throws(() => allocateDailyCredit([entries[0], entries[0]], 480));
});
