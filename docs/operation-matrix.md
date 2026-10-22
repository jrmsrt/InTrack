# InTrack operations and permissions

These rules define the live backend contract. The existing prototype does not enforce all of them. Every write has an authenticated actor, active profile, program/assignment scope, command UUID, expected revision, valid previous state, and a transaction containing the change, audit event, command receipt, and notification outbox where relevant. Browser-supplied actor IDs or roles are ignored.

## Roles and read access

| Data | Student | Adviser | Coordinator |
| --- | --- | --- | --- |
| Enrollment and placement | Own records | Currently assigned enrollments | Assigned programs |
| Requirement evidence and versions | Own records | Current assignments where reviewer is authorized | Assigned programs |
| Attendance, DTR, journals, evaluations, portfolio | Own records | Current assignments | Assigned programs |
| Company list | Published eligible companies; assigned placement details | Published eligible companies and assigned placements | Assigned-program administration |
| Other user profiles | Own profile and relevant assigned staff contact details | Assigned students and relevant staff contact details | Scoped administrative directory |
| Masterlist/import records | No direct access | No direct access | Assigned programs |
| Templates and policies | Published versions relevant to enrollment | Published versions for assignments | Scoped drafts and published versions |
| Messages | Participant and permitted enrollment scope | Participant and current assignment | Participant and permitted program scope |
| Notifications | Own recipient rows | Own recipient rows | Own recipient rows |
| Audit history | Own user-facing timeline | Assigned enrollment review timeline | Assigned-program administrative history |
| Command receipts and delivery outbox | No direct table access | No direct table access | No direct table access |

The trusted backend reads its own private operational tables. It exposes filtered results, never service-role table dumps. No role obtains passwords or OTP data. Privacy acknowledgments are self-readable; staff reporting exposes acknowledgment status only when justified by policy.

## Account and configuration operations

| Operation | Actor and scope | Rules and result |
| --- | --- | --- |
| Import masterlist | Coordinator, assigned program | Dry run first; normalized email and student-number uniqueness; no account passwords; audited batch |
| Invite Student/Adviser | Coordinator, assigned program | Student eligibility or approved staff identity; exact reserved email; server-only Auth invitation; reconciled retries |
| Change Student/Adviser membership | Coordinator, assigned program | Other profiles only; cannot grant Coordinator, change own memberships, or extend scope; reason and revision |
| Revoke/restore program access | Coordinator, assigned program | Other Student/Adviser memberships only; reason required; other program memberships unchanged |
| Provision Coordinator; suspend/reactivate/archive entire profile; relink Auth identity | Trusted administrative operator | Approved administrative process outside ordinary application roles; reason and audit; no automatic clearance restoration |
| Edit profile contact/display fields | Self | Allowlisted fields only; student number, role, program, and hours are not self-editable |
| Publish policy/requirements/templates | Coordinator within program | Draft validated; year/semester and official settings confirmed; publish immutable version; old enrollments unchanged |
| Amend enrollment policy | Coordinator within program | Explain impact; new snapshot/version; notify affected student/adviser; preserve original |
| Create enrollment | Coordinator within program | Student membership, term, component, confirmed policy, attempt uniqueness; no guessed hours |
| Assign/reassign adviser | Coordinator within program | Adviser active and eligible; end previous assignment and create history; previous adviser loses read scope |
| Place/transfer student | Coordinator within program | Valid company, dates, geofence/schedule; one active placement; preserve prior sessions and credits; clearance reissued for new placement |

## Evidence and review operations

| Operation | Actor and scope | Rules and result |
| --- | --- | --- |
| Reserve upload | Student owns enrollment; staff only for authorized evidence workflows | Type/size/requirement permitted; random immutable path; expiring reservation |
| Finalize upload | Reservation owner | Validate actual bytes and hash; same enrollment; only validated evidence becomes attached |
| Submit requirement | Student owns enrollment | New version; configured evidence type; prior version immutable; policy defines whether submission remains open in later stages |
| Withdraw submission | Student owns enrollment | Submitted and not under review; audit; does not delete prior evidence |
| Start/review submission | Configured reviewer and correct assignment/program | Review current version against expected revision; no self-review; reasons for revision/rejection |
| Revoke approval | Coordinator within program | Reason, affected version, impact assessment; explicit clearance/completion event if affected; no history deletion |
| Waive requirement | Coordinator within program | Reason, evidence, date, actor; explicit waiver event; subject to institutional rules |
| Route/accept MOA | Coordinator within program only | Exact version and one of seven statuses; SAS COPY SUBMITTED requires the signed and notarized copy to have been submitted to SAS; student uploads cannot change routing |
| Issue/suspend/revoke clearance | Coordinator within program | Conditions from specification; reason and effective date; attendance uses current authority |
| Download evidence | Reader authorized for record | Short-lived signed URL; no permanently public bucket; current access checked |

