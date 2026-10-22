import type { Command, Enrollment, Lifecycle, Result, Role, SubmissionStatus } from './contracts.ts';
import { enrollmentAccess, type IdentityContext } from './identity.ts';

export type AcademicKind = 'task' | 'journal' | 'evaluation' | 'portfolio';
export interface AcademicSnapshot {
  enrollment: Enrollment; currentAdviserId: string | null; kind: AcademicKind;
  id: string; revision: number; current: boolean; status: SubmissionStatus;
  authorId: string; submittedAt: string | null; adviserApproved: boolean; reviewStarted: boolean;
  policyConfirmed: boolean; allowedSubmissionStages: Lifecycle[];
}
export type AcademicAction = 'save_draft' | 'submit' | 'create_revision' | 'withdraw' | 'approve' | 'needs_revision' | 'reject';
/** Prepared authority gate. The artifact-specific validation below is also mandatory. */
export function academicActionBlockers(identity: IdentityContext, role: Role, s: AcademicSnapshot, action: AcademicAction, enrollmentRevision: number, artifactRevision: number, remarks = ''): string[] {
  const reasons: string[] = [];
  const studentAction = ['save_draft', 'submit', 'create_revision', 'withdraw'].includes(action);
  if (!['save_draft', 'submit', 'create_revision', 'withdraw', 'approve', 'needs_revision', 'reject'].includes(action)) reasons.push('Unsupported academic action.');
  const access = enrollmentAccess(identity, role, { programId: s.enrollment.programId, studentId: s.enrollment.studentId, currentAdviserId: s.currentAdviserId });
  if (!access.allowed || (studentAction ? role !== 'student' : role === 'student')) reasons.push('Required role and enrollment scope are missing.');
  if (s.enrollment.outcome !== 'active' || !s.policyConfirmed || !s.current) reasons.push('Active enrollment, published policy and current version are required.');
  if (!Number.isSafeInteger(enrollmentRevision) || enrollmentRevision < 0 || enrollmentRevision !== s.enrollment.revision || !Number.isSafeInteger(artifactRevision) || artifactRevision < 0 || artifactRevision !== s.revision) reasons.push('Enrollment or artifact revision is stale.');
  if (studentAction) {
    if (identity.profile?.id !== s.authorId || !s.allowedSubmissionStages.includes(s.enrollment.lifecycle)) reasons.push('Student ownership and an allowed submission stage are required.');
    if ((action === 'save_draft' || action === 'submit') && s.status !== 'draft') reasons.push('Submitted content is immutable.');
    if (action === 'create_revision' && !['needs_revision', 'rejected', 'withdrawn'].includes(s.status)) reasons.push('A new version requires an explicit revision outcome.');
    if (action === 'withdraw' && (s.status !== 'submitted' || s.reviewStarted || s.adviserApproved)) reasons.push('Withdrawal is allowed only before review starts.');
  } else {
    if (identity.profile?.id === s.authorId || identity.profile?.id === s.enrollment.studentId) reasons.push('Self-review is prohibited.');
    if (!['submitted', 'under_review'].includes(s.status) || !s.submittedAt || !Number.isFinite(Date.parse(s.submittedAt))) reasons.push('A submitted current version is required.');
    if (s.kind !== 'portfolio' && role !== 'adviser') reasons.push('Assigned adviser review is required.');
    if (s.kind === 'portfolio' && role === 'coordinator' && !s.adviserApproved) reasons.push('Adviser approval of this portfolio must precede coordinator verification.');
    if (role === 'adviser' && s.adviserApproved) reasons.push('This adviser step has already approved.');
    if (['needs_revision', 'reject'].includes(action) && !remarks.trim()) reasons.push('Revision/rejection remarks are required.');
  }
  return reasons;
}
const validDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
export interface TaskReference { id: string; enrollmentId: string; taskDate: string; revision: number; currentRevision: number; status: SubmissionStatus; }
export function journalContentBlockers(input: { enrollmentId: string; startsOn: string; endsOn: string; periodConfirmed: boolean; reflection: string; tasks: TaskReference[]; tasksMustBeApproved: boolean; allowNoActivity: boolean; noActivityReason: string; attendanceReferencesCurrent: boolean }): string[] {
  const reasons: string[] = [];
  if (!input.periodConfirmed || !validDay(input.startsOn) || !validDay(input.endsOn) || input.endsOn < input.startsOn) reasons.push('A configured journal period is required.');
  if (!input.reflection.trim()) reasons.push('Reflection is required.');
  if (!input.tasks.length && !(input.allowNoActivity && input.noActivityReason.trim())) reasons.push('Submitted tasks or an authorized no-activity explanation are required.');
  if (new Set(input.tasks.map(row => row.id)).size !== input.tasks.length || input.tasks.some(row => !row.id || row.enrollmentId !== input.enrollmentId || !validDay(row.taskDate) || row.taskDate < input.startsOn || row.taskDate > input.endsOn || !Number.isSafeInteger(row.revision) || row.revision < 0 || row.revision !== row.currentRevision || !['submitted', 'under_review', 'approved'].includes(row.status))) reasons.push('Journal task references are duplicated, foreign, stale, outside the period or not submitted.');
  if (!input.attendanceReferencesCurrent) reasons.push('Referenced attendance/DTR evidence is stale.');
  if (input.tasksMustBeApproved && input.tasks.some(row => row.status !== 'approved')) reasons.push('Published policy requires approved task evidence.');
  return reasons;
}
export function evaluationEvidenceBlockers(input: { evaluatorName: string; affiliation: string; evaluatedOn: string; windowStartsOn: string; windowEndsOn: string; serverDay: string; documentBelongsToEnrollment: boolean; documentValidated: boolean; signedEvidenceConfirmed: boolean; rubricMatchesPolicy: boolean }): string[] {
  const reasons: string[] = [];
  if (!input.evaluatorName.trim() || !input.affiliation.trim()) reasons.push('Evaluator name and affiliation are required.');
  if (![input.evaluatedOn, input.windowStartsOn, input.windowEndsOn, input.serverDay].every(validDay) || input.windowEndsOn < input.windowStartsOn || input.evaluatedOn < input.windowStartsOn || input.evaluatedOn > input.windowEndsOn || input.evaluatedOn > input.serverDay) reasons.push('Evaluation date is invalid, outside its configured window or in the future.');
  if (!input.documentBelongsToEnrollment || !input.documentValidated || !input.signedEvidenceConfirmed || !input.rubricMatchesPolicy) reasons.push('Verified signed evidence and the enrollment rubric are required.');
  return reasons;
}
/** Exact integer hundredths avoid browser floating-point totals or guessed weights. */
export function evaluationTotal(criteria: { id: string; maxHundredths: number }[], scores: { criterionId: string; hundredths: number }[]): { earnedHundredths: number; possibleHundredths: number } {
  const ids = new Set(criteria.map(row => row.id));
  if (!criteria.length || ids.size !== criteria.length || criteria.some(row => !row.id || !Number.isSafeInteger(row.maxHundredths) || row.maxHundredths <= 0) || scores.length !== criteria.length || new Set(scores.map(row => row.criterionId)).size !== scores.length) throw new Error('Invalid rubric or missing/duplicate scores.');
  let earnedHundredths = 0, possibleHundredths = 0;
  for (const row of scores) {
    const criterion = criteria.find(item => item.id === row.criterionId);
    if (!criterion || !Number.isSafeInteger(row.hundredths) || row.hundredths < 0 || row.hundredths > criterion.maxHundredths) throw new Error('Foreign criterion or out-of-range score.');
    earnedHundredths += row.hundredths; possibleHundredths += criterion.maxHundredths;
  }
  if (!Number.isSafeInteger(earnedHundredths) || !Number.isSafeInteger(possibleHundredths)) throw new Error('Rubric total exceeds supported bounds.');
  return { earnedHundredths, possibleHundredths };
}
export interface ManifestReference {
  kind: 'document' | 'requirement' | 'dtr' | 'journal' | 'evaluation'; id: string;
  requirementId: string; enrollmentId: string; revision: number; currentRevision: number;
  approvedOrValidated: boolean; requirementResolved: boolean; contentHash: string;
}
export function portfolioManifestBlockers(input: { enrollmentId: string; mandatoryRequirementIds: string[]; authorizedWaivers: string[]; sources: ManifestReference[]; creditedSourcesComplete: boolean }): string[] {
  const reasons: string[] = [];
  if (!input.mandatoryRequirementIds.length || new Set(input.mandatoryRequirementIds).size !== input.mandatoryRequirementIds.length || input.mandatoryRequirementIds.some(id => !id)) reasons.push('Mandatory portfolio configuration is missing or ambiguous.');
  if (!input.sources.length || new Set(input.sources.map(row => `${row.kind}:${row.id}`)).size !== input.sources.length || input.sources.some(row => !row.id || row.enrollmentId !== input.enrollmentId || !Number.isSafeInteger(row.revision) || row.revision < 0 || row.revision !== row.currentRevision || !row.approvedOrValidated || !/^[a-f0-9]{64}$/.test(row.contentHash))) reasons.push('Manifest sources are missing, duplicated, foreign, stale or unapproved.');
  const covered = new Set([...input.sources.filter(row => row.requirementResolved).map(row => row.requirementId), ...input.authorizedWaivers]);
  if (input.mandatoryRequirementIds.some(id => !covered.has(id))) reasons.push('Required portfolio evidence is missing.');
  if (!input.creditedSourcesComplete) reasons.push('The approved DTR/credit sources are incomplete.');
  return reasons;
}
export interface AcademicGateway {
  saveTask(input: Command<{ enrollmentId: string; taskId: string; expectedTaskRevision: number; taskDate: string; content: string }>): Promise<Result<{ taskId: string }>>;
  submitJournal(input: Command<{ enrollmentId: string; journalId: string; expectedJournalRevision: number; reflection: string; taskVersionIds: string[]; attendanceSourceIds: string[]; noActivityReason: string }>): Promise<Result<{ journalId: string }>>;
  submitEvaluation(input: Command<{ enrollmentId: string; evaluationId: string; expectedEvaluationRevision: number; evaluatorName: string; affiliation: string; evaluatedOn: string; evidenceDocumentId: string; scores: { criterionId: string; hundredths: number }[] }>): Promise<Result<{ evaluationId: string }>>;
  submitPortfolio(input: Command<{ enrollmentId: string; portfolioId: string; expectedPortfolioRevision: number; sourceIds: { kind: ManifestReference['kind']; id: string }[] }>): Promise<Result<{ portfolioId: string }>>;
  reviewAcademicArtifact(input: Command<{ enrollmentId: string; artifactId: string; kind: AcademicKind; expectedArtifactRevision: number; role: 'adviser' | 'coordinator'; decision: 'approved' | 'needs_revision' | 'rejected'; remarks: string }>): Promise<Result<{ artifactId: string; status: SubmissionStatus }>>;
  reviseOrWithdraw(input: Command<{ enrollmentId: string; artifactId: string; kind: AcademicKind; expectedArtifactRevision: number; action: 'create_revision' | 'withdraw' }>): Promise<Result<{ artifactId: string; status: SubmissionStatus }>>;
  revokeAcademicApproval(input: Command<{ enrollmentId: string; artifactId: string; kind: AcademicKind; expectedArtifactRevision: number; reason: string }>): Promise<Result<{ artifactId: string; invalidatedDependents: string[] }>>;
}
