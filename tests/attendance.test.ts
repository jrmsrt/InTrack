import test from 'node:test';
import assert from 'node:assert/strict';
import { clockInBlockers, closeoutDecision, insideGeofence, attendanceCreditPlan, dtrApprovalBlockers, correctionApprovalBlockers, type AttendanceSnapshot, type DtrSnapshot, type CorrectionSnapshot, type SessionSnapshot } from '../src/app/domain/attendance.ts';
import type { IdentityContext } from '../src/app/domain/identity.ts';
const serverTime = '2026-10-10T00:00:00Z';
const gps = { latitude: 14.5, longitude: 121, accuracyMeters: 10, capturedAt: serverTime };
function user(role: 'student' | 'adviser'): IdentityContext {
  return { authUserId: `auth-${role}`, emailVerified: true, assurance: role === 'adviser' ? 'aal2' : 'aal1', profile: { id: role, authUserId: `auth-${role}`, status: 'active', activatedAt: serverTime }, memberships: [{ role, programId: 'it', active: true }] };
}
function snapshot(): AttendanceSnapshot {
  return { enrollment: { id: 'e', studentId: 'student', programId: 'it', termId: 'term', policyVersionId: 'policy', component: 1, lifecycle: 'during_ojt', clearance: 'active', revision: 3, requiredMinutes: 30000, creditedMinutes: 0, outcome: 'active' }, currentAdviserId: 'adviser', policy: { confirmed: true, dailyCapMinutes: 480, maxSessionMinutes: 1440, maxAccuracyMeters: 100, maxCoordinateAgeSeconds: 60 }, placementId: 'p', placementReady: true, scheduleAllowsClockIn: true, openSessionId: null, fence: { latitude: 14.5, longitude: 121, radiusMeters: 100 }, locationExceptionApproved: false };
}
function session(): SessionSnapshot { return { id: 's', enrollmentId: 'e', placementId: 'p', revision: 1, clockInAt: serverTime, clockOutAt: null, status: 'open' }; }
test('clock-in requires ownership, live clearance, confirmed policy, schedule and no existing session', () => {
  const s = snapshot(); assert.deepEqual(clockInBlockers(user('student'), s, 3, serverTime, gps), []);
  s.enrollment.clearance = 'suspended'; assert.ok(clockInBlockers(user('student'), s, 3, serverTime, gps).length);
  s.enrollment.clearance = 'active'; s.openSessionId = 'old'; assert.ok(clockInBlockers(user('student'), s, 3, serverTime, gps).length);
  s.openSessionId = null; s.policy.confirmed = false; assert.ok(clockInBlockers(user('student'), s, 3, serverTime, gps).length);
  s.policy.confirmed = true; s.scheduleAllowsClockIn = false; assert.ok(clockInBlockers(user('student'), s, 3, serverTime, gps).length);
});
test('geofence checks accuracy circle and stale coordinates without fake GPS fallback', () => {
  const s = snapshot(); assert.equal(insideGeofence(gps, s.fence!, serverTime, s.policy), true);
  assert.equal(insideGeofence({ ...gps, accuracyMeters: 101 }, s.fence!, serverTime, s.policy), false);
  assert.equal(insideGeofence({ ...gps, longitude: 122 }, s.fence!, serverTime, s.policy), false);
  assert.ok(clockInBlockers(user('student'), s, 3, serverTime, null).length);
  assert.ok(clockInBlockers(user('student'), s, 3, serverTime, { ...gps, capturedAt: '2026-10-09T23:58:00Z' }).length);
  s.locationExceptionApproved = true; assert.deepEqual(clockInBlockers(user('student'), s, 3, serverTime, null), []);
});
test('closeout after suspension resolves the exact session as disputed without awarding credit', () => {
  const s = snapshot(); s.openSessionId = 's'; s.enrollment.clearance = 'suspended';
  const end = '2026-10-10T01:00:00Z'; const evidence = { ...gps, capturedAt: end };
  assert.equal(closeoutDecision(user('student'), s, session(), 3, 1, end, evidence).nextStatus, 'disputed');
  s.enrollment.clearance = 'active'; assert.equal(closeoutDecision(user('student'), s, session(), 3, 1, end, evidence).nextStatus, 'pending');
  assert.equal(closeoutDecision(user('student'), s, session(), 3, 0, end, evidence).nextStatus, null);
  s.openSessionId = 'other'; assert.equal(closeoutDecision(user('student'), s, session(), 3, 1, end, evidence).nextStatus, null);
});
test('overnight time splits at Manila midnight and breaks subtract only actual overlap', () => {
  const plan = attendanceCreditPlan([{ sessionId: 's', start: '2026-10-10T23:00:00+08:00', end: '2026-10-11T02:00:00+08:00', unpaidBreaks: [{ start: '2026-10-11T00:00:00+08:00', end: '2026-10-11T00:30:00+08:00' }] }], 480);
  assert.deepEqual(plan.map(row => [row.day, row.creditedMinutes]), [['2026-10-10', 60], ['2026-10-11', 90]]);
});
test('daily cap allocation is deterministic across unordered shifts and rejects duplicate/overlapping sessions', () => {
  const early = { sessionId: 'early', start: '2026-10-10T08:00:00+08:00', end: '2026-10-10T12:00:00+08:00', unpaidBreaks: [] };
  const late = { sessionId: 'late', start: '2026-10-10T13:00:00+08:00', end: '2026-10-10T18:00:00+08:00', unpaidBreaks: [] };
  assert.deepEqual(attendanceCreditPlan([late, early], 480).map(row => [row.sessionId, row.creditedMinutes]), [['early', 240], ['late', 240]]);
  assert.throws(() => attendanceCreditPlan([early, early], 480));
  assert.throws(() => attendanceCreditPlan([early, { ...late, start: '2026-10-10T11:00:00+08:00' }], 480));
});
test('DTR review checks assignment, current source revisions, unresolved records and credited-period conflicts', () => {
  const s: DtrSnapshot = { enrollment: snapshot().enrollment, currentAdviserId: 'adviser', revision: 1, status: 'submitted', periodConfirmed: true, submittedAt: serverTime, entries: [{ sessionId: 's', frozenRevision: 2, currentRevision: 2, resolved: true }], pendingCorrections: 0, unresolvedRecords: 0, overlapsCreditedPeriod: false };
  assert.deepEqual(dtrApprovalBlockers(user('adviser'), s, 3, 1), []);
  s.entries[0].currentRevision = 3; assert.ok(dtrApprovalBlockers(user('adviser'), s, 3, 1).length);
  s.entries[0].currentRevision = 2; s.overlapsCreditedPeriod = true; assert.ok(dtrApprovalBlockers(user('adviser'), s, 3, 1).length);
  s.overlapsCreditedPeriod = false; s.pendingCorrections = 1; assert.ok(dtrApprovalBlockers(user('adviser'), s, 3, 1).length);
});
test('corrections require current adviser, matching source, reason and coordinator exception for policy deviations', () => {
  const s: CorrectionSnapshot = { attendance: snapshot(), session: session(), revision: 1, status: 'pending', requestedBy: 'student', originalSessionRevision: 1, proposedStart: serverTime, proposedEnd: '2026-10-10T01:00:00Z', reason: 'Missed checkout', scheduleAndPlacementValid: true, overlapsAnotherSession: false, policyExceptionApproved: false };
  assert.deepEqual(correctionApprovalBlockers(user('adviser'), s, 3, 1, 1, 'Verified interval'), []);
  s.scheduleAndPlacementValid = false; assert.ok(correctionApprovalBlockers(user('adviser'), s, 3, 1, 1, 'Verified').length);
  s.policyExceptionApproved = true; assert.deepEqual(correctionApprovalBlockers(user('adviser'), s, 3, 1, 1, 'Verified'), []);
  s.session.revision = 2; assert.ok(correctionApprovalBlockers(user('adviser'), s, 3, 1, 2, 'Verified').length);
});
