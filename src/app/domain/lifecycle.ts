import type { Command, Enrollment, Lifecycle, Result, MoaStatus } from './contracts.ts';
import { enrollmentAccess, type IdentityContext } from './identity.ts';
import { completionBlockers, moaIsAccepted } from './policy.ts';

export type LifecycleAction = 'issue_clearance' | 'resume_clearance' | 'suspend_clearance' | 'revoke_clearance' |
  'enter_post_ojt' | 'enter_portfolio' | 'complete' | 'withdraw' | 'reopen_completion' | 'return_to_training';
export interface RequirementGate { approved: boolean; waiverAuthorized: boolean; waiverReason: string; }
/** Populate from authoritative, versioned records; never accept these flags from the browser. */
export interface LifecycleSnapshot {
  enrollment: Enrollment;
  currentAdviserId: string | null;
  policyConfirmed: boolean;
  placementId: string | null;
  placementReady: boolean;
  acceptedMoa: { versionId: string; status: MoaStatus } | null;
  clearanceBasis: { placementId: string; moaVersionId: string } | null;
  requirements: Record<'pre' | 'during' | 'post' | 'portfolio', RequirementGate[]>;
  portfolioAdviserApproved: boolean;
  portfolioCoordinatorApproved: boolean;
  unresolvedDisputes: number;
  openSessions: number;
}
export interface LifecycleDecision {
  allowed: boolean; blockers: string[];
  next: Pick<Enrollment, 'lifecycle' | 'outcome' | 'clearance'> | null;
  invalidatePortfolioApprovals: boolean;
}
const requirementsPass = (rows: RequirementGate[]) => rows.length > 0 && rows.every(row => row.approved || (row.waiverAuthorized && row.waiverReason.trim().length > 0));

