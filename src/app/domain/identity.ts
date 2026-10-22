import type { Command, Result, Role } from './contracts.ts';

/** Prepared rules only: real authority must come from verified Auth and database records. */
export type ProfileStatus = 'invited' | 'active' | 'suspended' | 'archived';
export interface Membership { role: Role; programId: string; active: boolean; }
export interface IdentityContext {
  authUserId: string | null;
  emailVerified: boolean;
  assurance: 'aal1' | 'aal2';
  profile: { id: string; authUserId: string; status: ProfileStatus; activatedAt: string | null } | null;
  memberships: Membership[];
}
export type AccessDecision = { allowed: true } | { allowed: false; reason: 'sign_in' | 'not_provisioned' | 'verify_email' | 'activate' | 'suspended' | 'archived' | 'role_unavailable' | 'mfa_required' | 'out_of_scope' };

export function identityGate(identity: IdentityContext, role: Role): AccessDecision {
  if (!identity.authUserId) return { allowed: false, reason: 'sign_in' };
  if (!identity.profile || identity.profile.authUserId !== identity.authUserId) return { allowed: false, reason: 'not_provisioned' };
  if (identity.profile.status === 'suspended' || identity.profile.status === 'archived') return { allowed: false, reason: identity.profile.status };
  if (!identity.emailVerified) return { allowed: false, reason: 'verify_email' };
  if (identity.profile.status !== 'active' || !identity.profile.activatedAt || !Number.isFinite(Date.parse(identity.profile.activatedAt))) return { allowed: false, reason: 'activate' };
  if (!identity.memberships.some(item => item.active && item.role === role)) return { allowed: false, reason: 'role_unavailable' };
  if (role !== 'student' && identity.assurance !== 'aal2') return { allowed: false, reason: 'mfa_required' };
  return { allowed: true };
}

export function enrollmentAccess(identity: IdentityContext, role: Role, enrollment: { programId: string; studentId: string; currentAdviserId: string | null }): AccessDecision {
  const gate = identityGate(identity, role);
  if (!gate.allowed) return gate;
  if (!identity.memberships.some(item => item.active && item.role === role && item.programId === enrollment.programId)) return { allowed: false, reason: 'out_of_scope' };
  const profileId = identity.profile!.id;
  const allowed = role === 'student' ? enrollment.studentId === profileId :
    role === 'adviser' ? enrollment.currentAdviserId === profileId : true;
  return allowed ? { allowed: true } : { allowed: false, reason: 'out_of_scope' };
}

/** Coordinators manage other student/adviser memberships only within their scope. */
export function canManageMembership(identity: IdentityContext, target: { profileId: string; role: Role; programId: string }): boolean {
  return identityGate(identity, 'coordinator').allowed && identity.profile!.id !== target.profileId && target.role !== 'coordinator' &&
    identity.memberships.some(item => item.active && item.role === 'coordinator' && item.programId === target.programId);
}

export interface MasterlistRow { studentNumber: string; email: string; name: string; programId: string; section: string; }
export interface ImportIssue { row: number; field: string; message: string; }
export function validateMasterlist(rows: MasterlistRow[], allowedProgramIds: string[], existing: Pick<MasterlistRow, 'studentNumber' | 'email'>[] = [], approvedEmailDomains: string[] = []): { valid: boolean; rows: MasterlistRow[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const seenNumbers = new Set<string>(), seenEmails = new Set<string>();
  const normalizedExisting = existing.map(item => ({ studentNumber: item.studentNumber.trim().toUpperCase(), email: item.email.trim().toLowerCase() }));
  const normalized = rows.map((item, index) => {
    const row = { studentNumber: item.studentNumber.trim().toUpperCase(), email: item.email.trim().toLowerCase(), name: item.name.trim(), programId: item.programId.trim(), section: item.section.trim() };
    const issue = (field: string, message: string) => issues.push({ row: index + 1, field, message });
    if (!row.studentNumber || row.studentNumber.length > 40) issue('studentNumber', 'A student number of at most 40 characters is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) || !approvedEmailDomains.includes(row.email.split('@')[1])) issue('email', 'Use an institution-approved student email domain.');
    if (!row.name) issue('name', 'Name is required.');
    if (!row.section) issue('section', 'Section is required.');
    if (!allowedProgramIds.includes(row.programId)) issue('programId', 'Program is outside the importing coordinator scope.');
    if (seenNumbers.has(row.studentNumber)) issue('studentNumber', 'Duplicate student number in this batch.');
    if (seenEmails.has(row.email)) issue('email', 'Duplicate email in this batch.');
    seenNumbers.add(row.studentNumber); seenEmails.add(row.email);
    if (normalizedExisting.some(item => (item.studentNumber === row.studentNumber && item.email !== row.email) || (item.email === row.email && item.studentNumber !== row.studentNumber))) issue('identity', 'Existing number/email association conflicts; resolve it explicitly.');
    return row;
  });
  if (!rows.length) issues.push({ row: 0, field: 'batch', message: 'The import batch is empty.' });
  return { valid: issues.length === 0, rows: issues.length ? [] : normalized, issues };
}

export interface InvitationRecord {
  id: string; profileId: string; revision: number;
  state: 'reserved' | 'sent' | 'delivery_failed' | 'accepted' | 'revoked';
  expiresAt: string | null;
}
/** Contract only. Server scope and current database records must validate each operation. */
export interface IdentityGateway {
  getIdentity(): Promise<IdentityContext>;
  dryRunMasterlist(rows: MasterlistRow[]): Promise<{ validationToken: string; expiresAt: string; newCount: number; existingCount: number; issues: ImportIssue[] }>;
  commitMasterlist(input: Command<{ validationToken: string }>): Promise<Result<{ batchId: string; imported: number; unchanged: number }>>;
  inviteStudent(input: Command<{ eligibleStudentId: string }>): Promise<Result<InvitationRecord>>;
  inviteAdviser(input: Command<{ programId: string; approvedEmail: string; displayName: string }>): Promise<Result<InvitationRecord>>;
  resendInvitation(input: Command<{ invitationId: string }>): Promise<Result<InvitationRecord>>;
  setMembershipActive(input: Command<{ membershipId: string; active: boolean; reason: string }>): Promise<Result<{ membershipId: string; active: boolean }>>;
  // Credential setup uses a separate Auth orchestration endpoint: passwords never enter Command receipts.
}
