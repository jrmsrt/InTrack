import type { Command, Enrollment, GpsEvidence, Result, StoredDocument } from './contracts.ts';
import { enrollmentAccess, type IdentityContext } from './identity.ts';
import { allocateDailyCredit, gpsIsUsable, manilaDate, netTrainingMinutes } from './policy.ts';

export interface AttendancePolicy {
  confirmed: boolean; dailyCapMinutes: number; maxSessionMinutes: number;
  maxAccuracyMeters: number; maxCoordinateAgeSeconds: number;
}
export interface Geofence { latitude: number; longitude: number; radiusMeters: number; }
export interface AttendanceSnapshot {
  enrollment: Enrollment; currentAdviserId: string | null;
  policy: AttendancePolicy; placementId: string | null; placementReady: boolean;
  scheduleAllowsClockIn: boolean; openSessionId: string | null;
  fence: Geofence | null;
  /** Server-resolved exception, scoped to this placement/action and receipt time. */
  locationExceptionApproved: boolean;
}
export interface SessionSnapshot {
  id: string; enrollmentId: string; placementId: string; revision: number;
  clockInAt: string; clockOutAt: string | null;
  status: 'open' | 'pending' | 'disputed' | 'approved' | 'void';
}
const finiteTime = (value: string) => Number.isFinite(Date.parse(value));
const revisionMatches = (given: number, actual: number) => Number.isSafeInteger(given) && given >= 0 && given === actual;
export function attendancePolicyIsValid(p: AttendancePolicy): boolean {
  return p.confirmed && Number.isSafeInteger(p.dailyCapMinutes) && p.dailyCapMinutes > 0 && p.dailyCapMinutes <= 1440 &&
    Number.isSafeInteger(p.maxSessionMinutes) && p.maxSessionMinutes > 0 && p.maxSessionMinutes <= 1440 &&
    Number.isFinite(p.maxAccuracyMeters) && p.maxAccuracyMeters > 0 && Number.isFinite(p.maxCoordinateAgeSeconds) && p.maxCoordinateAgeSeconds > 0;
}
export function insideGeofence(gps: GpsEvidence, fence: Geofence, serverTime: string, p: AttendancePolicy): boolean {
  if (!gpsIsUsable(gps, serverTime, p.maxAccuracyMeters, p.maxCoordinateAgeSeconds) || !Number.isFinite(fence.latitude) || Math.abs(fence.latitude) > 90 || !Number.isFinite(fence.longitude) || Math.abs(fence.longitude) > 180 || !Number.isFinite(fence.radiusMeters) || fence.radiusMeters <= 0) return false;
  const radians = (n: number) => n * Math.PI / 180;
  const a = Math.sin(radians(gps.latitude - fence.latitude) / 2) ** 2 + Math.cos(radians(gps.latitude)) * Math.cos(radians(fence.latitude)) * Math.sin(radians(gps.longitude - fence.longitude) / 2) ** 2;
  const distance = 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))));
  // Conservative engineering rule: uncertainty circle must fit inside the fence.
  return distance + gps.accuracyMeters <= fence.radiusMeters;
}
/** Acceptance helpers only. All inputs must be resolved again in the live server transaction. */
export function clockInBlockers(identity: IdentityContext, s: AttendanceSnapshot, expectedRevision: number, serverTime: string, gps: GpsEvidence | null): string[] {
  const reasons: string[] = [];
  if (!enrollmentAccess(identity, 'student', { programId: s.enrollment.programId, studentId: s.enrollment.studentId, currentAdviserId: s.currentAdviserId }).allowed) reasons.push('Student ownership and active access are required.');
  if (!revisionMatches(expectedRevision, s.enrollment.revision)) reasons.push('Enrollment revision is stale or invalid.');
  if (!finiteTime(serverTime) || !attendancePolicyIsValid(s.policy)) reasons.push('Confirmed attendance settings and server time are required.');
  if (s.enrollment.outcome !== 'active' || s.enrollment.lifecycle !== 'during_ojt' || s.enrollment.clearance !== 'active') reasons.push('Active training clearance is required.');
  if (!s.placementId || !s.placementReady || !s.scheduleAllowsClockIn) reasons.push('Placement dates and approved schedule must permit attendance.');
  if (s.openSessionId) reasons.push('Resolve the existing open session first.');
  if (!s.locationExceptionApproved && (!gps || !s.fence || !insideGeofence(gps, s.fence, serverTime, s.policy))) reasons.push('Location validation failed; request an authorized exception.');
  return reasons;
}
export function closeoutDecision(identity: IdentityContext, s: AttendanceSnapshot, session: SessionSnapshot, expectedEnrollmentRevision: number, expectedSessionRevision: number, serverTime: string, gps: GpsEvidence | null): { blockers: string[]; nextStatus: 'pending' | 'disputed' | null } {
  const reasons: string[] = [];
  if (!enrollmentAccess(identity, 'student', { programId: s.enrollment.programId, studentId: s.enrollment.studentId, currentAdviserId: s.currentAdviserId }).allowed) reasons.push('Student ownership and active account access are required.');
  if (session.enrollmentId !== s.enrollment.id || s.openSessionId !== session.id || session.clockOutAt || !['open', 'disputed'].includes(session.status)) reasons.push('The exact unresolved session is required.');
  if (!revisionMatches(expectedEnrollmentRevision, s.enrollment.revision) || !revisionMatches(expectedSessionRevision, session.revision)) reasons.push('Enrollment or session revision is stale.');
  const elapsed = Date.parse(serverTime) - Date.parse(session.clockInAt);
  if (!attendancePolicyIsValid(s.policy) || !Number.isFinite(elapsed) || elapsed <= 0 || elapsed > s.policy.maxSessionMinutes * 60000) reasons.push('Invalid interval; use a correction request.');
  if (!s.locationExceptionApproved && (!gps || !s.fence || !insideGeofence(gps, s.fence, serverTime, s.policy))) reasons.push('Closeout location failed; use a correction request.');
  const trainingActive = s.enrollment.outcome === 'active' && s.enrollment.lifecycle === 'during_ojt' && s.enrollment.clearance === 'active' && s.placementId === session.placementId;
  return { blockers: reasons, nextStatus: reasons.length ? null : trainingActive ? 'pending' : 'disputed' };
}