/** Acceptance oracle only. Live transactions must independently enforce the same invariants. */
export function decideLifecycle(identity: IdentityContext, snapshot: LifecycleSnapshot, action: LifecycleAction, expectedRevision: number, reason: string): LifecycleDecision {
  const e = snapshot.enrollment;
  const blockers: string[] = [];
  const deny = (condition: boolean, message: string) => { if (condition) blockers.push(message); };
  deny(!enrollmentAccess(identity, 'coordinator', { programId: e.programId, studentId: e.studentId, currentAdviserId: snapshot.currentAdviserId }).allowed || identity.profile?.id === e.studentId, 'An authorized coordinator other than the student is required.');
  deny(!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision !== e.revision, 'Enrollment revision is stale or invalid.');
  deny(!reason.trim(), 'A reason is required.');
  deny((e.lifecycle === 'completed') !== (e.outcome === 'completed'), 'Enrollment outcome and stage are inconsistent.');
  deny(!Number.isSafeInteger(snapshot.openSessions) || snapshot.openSessions < 0 || !Number.isSafeInteger(snapshot.unresolvedDisputes) || snapshot.unresolvedDisputes < 0, 'Unresolved-record counts are invalid.');
  const next = { lifecycle: e.lifecycle, outcome: e.outcome, clearance: e.clearance };
  if (action === 'reopen_completion') {
    deny(e.outcome !== 'completed' || e.lifecycle !== 'completed', 'Only a completed enrollment can be reopened.');
    next.lifecycle = 'portfolio'; next.outcome = 'active'; next.clearance = 'revoked';
  } else {
    deny(e.outcome !== 'active', 'Enrollment is not active.');
    const readyForTraining = () => {
      deny(!snapshot.policyConfirmed, 'Program policy must be confirmed.');
      deny(!snapshot.placementReady || !snapshot.placementId, 'A valid active placement and schedule are required.');
      deny(!snapshot.acceptedMoa?.versionId || !moaIsAccepted(snapshot.acceptedMoa.status), 'An accepted MOA version is required.');
      deny(!requirementsPass(snapshot.requirements.pre), 'Mandatory Pre-OJT evidence must be configured and resolved.');
      deny(snapshot.openSessions !== 0 || snapshot.unresolvedDisputes !== 0, 'Open sessions and disputes must be resolved.');
    };
    switch (action) {
      case 'issue_clearance':
        deny(!['pre_ojt', 'during_ojt'].includes(e.lifecycle) || !['not_issued', 'revoked'].includes(e.clearance), 'Clearance cannot be issued from this state.');
        readyForTraining(); next.lifecycle = 'during_ojt'; next.clearance = 'active'; break;
      case 'resume_clearance':
        deny(e.lifecycle !== 'during_ojt' || e.clearance !== 'suspended', 'Only suspended training clearance can resume.');
        readyForTraining();
        deny(!snapshot.clearanceBasis || snapshot.clearanceBasis.placementId !== snapshot.placementId || snapshot.clearanceBasis.moaVersionId !== snapshot.acceptedMoa?.versionId, 'Changed placement or MOA basis requires revocation and new clearance.');
        next.clearance = 'active'; break;
      case 'suspend_clearance':
        deny(e.lifecycle !== 'during_ojt' || e.clearance !== 'active', 'Only active training clearance can be suspended.');
        next.clearance = 'suspended'; break;
      case 'revoke_clearance':
        deny(!['active', 'suspended'].includes(e.clearance), 'Only issued clearance can be revoked.');
        next.clearance = 'revoked'; break;
      case 'enter_post_ojt':
        deny(e.lifecycle !== 'during_ojt', 'Post-OJT follows During OJT.');
        deny(!requirementsPass(snapshot.requirements.during), 'Mandatory During-OJT evidence must be configured and resolved.');
        blockers.push(...completionBlockers({ requiredMinutes: e.requiredMinutes, creditedMinutes: e.creditedMinutes, mandatoryItemsApproved: true, portfolioAdviserApproved: true, portfolioCoordinatorApproved: true, unresolvedDisputes: snapshot.unresolvedDisputes }));
        deny(snapshot.openSessions !== 0, 'Open attendance sessions must be resolved.');
        next.lifecycle = 'post_ojt'; next.clearance = 'revoked'; break;
      case 'enter_portfolio':
        deny(e.lifecycle !== 'post_ojt', 'Portfolio Completion follows Post-OJT.');
        deny(!requirementsPass(snapshot.requirements.post), 'Mandatory Post-OJT evidence must be configured and resolved.');
        deny(snapshot.openSessions !== 0 || snapshot.unresolvedDisputes !== 0, 'Open sessions and disputes must be resolved.');
        next.lifecycle = 'portfolio'; next.clearance = 'revoked'; break;
      case 'complete':
        deny(e.lifecycle !== 'portfolio', 'Completion requires the Portfolio Completion stage.');
        blockers.push(...completionBlockers({ requiredMinutes: e.requiredMinutes, creditedMinutes: e.creditedMinutes, mandatoryItemsApproved: Object.values(snapshot.requirements).every(requirementsPass), portfolioAdviserApproved: snapshot.portfolioAdviserApproved, portfolioCoordinatorApproved: snapshot.portfolioCoordinatorApproved, unresolvedDisputes: snapshot.unresolvedDisputes }));
        deny(snapshot.openSessions !== 0, 'Open attendance sessions must be resolved.');
        next.lifecycle = 'completed'; next.outcome = 'completed'; next.clearance = 'revoked'; break;
      case 'withdraw':
        next.outcome = 'withdrawn'; next.clearance = 'revoked'; break;
      case 'return_to_training':
        deny(!['post_ojt', 'portfolio'].includes(e.lifecycle), 'Return to training requires Post-OJT or Portfolio Completion.');
        deny(snapshot.openSessions !== 0, 'Open attendance sessions must be resolved.');
        next.lifecycle = 'during_ojt'; next.clearance = 'revoked'; break;
      default:
        blockers.push('Unsupported lifecycle action.');
    }
  }
  return { allowed: blockers.length === 0, blockers, next: blockers.length ? null : next,
    invalidatePortfolioApprovals: blockers.length === 0 && (action === 'reopen_completion' || action === 'return_to_training') };
}

export interface LifecycleGateway {
  getLifecycleSnapshot(enrollmentId: string): Promise<LifecycleSnapshot>;
  applyLifecycleAction(input: Command<{ enrollmentId: string; action: LifecycleAction; reason: string }>): Promise<Result<Enrollment>>;
}

export const stageLabels: Record<Lifecycle, string> = {
  pre_ojt: 'Pre-OJT', during_ojt: 'During OJT', post_ojt: 'Post-OJT', portfolio: 'Portfolio Completion', completed: 'Completed',
};
