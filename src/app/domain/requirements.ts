import type { Command, Enrollment, Lifecycle, Result, Role, SubmissionStatus, MoaStatus } from './contracts.ts';
import { enrollmentAccess, type IdentityContext } from './identity.ts';
import { moaStatuses } from './contracts.ts';

export type EvidenceType = 'file' | 'staff_verification' | 'moa' | 'dtr' | 'journal' | 'evaluation' | 'portfolio';
export type ReviewerPlan = 'adviser' | 'coordinator' | 'both';
export type RequirementAction = 'submit' | 'withdraw' | 'create_revision' | 'verify_evidence' | 'start_review' | 'approve' | 'request_revision' | 'reject' | 'revoke_approval';
export interface RequirementDefinition {
  id: string; policyVersionId: string; published: boolean; reviewer: ReviewerPlan;
  evidenceType: EvidenceType; allowedSubmissionStages: Lifecycle[];
}
export interface SubmissionRecord {
  id: string; version: number; revision: number; status: SubmissionStatus;
  submittedBy: string; submittedAt: string | null; latest: boolean;
  adviserApproved: boolean; coordinatorApproved: boolean;
  reviewStarted: boolean;
}
/** Evidence and approval flags must be resolved from protected server records. */
export interface RequirementSnapshot {
  requirementId: string;
  enrollment: Enrollment; currentAdviserId: string | null;
  definition: RequirementDefinition; submission: SubmissionRecord;
  document: { id: string; requirementId: string; enrollmentId: string; uploadedBy: string; status: 'pending' | 'validated' | 'quarantined' | 'attached'; sha256: string | null; bytes: number; mimeType: string } | null;
  verification: { submissionVersionId: string; verifiedBy: string; verifiedAt: string; note: string; authorized: boolean } | null;
}
export interface RequirementDecision {
  allowed: boolean; blockers: string[]; nextStatus: SubmissionStatus | null;
  createNewVersion: boolean; clearCurrentApprovals: boolean;
  approvalStep: 'adviser' | 'coordinator' | null; recordReviewStarted: boolean;
}
const validDate = (value: string | null) => !!value && Number.isFinite(Date.parse(value));

/** Preparation oracle, not server authorization. Specialized artifacts use their own commands. */
export function decideRequirement(identity: IdentityContext, role: Role, s: RequirementSnapshot, action: RequirementAction, expectedEnrollmentRevision: number, expectedSubmissionRevision: number, remarks = ''): RequirementDecision {
  const blockers: string[] = [];
  const deny = (condition: boolean, message: string) => { if (condition) blockers.push(message); };
  const row = s.submission, def = s.definition;
  const studentAction = ['submit', 'withdraw', 'create_revision'].includes(action);
  const access = enrollmentAccess(identity, role, { programId: s.enrollment.programId, studentId: s.enrollment.studentId, currentAdviserId: s.currentAdviserId });
  deny(!access.allowed || (studentAction ? role !== 'student' : role === 'student'), 'Actor lacks the required role or enrollment scope.');
  deny(s.enrollment.outcome !== 'active', 'Enrollment must be active; reopen completed work first.');
  deny(!Number.isSafeInteger(expectedEnrollmentRevision) || expectedEnrollmentRevision < 0 || expectedEnrollmentRevision !== s.enrollment.revision || !Number.isSafeInteger(expectedSubmissionRevision) || expectedSubmissionRevision < 0 || expectedSubmissionRevision !== row.revision, 'Enrollment or submission revision is stale or invalid.');
  deny(!row.latest, 'Only the current submission version can change.');
  deny(!def.published || def.policyVersionId !== s.enrollment.policyVersionId, 'Requirement must use the enrollment published policy snapshot.');
  deny(!['file', 'staff_verification'].includes(def.evidenceType), 'Use the specialized artifact workflow for this requirement.');
  if (studentAction) {
    deny(identity.profile?.id !== row.submittedBy, 'Student must own this submission.');
    deny(!def.allowedSubmissionStages.includes(s.enrollment.lifecycle), 'Submission is closed in this stage under the published policy.');
  } else {
    deny(identity.profile?.id === row.submittedBy || identity.profile?.id === s.enrollment.studentId, 'Self-review is prohibited.');
    if (action !== 'revoke_approval' && action !== 'verify_evidence') {
      deny(def.reviewer !== 'both' && def.reviewer !== role, 'This role is not the configured reviewer.');
      deny(def.reviewer === 'both' && role === 'coordinator' && !row.adviserApproved, 'Adviser approval must precede coordinator verification.');
      deny(role === 'adviser' ? row.adviserApproved : row.coordinatorApproved, 'This review step has already approved this version.');
    }
  }
  const evidenceReady = () => {
    if (def.evidenceType === 'file') {
      const d = s.document;
      deny(!d || d.requirementId !== s.requirementId || d.enrollmentId !== s.enrollment.id || d.uploadedBy !== row.submittedBy || !['validated', 'attached'].includes(d.status) || !d.sha256 || !/^[a-f0-9]{64}$/.test(d.sha256) || !Number.isSafeInteger(d.bytes) || d.bytes <= 0 || d.bytes > 10485760 || !['application/pdf', 'image/jpeg', 'image/png'].includes(d.mimeType), 'Validated owned evidence is required.');
    } else {
      const v = s.verification;
      deny(!v || v.submissionVersionId !== row.id || !v.authorized || v.verifiedBy === s.enrollment.studentId || !validDate(v.verifiedAt) || !v.note.trim(), 'An authorized staff verification record for this version is required.');
    }
  };
  let nextStatus: SubmissionStatus = row.status;
  let createNewVersion = false, clearCurrentApprovals = false;
  switch (action) {
    case 'submit':
      deny(row.status !== 'draft', 'Only a draft can be submitted.');
      // Physical-evidence requests can be submitted before staff verifies them.
      if (def.evidenceType === 'file') evidenceReady();
      nextStatus = 'submitted'; break;
    case 'withdraw':
      deny(row.status !== 'submitted' || row.reviewStarted || row.adviserApproved || row.coordinatorApproved, 'Withdrawal is allowed only before review starts.');
      nextStatus = 'withdrawn'; break;
    case 'create_revision':
      deny(!['needs_revision', 'rejected', 'withdrawn'].includes(row.status), 'A new version requires revision, rejection, or withdrawal.');
      nextStatus = 'draft'; createNewVersion = true; clearCurrentApprovals = true; break;
    case 'verify_evidence':
      deny(def.evidenceType !== 'staff_verification' || !['submitted', 'under_review'].includes(row.status) || !validDate(row.submittedAt), 'Only a submitted physical-evidence request can be verified.');
      deny(!remarks.trim(), 'A verification note is required.');
      break;
    case 'start_review':
    case 'approve':
    case 'request_revision':
    case 'reject':
      deny(!['submitted', 'under_review'].includes(row.status) || !validDate(row.submittedAt), 'A submitted timestamp and reviewable version are required.');
      if (action === 'start_review') nextStatus = 'under_review';
      if (action === 'approve') {
        evidenceReady();
        nextStatus = def.reviewer === 'both' && role === 'adviser' ? 'under_review' : 'approved';
      }
      if (action === 'request_revision' || action === 'reject') {
        deny(!remarks.trim(), 'Revision and rejection require remarks.');
        nextStatus = action === 'request_revision' ? 'needs_revision' : 'rejected'; clearCurrentApprovals = true;
      }
      break;
    case 'revoke_approval':
      deny(role !== 'coordinator' || (!row.adviserApproved && !row.coordinatorApproved), 'Only a scoped coordinator can revoke an existing approval.');
      deny(!remarks.trim(), 'Revocation requires a reason and impact assessment.');
      nextStatus = 'needs_revision'; clearCurrentApprovals = true; break;
    default: blockers.push('Unsupported requirement action.');
  }
  return { allowed: blockers.length === 0, blockers, nextStatus: blockers.length ? null : nextStatus,
    createNewVersion: blockers.length === 0 && createNewVersion, clearCurrentApprovals: blockers.length === 0 && clearCurrentApprovals,
    approvalStep: blockers.length === 0 && action === 'approve' && role !== 'student' ? role : null,
    recordReviewStarted: blockers.length === 0 && ['verify_evidence', 'start_review', 'approve', 'request_revision', 'reject'].includes(action) };
}

