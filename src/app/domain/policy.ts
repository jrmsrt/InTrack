import type { Actor, Clearance, Lifecycle, SubmissionStatus, MoaStatus } from './contracts.ts';
import { moaStatuses } from './contracts.ts';

export function canSetMoaStatus(role: Actor['role'] | undefined, status: unknown, currentStatus?: MoaStatus): boolean {
  return role === 'coordinator' && moaStatuses.some(item => item === status) &&
    (status !== 'SAS COPY SUBMITTED' || currentStatus === 'SIGNED AND NOTARIZED' || currentStatus === 'SAS COPY SUBMITTED');
}

export function moaIsAccepted(status: MoaStatus): boolean {
  return status === 'SIGNED AND NOTARIZED' || status === 'SAS COPY SUBMITTED';
}

/** Prototype rules and acceptance oracle; backend must enforce equivalent checks. */
export function manilaDate(timestamp: string | Date): string {
  const value = new Date(timestamp);
  if (!Number.isFinite(value.getTime())) throw new Error('Invalid timestamp.');
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
}

export function canReview(actor: Actor, record: { studentId: string; programId: string; adviserIds: string[] }): boolean {
  if (!actor.active || actor.id === record.studentId) return false;
  return actor.role === 'coordinator' ? actor.programIds.includes(record.programId) :
    actor.role === 'adviser' && record.adviserIds.includes(actor.id);
}

export function canTransitionSubmission(from: SubmissionStatus, to: SubmissionStatus, role: Actor['role'], remarks = ''): boolean {
  if (role === 'student') return (from === 'draft' && to === 'submitted') ||
    (from === 'submitted' && to === 'withdrawn');
  if (role !== 'adviser' && role !== 'coordinator') return false;
  if (from !== 'submitted' && from !== 'under_review') return false;
  if (to === 'under_review' || to === 'approved') return true;
  return (to === 'needs_revision' || to === 'rejected') && remarks.trim().length > 0;
}

export interface ClearanceEvidence {
  activePlacement: boolean; policyConfirmed: boolean; finalMoaAccepted: boolean;
  mandatoryPreRequirements: { approved: boolean; waived: boolean; waiverReason?: string }[];
}
export function clearanceBlockers(input: ClearanceEvidence): string[] {
  const reasons: string[] = [];
  if (!input.activePlacement) reasons.push('An active placement is required.');
  if (!input.policyConfirmed) reasons.push('Program policy must be confirmed.');
  if (!input.finalMoaAccepted) reasons.push('Final MOA acceptance is required.');
  if (!input.mandatoryPreRequirements.length) reasons.push('Mandatory requirements must be configured.');
  if (input.mandatoryPreRequirements.some(item => !item.approved && !(item.waived && item.waiverReason?.trim()))) reasons.push('Mandatory Pre-OJT requirements remain unresolved.');
  return reasons;
}

export function canClockIn(input: { lifecycle: Lifecycle; clearance: Clearance; activePlacement: boolean; openSession: boolean; activeEnrollment: boolean }): boolean {
  return input.activeEnrollment && input.lifecycle === 'during_ojt' && input.clearance === 'active' && input.activePlacement && !input.openSession;
}

/** A document revision itself does not alter issued authority. */
export function clearanceAfterDocumentRevision(clearance: Clearance): Clearance { return clearance; }

export function completionBlockers(input: { requiredMinutes: number; creditedMinutes: number; mandatoryItemsApproved: boolean; portfolioAdviserApproved: boolean; portfolioCoordinatorApproved: boolean; unresolvedDisputes: number }): string[] {
  const reasons: string[] = [];
  if (!Number.isSafeInteger(input.requiredMinutes) || input.requiredMinutes <= 0 || !Number.isSafeInteger(input.creditedMinutes) || input.creditedMinutes < 0) reasons.push('Training minute totals are invalid.');
  else if (input.creditedMinutes < input.requiredMinutes) reasons.push('Approved hours are incomplete.');
  if (!input.mandatoryItemsApproved) reasons.push('Mandatory evidence remains pending.');
  if (!input.portfolioAdviserApproved || !input.portfolioCoordinatorApproved) reasons.push('Portfolio approvals are incomplete.');
  if (!Number.isSafeInteger(input.unresolvedDisputes) || input.unresolvedDisputes !== 0) reasons.push('Attendance or review disputes must be resolved.');
  return reasons;
}

export function netTrainingMinutes(start: string, end: string, unpaidBreaks: { start: string; end: string }[], dailyCap: number): number {
  const from = Date.parse(start), to = Date.parse(end);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to <= from || !Number.isSafeInteger(dailyCap) || dailyCap <= 0 || to - from > 24 * 60 * 60 * 1000) throw new Error('Invalid training interval or cap.');
  const intervals = unpaidBreaks.map(item => {
    const a = Date.parse(item.start), b = Date.parse(item.end);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) throw new Error('Invalid unpaid break.');
    return [Math.max(from, a), Math.min(to, b)];
  }).filter(([a, b]) => b > a).sort((a, b) => a[0] - b[0]);
  let unpaid = 0, previousStart = 0, previousEnd = 0;
  for (const [a, b] of intervals) {
    if (a <= previousEnd) previousEnd = Math.max(previousEnd, b);
    else { unpaid += previousEnd - previousStart; previousStart = a; previousEnd = b; }
  }
  unpaid += previousEnd - previousStart;
  return Math.min(dailyCap, Math.floor((to - from - unpaid) / 60000));
}

export function gpsIsUsable(input: { latitude: number; longitude: number; accuracyMeters: number; capturedAt: string }, serverTime: string, maxAccuracy: number, maxAgeSeconds: number): boolean {
  const captured = Date.parse(input.capturedAt), received = Date.parse(serverTime);
  return Number.isFinite(input.latitude) && Math.abs(input.latitude) <= 90 &&
    Number.isFinite(input.longitude) && Math.abs(input.longitude) <= 180 &&
    Number.isFinite(input.accuracyMeters) && input.accuracyMeters > 0 &&
    Number.isFinite(maxAccuracy) && maxAccuracy > 0 && input.accuracyMeters <= maxAccuracy &&
    Number.isFinite(maxAgeSeconds) && maxAgeSeconds > 0 && Number.isFinite(captured) && Number.isFinite(received) &&
    received >= captured && received - captured <= maxAgeSeconds * 1000;
}

/** Apply a day cap across all shifts, after overnight sessions are split by local day. */
export function allocateDailyCredit(entries: { sessionId: string; day: string; minutes: number }[], dailyCap: number): { sessionId: string; day: string; creditedMinutes: number }[] {
  if (!Number.isSafeInteger(dailyCap) || dailyCap <= 0) throw new Error('Invalid daily credit cap.');
  const allocated = new Map<string, number>();
  const seen = new Set<string>();
  return entries.map(entry => {
    const key = `${entry.sessionId}:${entry.day}`;
    if (!entry.sessionId || !/^\d{4}-\d{2}-\d{2}$/.test(entry.day) || !Number.isSafeInteger(entry.minutes) || entry.minutes < 0 || seen.has(key)) throw new Error('Invalid or duplicate attendance allocation.');
    seen.add(key);
    const used = allocated.get(entry.day) || 0;
    const creditedMinutes = Math.min(entry.minutes, Math.max(0, dailyCap - used));
    allocated.set(entry.day, used + creditedMinutes);
    return { sessionId: entry.sessionId, day: entry.day, creditedMinutes };
  });
}