## Attendance operations

| Operation | Actor and scope | Rules and result |
| --- | --- | --- |
| Clock in | Student owns active enrollment | Current placement/clearance; server time; schedule; usable GPS; no open session; failure writes attempt only |
| Clock out | Student owns exact session | Same active session ID; server time; GPS or explicit approved exception; failed checkout does not alter session |
| Request correction | Student owns session | Reason/evidence; requested interval valid; no duplicate pending request against same revision |
| Decide correction | Assigned adviser | No self-review; current revision; immutable correction history; approved DTR credit invalidated atomically if affected |
| Approve remote/off-site exception | Coordinator within program | Placement, dates, conditions and evidence; no unlimited simulation bypass |
| Generate DTR | Student owns enrollment | Frozen session revisions and period; unresolved records visibly excluded or block submission according to published policy |
| Submit DTR | Student owns current draft | Snapshot validated; required sessions resolved; no client-supplied credited total |
| Review DTR | Assigned adviser | Version and source revisions current; approval allocates approved minutes once; changes require rereview |
| Override hours | Coordinator within program | No direct total edit; authorized correction/credit adjustment event with evidence and impact history |

## Academic work and communication

| Operation | Actor and scope | Rules and result |
| --- | --- | --- |
| Save/edit task draft | Student owns enrollment | Draft only; validate dates and fields; delete draft allowed |
| Submit/revise task | Student owns enrollment | Submitted content immutable; revision creates new version |
| Review task/journal | Assigned adviser | Exact version; rubric/requirement rules; reasons for revision |
| Submit journal | Student owns enrollment | Correct week; frozen task references; attendance references; hours not derived from narrative |
| Submit evaluation evidence | Student owns enrollment or assigned adviser | Published rubric; external signed evidence where required; evaluator attribution preserved |
| Review evaluation | Assigned adviser | Score bounds and totals validated server-side; rubric version stored; no student self-approval |
| Submit portfolio | Student owns enrollment | Immutable manifest; mandatory evidence and approved source versions present |
| Review portfolio | Assigned adviser, then coordinator within program | Separate decisions; exact manifest; revision creates new version |
| Advance/complete enrollment | Coordinator within program | Explicit blockers cleared; credited minutes sufficient; final event, summary, notifications |
| Reopen/withdraw enrollment | Coordinator within program | Reason and effective date; preserve outcome history and affected artifacts |
| Send message | Authorized participant | Active assignment/program relationship; payload size limit; sender identity from session |
| Publish announcement | Coordinator within program | Explicit program/term/role audience; archive rather than rewrite history |
| Mark notification/message read | Recipient | Allowlisted read timestamp only; cannot alter body, actor, or recipient |
| Acknowledge notice | Self | Published notice version; server time; distinct from optional processing consent |
| Search/report/export | Authorized scoped reader | Same scope as ordinary read; pagination; export minimization/audit; safe CSV values |

## Shared error and interface behavior

| Result | UI behavior |
| --- | --- |
| Loading | Skeleton/status; no sample records substituted for failed requests |
| No records | Explain next permitted action |
| Forbidden | Explain scope/clearance block without revealing other student records |
| Validation | Field-level explanation; retain input |
| Conflict | Refetch current version, explain change, allow deliberate resubmission |
| Upload pending | Show progress; do not claim submitted |
| Saved | Show server-confirmed timestamp/version |
| Delivery pending | Record is saved; email may be pending; in-app notification remains available |
| Network/service error | Retain draft, retry safely with same command ID |
| Account suspended | Clear cached protected data and show contact/recovery path |

## Existing prototype reconciliation

| Existing behavior | Required integration change |
| --- | --- |
| Browser accounts and OTP hashes | Supabase Auth; never migrate browser passwords |
| Generic MySQL auth/ojt snapshots | Specific transactional operations against relational records |
| Seed records injected on load | Explicit demo fixtures only; zero production reseeding |
| Single global sample hours setting | New IT fixtures use 500 hours; live records use published per-component hours and confirmed academic labels; reconcile old persisted snapshots |
| Stage recomputed from each checklist mutation | Explicit lifecycle events; separate deployment clearance |
| Failed clock-in stored as open attendance | Attempt table; open session only after successful validation |
| Dashboard mock GPS and GPS fallback | One shared live attendance operation; exceptions instead of mock fallback |
| Base64 document bytes in shared state | Private validated Storage objects and versioned metadata |
| MOA upload and review | Prototype uploads now queue separately and retain the last coordinator status; live integration must preserve immutable versions and enforce coordinator scope server-side |
| Success toast before save response | Await confirmed operation; display failure/conflict state |
| Static search/unread dot | Scoped search and real unread recipient rows |
| Huge context with synchronous mutations | Async gateway, record-level queries, domain-specific commands |

These are integration tasks, not claims that the legacy screens already follow the specification.