/** Approved eligible interval; break windows are already resolved from the historical schedule. */
export interface TrainingInterval { sessionId: string; start: string; end: string; unpaidBreaks: { start: string; end: string }[]; }
export function attendanceCreditPlan(intervals: TrainingInterval[], dailyCapMinutes: number) {
  if (!Number.isSafeInteger(dailyCapMinutes) || dailyCapMinutes <= 0 || dailyCapMinutes > 1440) throw new Error('Invalid daily credit cap.');
  const seen = new Set<string>();
  const segments: { sessionId: string; day: string; minutes: number; start: number; end: number }[] = [];
  for (const interval of intervals) {
    const start = Date.parse(interval.start), end = Date.parse(interval.end);
    if (!interval.sessionId || seen.has(interval.sessionId) || !Number.isFinite(start) || !Number.isFinite(end) || end <= start || end - start > 86400000) throw new Error('Invalid or duplicate training interval.');
    seen.add(interval.sessionId);
    let cursor = start;
    while (cursor < end) {
      const day = manilaDate(new Date(cursor));
      const midnight = Date.parse(`${day}T00:00:00+08:00`) + 86400000;
      const segmentEnd = Math.min(end, midnight);
      segments.push({ sessionId: interval.sessionId, day, start: cursor, end: segmentEnd, minutes: netTrainingMinutes(new Date(cursor).toISOString(), new Date(segmentEnd).toISOString(), interval.unpaidBreaks, 1440) });
      cursor = segmentEnd;
    }
  }
  segments.sort((a, b) => a.start - b.start || (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0));
  for (let i = 1; i < segments.length; i++) {
    if (segments[i].start < segments[i - 1].end) throw new Error('Training sessions overlap.');
  }
  return allocateDailyCredit(segments, dailyCapMinutes);
}

