/** Integration boundary. Supabase implementation is intentionally pending. */
export type Role = 'student' | 'adviser' | 'coordinator';
export type Lifecycle = 'pre_ojt' | 'during_ojt' | 'post_ojt' | 'portfolio' | 'completed';
export type Clearance = 'not_issued' | 'active' | 'suspended' | 'revoked';
export const moaStatuses = ['SAS COPY SUBMITTED', 'SIGNED AND NOTARIZED', 'FOR NOTARIZATION', 'IN-PROCESS FOR REVISION', 'IN-PROCESS FOR REVIEW OF ULCO', 'FOR COMPANY REVIEW', 'NO MOA'] as const;
export type MoaStatus = typeof moaStatuses[number];
export type SubmissionStatus = 'draft' | 'submitted' | 'under_review' | 'needs_revision' | 'approved' | 'rejected' | 'superseded' | 'withdrawn';
export type ErrorCode = 'unauthenticated' | 'forbidden' | 'validation' | 'conflict' | 'policy_blocked' | 'open_session' | 'unavailable' | 'upload_failed';

export interface Actor { id: string; role: Role; active: boolean; programIds: string[]; }
export interface Enrollment {
  id: string; studentId: string; programId: string; termId: string; policyVersionId: string;
  component: number;
  lifecycle: Lifecycle; clearance: Clearance; revision: number;
  requiredMinutes: number; creditedMinutes: number; outcome: 'active' | 'completed' | 'withdrawn';
}
export interface Command<T> {
  /** UUID, scoped to authenticated actor; reused only for identical retries. */
  commandId: string;
  expectedRevision: number;
  payload: T;
}
export type Result<T> = { ok: true; data: T; revision: number; commandId: string } |
  { ok: false; code: ErrorCode; message: string; correlationId: string; currentRevision?: number; blockingReasons?: string[] };
export interface GpsEvidence {
  latitude: number; longitude: number; accuracyMeters: number; capturedAt: string;
}
export interface StoredDocument {
  id: string; originalName: string; mimeType: string; bytes: number;
  status: 'pending' | 'validated' | 'quarantined' | 'attached';
  /** Storage identifier, never a permanent public or signed URL. */
  objectPath: string;
}
export interface ReviewInput {
  enrollmentId: string; submissionVersionId: string;
  expectedSubmissionRevision: number; role: 'adviser' | 'coordinator';
  decision: 'approved' | 'needs_revision' | 'rejected'; remarks: string;
}
export interface Page<T> { items: T[]; nextCursor: string | null; }
export interface InTrackGateway {
  getEnrollment(id: string): Promise<Enrollment>;
  listReviewQueue(input: { cursor?: string; programId?: string; requirementId?: string }): Promise<Page<{ enrollmentId: string; submissionVersionId: string }>>;
  reserveUpload(input: Command<{ enrollmentId: string; requirementId: string; originalName: string; mimeType: string; bytes: number }>): Promise<Result<{ document: StoredDocument; uploadToken: string }>>;
  submitRequirement(input: Command<{ enrollmentId: string; requirementId: string; documentId: string }>): Promise<Result<{ submissionVersionId: string }>>;
  reviewRequirement(input: Command<ReviewInput>): Promise<Result<{ submissionVersionId: string; status: SubmissionStatus }>>;
  clockIn(input: Command<{ enrollmentId: string; placementId: string; gps: GpsEvidence }>): Promise<Result<{ sessionId: string; clockInAt: string }>>;
  clockOut(input: Command<{ enrollmentId: string; sessionId: string; gps: GpsEvidence }>): Promise<Result<{ sessionId: string; clockOutAt: string }>>;
  getDocumentDownload(documentId: string): Promise<{ signedUrl: string; expiresAt: string }>;
}