export interface RequirementGateway {
  getRequirementSnapshot(enrollmentId: string, requirementId: string): Promise<RequirementSnapshot>;
  applyRequirementAction(input: Command<{ enrollmentId: string; requirementId: string; submissionVersionId: string; expectedSubmissionRevision: number; role: Role; action: RequirementAction; remarks: string }>): Promise<Result<{ submissionVersionId: string; status: SubmissionStatus }>>;
  verifyPhysicalEvidence(input: Command<{ enrollmentId: string; requirementId: string; submissionVersionId: string; expectedSubmissionRevision: number; note: string }>): Promise<Result<{ verificationId: string }>>;
  updateMoaRouting(input: Command<{ enrollmentId: string; submissionVersionId: string | null; status: MoaStatus; remarks: string; evidenceNote: string }>): Promise<Result<{ routingEventId: string; status: MoaStatus }>>;
}

export interface MoaRoutingSnapshot {
  enrollment: Enrollment; currentAdviserId: string | null;
  currentStatus: MoaStatus; currentVersionId: string | null;
  candidate: { versionId: string; validated: boolean; notarizationConfirmed: boolean } | null;
}
/** Routing cannot modify clearance or the enrollment lifecycle. */
export function moaRoutingBlockers(identity: IdentityContext, s: MoaRoutingSnapshot, target: MoaStatus, expectedRevision: number, remarks: string, evidenceNote = ''): string[] {
  const blockers: string[] = [];
  if (!enrollmentAccess(identity, 'coordinator', { programId: s.enrollment.programId, studentId: s.enrollment.studentId, currentAdviserId: s.currentAdviserId }).allowed || identity.profile?.id === s.enrollment.studentId) blockers.push('An authorized coordinator other than the student is required.');
  if (s.enrollment.outcome !== 'active') blockers.push('Reopen completed work before changing MOA routing.');
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision !== s.enrollment.revision) blockers.push('Enrollment revision is stale or invalid.');
  if (!moaStatuses.includes(target)) blockers.push('Unsupported MOA status.');
  if (!remarks.trim()) blockers.push('A routing reason is required.');
  if (target !== 'NO MOA' && (!s.candidate?.versionId || !s.candidate.validated)) blockers.push('A validated MOA version is required.');
  if (target === 'SIGNED AND NOTARIZED' && !evidenceNote.trim()) blockers.push('Record confirmation of signatures and notarization.');
  if (target === 'SAS COPY SUBMITTED' && (!['SIGNED AND NOTARIZED', 'SAS COPY SUBMITTED'].includes(s.currentStatus) || !s.candidate?.notarizationConfirmed || s.candidate.versionId !== s.currentVersionId || !evidenceNote.trim())) blockers.push('SAS submission requires confirmed notarization of this same copy and submission evidence.');
  return blockers;
}