export interface DtrSnapshot {
  enrollment: Enrollment; currentAdviserId: string | null; revision: number;
  status: 'draft' | 'submitted' | 'under_review' | 'needs_revision' | 'approved' | 'superseded';
  periodConfirmed: boolean; submittedAt: string | null;
  entries: { sessionId: string; frozenRevision: number; currentRevision: number; resolved: boolean }[];
  pendingCorrections: number; unresolvedRecords: number; overlapsCreditedPeriod: boolean;
}
export interface CorrectionSnapshot {
  attendance: AttendanceSnapshot; session: SessionSnapshot;
  revision: number; status: 'pending' | 'approved' | 'rejected';
  requestedBy: string; originalSessionRevision: number;
  proposedStart: string; proposedEnd: string; reason: string;
  scheduleAndPlacementValid: boolean; overlapsAnotherSession: boolean;
  policyExceptionApproved: boolean;
}
export function correctionApprovalBlockers(identity: IdentityContext, s: CorrectionSnapshot, expectedEnrollmentRevision: number, expectedCorrectionRevision: number, expectedSessionRevision: number, decisionReason: string): string[] {
  const reasons: string[] = [];
  const e = s.attendance.enrollment;
  if (!enrollmentAccess(identity, 'adviser', { programId: e.programId, studentId: e.studentId, currentAdviserId: s.attendance.currentAdviserId }).allowed || identity.profile?.id === s.requestedBy || identity.profile?.id === e.studentId) reasons.push('Assigned adviser with staff MFA and no self-review is required.');
  // Withdrawal may leave sessions for resolution; completed records must reopen first.
  if (e.outcome === 'completed') reasons.push('Reopen completed work before correcting its records.');
  if (s.status !== 'pending' || s.session.enrollmentId !== e.id || s.session.status === 'void' || s.requestedBy !== e.studentId) reasons.push('A pending owned correction for this enrollment is required.');
  if (!revisionMatches(expectedEnrollmentRevision, e.revision) || !revisionMatches(expectedCorrectionRevision, s.revision) || !revisionMatches(expectedSessionRevision, s.session.revision) || s.originalSessionRevision !== s.session.revision) reasons.push('Correction or source session revision is stale.');
  const elapsed = Date.parse(s.proposedEnd) - Date.parse(s.proposedStart);
  if (!attendancePolicyIsValid(s.attendance.policy) || !Number.isFinite(elapsed) || elapsed <= 0 || elapsed > s.attendance.policy.maxSessionMinutes * 60000 || !s.reason.trim() || !decisionReason.trim()) reasons.push('Valid proposed interval and request/decision reasons are required.');
  if (s.overlapsAnotherSession || (!s.scheduleAndPlacementValid && !s.policyExceptionApproved)) reasons.push('Resolve overlapping time or obtain a scoped coordinator policy exception.');
  return reasons;
}
export function dtrApprovalBlockers(identity: IdentityContext, s: DtrSnapshot, expectedEnrollmentRevision: number, expectedDtrRevision: number): string[] {
  const reasons: string[] = [];
  if (!enrollmentAccess(identity, 'adviser', { programId: s.enrollment.programId, studentId: s.enrollment.studentId, currentAdviserId: s.currentAdviserId }).allowed || identity.profile?.id === s.enrollment.studentId) reasons.push('Assigned adviser with staff MFA and no self-review is required.');
  if (s.enrollment.outcome !== 'active') reasons.push('Reopen completed work before changing credit.');
  if (!revisionMatches(expectedEnrollmentRevision, s.enrollment.revision) || !revisionMatches(expectedDtrRevision, s.revision)) reasons.push('Enrollment or DTR revision is stale.');
  if (!s.periodConfirmed || !['submitted', 'under_review'].includes(s.status) || !s.submittedAt || !finiteTime(s.submittedAt)) reasons.push('A submitted DTR for a configured period is required.');
  if (!s.entries.length || new Set(s.entries.map(row => row.sessionId)).size !== s.entries.length || s.entries.some(row => !row.sessionId || !row.resolved || !revisionMatches(row.frozenRevision, row.currentRevision))) reasons.push('DTR source revisions are incomplete, duplicated, unresolved or stale.');
  if (s.pendingCorrections !== 0 || s.unresolvedRecords !== 0 || s.overlapsCreditedPeriod) reasons.push('Resolve corrections, incomplete records and conflicting credited periods.');
  return reasons;
}
export interface AttendanceGateway {
  reserveResolutionEvidence(input: Command<{ enrollmentId: string; originalName: string; mimeType: string; bytes: number }>): Promise<Result<{ document: StoredDocument; uploadToken: string }>>;
  requestReconstruction(input: Command<{ enrollmentId: string; placementId: string; proposedClockIn: string; proposedClockOut: string; reason: string; evidenceDocumentId: string }>): Promise<Result<{ reconstructionRequestId: string }>>;
  decideReconstruction(input: Command<{ enrollmentId: string; reconstructionRequestId: string; expectedRequestRevision: number; decision: 'approved' | 'rejected'; reason: string }>): Promise<Result<{ sessionId: string | null }>>;
  voidSession(input: Command<{ enrollmentId: string; sessionId: string; expectedSessionRevision: number; reason: string }>): Promise<Result<{ invalidatedDtrIds: string[] }>>;
  decideException(input: Command<{ enrollmentId: string; exceptionId: string; expectedExceptionRevision: number; decision: 'approved' | 'rejected' | 'revoked'; reason: string }>): Promise<Result<{ exceptionId: string }>>;
  closeSession(input: Command<{ enrollmentId: string; sessionId: string; expectedSessionRevision: number; gps: GpsEvidence | null }>): Promise<Result<{ sessionId: string; status: 'pending' | 'disputed' }>>;
  requestCorrection(input: Command<{ enrollmentId: string; sessionId: string; expectedSessionRevision: number; proposedClockIn: string; proposedClockOut: string; reason: string; evidenceDocumentId: string | null }>): Promise<Result<{ correctionId: string }>>;
  decideCorrection(input: Command<{ enrollmentId: string; correctionId: string; expectedCorrectionRevision: number; expectedSessionRevision: number; decision: 'approved' | 'rejected'; reason: string }>): Promise<Result<{ sessionRevision: number; invalidatedDtrIds: string[] }>>;
  submitDtr(input: Command<{ enrollmentId: string; dtrId: string; expectedDtrRevision: number }>): Promise<Result<{ dtrId: string }>>;
  reviewDtr(input: Command<{ enrollmentId: string; dtrId: string; expectedDtrRevision: number; decision: 'approved' | 'needs_revision'; remarks: string }>): Promise<Result<{ dtrId: string; creditedMinutes: number }>>;
}
