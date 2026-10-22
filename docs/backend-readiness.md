# InTrack backend preparation

InTrack uses local Supabase PostgreSQL, Supabase Auth, private Supabase Storage, and trusted server operations for administrative changes. This specification separates implemented engineering, remaining implementation, and university decisions. Normal login, OTP, password decision, and coordinator Student/Adviser Management now use real Supabase services; other domain screens still need their adapters. Production pilot readiness remains blocked until integration acceptance and institutional decisions are complete.

**Current checkpoint — October 16, 2026:** migrations 033–035 are applied locally and public types regenerated. The original login layout is preserved. Student/Adviser Management now enforce real scoped coordinator identity/MFA, validated masterlist provisioning, safe retries and revisioned access changes; adviser contacts/sections persist. Owner-approved local domains are configured. The owner-authorized synthetic coordinator recovery invalidated old sessions and reset its old authenticator; owner reports setup complete and one verified factor was confirmed. All 174 automated tests and frontend build passed. Authenticated portal acceptance and a newly provisioned user's complete email/activation acceptance remain unverified. Local `dev-test-only` notice text is explicitly development-only, with no institutional approval implied. See `local-backend-workspaces.md` for the current setup; older dated implementation notes below are historical where superseded.

## Implementation status as of October 14 2026

Forward migrations through `202610140032` are applied to local Supabase. The frozen baseline remains unchanged. `docs/integration-checklist.md` tracks executed tests separately from deployed code and university confirmation.

| Area | Current implementation | Still required |
| --- | --- | --- |
| Identity | Bootstrap, protected identity/activation, staff MFA, invitations/memberships/notices/recovery, signup-blocked Supabase email OTP, real Auth/Mailpit acceptance and configured Brevo SMTP with owner-confirmed Outlook Inbox delivery | University sending-domain approval, cloud SMTP deployment, invitation/MFA/browser/expiry acceptance, provider resend/invalidation, formal MFA/operator recovery and approved email domains |
| Imports and policy | Actor-bound masterlist dry run/atomic commit, duplicate/conflict detection, immutable policy publication, explicit occurrences, enrollment snapshots and current adviser assignment | Program applicability/reviewers/deadlines for the supplied portfolio list, calendar/attendance settings, official rubric inputs and enrollment amendments |
| Evidence and MOA | Private immutable evidence, measured signatures/size/SHA-256, sequential/physical reviews, seven MOA states/SAS checks; private PDF template versions/downloads and confirmed expiry cleanup | Real browser/Storage tests, DOCX validation and operational malware scanning |
| Enrollment | Shared scoped projection, approved placement configuration, explicit waivers, clearance issue/resume/suspend/revoke, Post-OJT/Portfolio entry, withdrawal/return to training and explicit completion/reopen | Real independent-connection and Auth/browser finalization acceptance |
| Attendance and academics | Server-time punches, scoped exceptions, historical closeout, correction/reconstruction/void, configured DTR snapshots, historical-clearance checks and capped credit, task/journal versions, published rubrics and verified evaluations, frozen portfolio manifests, completion/reopen summaries, specialized requirement bindings and approval revocation | Official occurrence/attendance/rubric configuration, broader reviewer plans where institutionally needed, real concurrent/JWT/Storage/browser acceptance and production adapters |
| Communications | Participant messages, scoped announcements, persistent unread state, workflow notices, enrollment search/pagination and audited CSV exports | Notification email/outbox worker (delivery paused), other artifact search/exports and complete production UI integration |
| Operations | Environment synchronization, evidence upload cleanup, asset inventory/backup tooling, verified isolated restoration of 99 tables, independent template command races, shared successful-command burst control and operator aggregate health | File-object/service and independent-host recovery, attendance/review/credit races, approved recovery/retention/region, edge/Auth throttling, service alerts and staging/pilot acceptance |

The local workspaces are `/?authSetup=1`, `/?requirementsTest=1`, `/?backendTest=1`, `/?trainingTest=1`, and `/?templatesTest=1`. They are available only in development against local Supabase. They do not mount the demo Auth/OJT providers. Run `npx supabase functions serve` for activation, validated evidence/template finalization/download and invitation delivery.

The owner-provided coordinator portfolio contents are recorded in `coordinator-portfolio-template.md` and an additive application catalog. This supplies content coverage, not reviewer/deadline/attendance configuration or a published database policy.

Confirmed program labels now include BSOA: 300 hours in 2nd year/2nd semester and 300 hours in 4th year/2nd semester. This updates the application catalog and unconfirmed BSOA database policies through migration `202610140006`; it does not publish attendance or requirement settings.

## Part 1 Backend choice and boundaries

Architecture decisions are finalized for release one. Implementation, deployment, and verification remain tracked in the integration checklist. The selected backend is Supabase PostgreSQL, Supabase Auth, private Supabase Storage, and TypeScript Edge Functions. Keep the current React/Vite frontend. No additional database platform, custom password service, ORM, or separate FastAPI application is needed for the live release.

Supabase provides the relational database, Auth, and Storage capabilities used by this design. Their availability does not automatically secure InTrack: application authorization, workflow validation, and deployment configuration still require implementation. See [database overview](https://supabase.com/docs/guides/database/overview), [Auth profiles](https://supabase.com/docs/guides/auth/managing-user-data), and [Storage access control](https://supabase.com/docs/guides/storage/security/access-control).

### Component responsibilities

| Component | Settled responsibility |
| --- | --- |
| React/Vite | Render scoped records, validate for user feedback, retain drafts, send asynchronous commands, and display confirmed results |
| Supabase Auth | Invitations, identity, credentials, verified email, recovery, sessions, and staff MFA |
| PostgreSQL | Relationships, immutable versions, workflow invariants, approved minutes, transactions, revisions, audit events, and command receipts |
| Row Level Security | Filter reads by active application profile, ownership, current adviser assignment, and coordinator program scope |
| Private Storage | Actual document bytes, immutable upload paths, permitted access, and expiring download links |
| Edge Functions | Validate authenticated requests, enforce request limits, validate files, orchestrate database commands, and handle privileged account administration |
| Notification worker | Deliver committed outbox events with safe retries; email failure does not undo a review |

React and its shared policy helpers are not an authority boundary. A hidden button, selected login role, local-storage account, or client-calculated total never grants access or determines an official record.

### Identity and permissions

Auth establishes the caller's identity. Application profiles and memberships establish the caller's Student, Adviser, or Coordinator authority. There is no company-supervisor application role. Resolve the verified Auth user ID to the active application profile before protected reads and commands; `profiles.id` and `auth_user_id` are different identifiers in the blueprint. Never trust an actor ID, role, program, or approval flag supplied in a request or editable Auth user metadata.

Student access is limited to their own enrollments. Adviser access is limited to current assignments. Coordinator access is limited to assigned programs. Suspended profiles fail protected access even if the Auth token has not expired. The initial coordinator is created through a trusted administrative setup process, not browser self-registration. Open public sign-up is disabled.

### Read and command paths

Implemented local read path: signed-in React client → named public projection RPC → current Auth/profile/notice/membership/assignment checks → private domain records. These reviewed SECURITY DEFINER projections use a fixed empty search path, explicit scope checks and narrow execution grants. Domain tables remain in the unexposed `intrack` schema with client table access denied. No blanket SELECT grant is added. This deliberately replaces the initial view-first implementation plan. If read views are introduced later, use `security_invoker = true` with explicit underlying RLS and column grants; passing projection tests does not validate a new view. See [safe views](https://supabase.com/docs/guides/database/postgres/row-level-security#expose-a-view-safely) and [function security](https://supabase.com/docs/guides/database/functions#secure-a-database-function).

Implemented command path: React gateway → caller-scoped PostgreSQL RPC → protected domain transaction. Auth invitation delivery and private file validation/download additionally use authenticated Edge orchestration. The caller's verified JWT carries normal submissions, reviews and clearance authority; service credentials are limited to Auth administration, measured file attestation and recovery workers. Direct RPC calls receive the same scope/state/revision checks. See [Edge Function user authentication](https://supabase.com/docs/guides/functions/auth).

Every domain command independently checks the active profile, role, record scope, valid prior state, command ID, and expected revision inside its database transaction. Public wrappers may be called directly: skipping an Edge Function must not skip those checks. The Edge Function handles HTTP validation and external services; database checks own authoritative state and concurrency.

Domain functions that require privileged writes live in the unexposed schema, use a fixed empty search path with fully qualified relations, and have explicit execute grants. Revoke default execute from PUBLIC and anon. Grant only named authenticated entry points and their required internal delegates. A SECURITY DEFINER function may bypass table RLS, so its explicit actor and scope checks are mandatory, not optional. Read functions use invoker security wherever possible. See [function security and privileges](https://supabase.com/docs/guides/database/functions#secure-a-database-function).

### Transactions and external services

One data-changing command commits its record changes, version/review events, audit events, idempotency receipt, and notification outbox rows together. Lock the affected aggregate, reject stale revisions, and return the current revision on conflict. Identical retries return the stored receipt; a reused command ID with a different payload is rejected. The UI shows success only after a confirmed result.

Database transactions cannot atomically include an Auth invitation, file upload, or email delivery. Treat those as staged external operations with recorded status, retries, and cleanup. Uploads reserve an immutable object path, validate stored bytes, then finalize the database submission. Email is delivered from a committed outbox. Auth invitation orchestration records success/failure and prevents duplicate accounts without pretending to roll back an already sent invitation.

### Confirmed domain constraints

Store the owner-supplied program requirements as per-component policy records, not one global hours setting: BSIT 500 hours in 4th year/2nd semester; BSHM 300 hours in 2nd-year summer and 600 hours in 4th year/2nd semester; BSCPE 300 hours in each of 2nd-year and 3rd-year summer; BSOA 300 hours in each of 2nd-year/2nd semester and 4th-year/2nd semester. Freeze the published policy version on enrollment. Required and credited totals use integer minutes, with timestamps stored as `timestamptz` and attendance dates interpreted in Asia/Manila.

MOA status is coordinator-controlled and uses exactly seven states: NO MOA, FOR COMPANY REVIEW, IN-PROCESS FOR REVISION, IN-PROCESS FOR REVIEW OF ULCO, FOR NOTARIZATION, SIGNED AND NOTARIZED, and SAS COPY SUBMITTED. A student upload does not change the coordinator's status. SAS COPY SUBMITTED records submission of the signed and notarized copy to SAS; it requires that copy's notarization to be confirmed first. Both accepted states preserve MOA eligibility. Deployment clearance remains an explicit, separate coordinator decision; automatic client-side stage changes cannot grant it.

### Keys environments and release boundaries

React receives only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Publishable keys do not identify an authorized student or staff member; access still requires an authenticated session and scope checks. Secret/admin keys stay in server secrets and are reserved for authorized Auth administration and background workers. They never appear in Vite variables, browser bundles, fixtures, or committed configuration. See [API keys](https://supabase.com/docs/guides/getting-started/api-keys).

Use local Supabase development with synthetic users, followed by separate staging and production projects. Keep the SQL blueprint as a reference until it runs successfully in isolation; then promote validated changes to timestamped migrations and generate TypeScript database types. The project region, public application URL, email sender, and university retention/recovery settings are deployment inputs, not guessed architecture decisions.

Keep `VITE_BACKEND_MODE=demo` until the live adapter and integration gates pass. Supabase mode remains blocked by the existing pending-integration screen. Retire the MySQL/FastAPI API and browser authentication from the live path. Never migrate `app_state` snapshots, browser passwords, or automatically seeded approvals into real enrollments. Realtime and offline attendance are deferred; confirmed command responses and scoped refetches are sufficient for release one.

### Part 1 completion criteria

The stack, component boundaries, identity source, three-role scope, private schema/API exposure strategy, authenticated command path, transaction model, key handling, confirmed domain constraints, and migration approach are settled. No cloud project has been created or changed, and no live backend capability is claimed here. Part 2 defines the identity and invitation workflows in implementation detail; the integration checklist tracks the work needed to make this architecture operational.

## Part 2 Release scope and identity

Release one supports Student, Adviser, and Coordinator. The project owner confirmed there is no company-supervisor role. Where a requirement calls for a company evaluation, signed evidence is uploaded and reviewed by the existing roles. No supervisor invitation, login, or portal is planned.

### Authority and account states

One person has one application profile linked to one Auth UUID. The profile UUID identifies students, reviewers, and audit actors; the Auth UUID establishes the session identity. The same profile may have multiple protected program memberships. Role selection changes the working interface only among those memberships. Never derive authority from the selected tab, request actor ID, email domain, or editable Auth metadata.

| Record | States and meaning |
| --- | --- |
| Profile | Invited: setup incomplete; Active: setup completed; Suspended: all protected access denied; Archived: retained historical identity with no protected access |
| Membership | Active or revoked, independently for each role/program |
| Invitation | Reserved, Sent, Delivery failed, Accepted, Revoked; expired links require a new delivery attempt and remain unusable |

Activation requires a verified Auth identity linked to the reserved profile, successful credential setup, and acknowledgment of the currently published privacy notice. Store server-recorded `activated_at`; a client boolean cannot activate an account. Notice acknowledgment is separate from optional consent. Invitation acceptance never creates an enrollment, approves evidence, credits hours, or issues clearance.

Students read their own enrollments. Advisers read only current assignments in their permitted programs. Coordinators administer their assigned programs. Staff reads and writes require Supabase MFA assurance `aal2`, in addition to active profile and membership checks. Students may use `aal1`. Before staff MFA completion, allow only narrowly scoped identity/setup operations, never student records. See [Supabase MFA assurance levels](https://supabase.com/docs/guides/auth/auth-mfa).

### Masterlist and invitations

Disable open public sign-up in Supabase configuration and remove registration from the live UI. Import an approved student masterlist before inviting students. Required columns are student number, complete display name, approved email, program, and section. Preserve complete names; do not guess first/last-name splits. Trim fields, uppercase student numbers, lowercase emails, and check program scope, nonempty required fields, batch duplicates, and existing identity associations. Student and staff email-domain allowlists are deployment configuration that must be confirmed; the prototype student domain is not institutional authorization by itself.

The coordinator first requests a dry run. It returns row-level errors, new/existing counts, and a server-issued validation token bound to normalized content, actor, scope, and expiry. Store normalized rows in a private short-lived import preview; tokens reference that preview without exposing spreadsheet content. Commit rechecks current records and scope in one transaction; stale or changed content needs a new dry run. Reject an invalid batch as a whole. An exact existing student-number/email association is a no-op, not permission to overwrite name, program, or section. Conflicting mappings require an explicit audited identity correction. Keep the batch summary and actor, and remove expired/consumed preview payloads under a configured cleanup schedule.

Student invitations reference an eligible record ID, not arbitrary client-supplied roles or emails. Adviser invitations require an approved staff email and the coordinator's program scope. For an already linked active profile, an authorized additional membership uses that identity; it never creates another account or resets credentials. Ordinary coordinators can create or revoke other Student/Adviser memberships within their programs; they cannot change their own memberships, create Coordinators, or extend coordinator authority. Initial and additional Coordinators are provisioned by a trusted administrative operator after approval. This operational responsibility is not a fourth application role.

The invitation operation reserves the profile, membership, and delivery record, then uses the server-only Auth Admin invitation API. Link only the expected verified Auth identity to the reserved profile. Do not reuse an existing Auth account merely because a browser reports a matching email. See [Auth Admin invitations](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail). Store delivery attempts, provider outcome, revision, and a correlation ID; never store invitation tokens or temporary passwords in application records. Limit resend frequency. One active invitation per profile avoids competing links; an intentional resend retires the preceding delivery record. Provider link invalidation/expiry must also be implemented and tested, rather than inferred from the database status.

Auth creation and mail delivery are external operations: a lost response may already have sent an invitation. Reconcile the reserved identity against Auth before retrying; do not create a second profile or promise exactly-once email. A delivery failure leaves the profile Invited and retryable. Returning coordinators receive delivery status, never credentials or setup links. Auth/Admin keys remain confined to this privileged operation.

### Activation sign-in and recovery

1. The recipient follows an approved invitation redirect and establishes the verified Auth session. Reject revoked/expired or mismatched invitations.
2. A narrowly scoped authenticated setup endpoint receives the chosen password over TLS and updates credentials through Supabase Auth. Do not log, hash into command receipts, queue, or persist the password in InTrack. Password policy is configured in Auth.
3. After Auth confirms credential setup, the trusted setup operation commits notice acknowledgment and activation against the reserved identity. Its database entry point is server-only and verifies the invitation/profile state. A partial failure leaves setup incomplete and safely retryable; successful password setup alone does not grant application access.
4. Staff enroll and verify MFA before accessing staff records. Student and staff destinations are selected only from active database memberships. Multiple available roles require an explicit role choice.

Sign-in uses Supabase Auth and a fresh protected identity lookup. Show Loading, Signed out, Setup required, MFA required, Ready, Disabled, or Unavailable explicitly. Failed profile reads never substitute demo records. Clear cached scoped records on sign-out, Auth identity changes, and loss of authority. Use the Auth SDK for session handling; no custom password/OTP storage. Recheck application status, scope, and staff assurance in database reads and commands, including direct RPC calls.

Password recovery uses approved redirects, rate limits, and a generic response that does not reveal account existence. Recovery changes credentials; it does not create memberships, activate an unfinished invitation, or reactivate a suspended profile. MFA recovery requires a trusted administrative identity-verification process. Do not email a shared/default password. Configure SMTP, redirect allowlists, link expiry, password policy, and resend limits before staging. See [Auth configuration](https://supabase.com/docs/guides/auth/general-configuration).

### Suspension reassignment and history

A scoped coordinator revokes or restores other Student/Adviser memberships only in their program, with a reason and expected revision. This cannot disable memberships belonging to another program. Global profile suspension/reactivation, coordinator membership changes, Auth email relinking, and account archival use the trusted administrative process with recorded authority and reason. Reactivation restores neither revoked memberships nor previously revoked clearance automatically.

Suspended/archived profiles and revoked memberships fail protected access even with an unexpired token. Adviser reassignment immediately removes the previous adviser's enrollment read scope while preserving historical attribution. Keep historical records; deletion/anonymization awaits an approved retention process. Previously downloaded files cannot be recalled; use short-lived download links and minimize cached sensitive data.

### Part 2 completion criteria

The account contracts and scope boundaries are specified. Local migrations implement protected identity, imports, reservations/linking, activation, staff MFA and Student/Adviser membership changes. Local recovery changes credentials without restoring application authority. The legacy demo remains separate. Intentional resend/provider invalidation, verified-factor administrative recovery, real-JWT/Mailpit failure tests, staging SMTP, approved domains and operational settings remain incomplete.

## Part 3 OJT lifecycle and clearance

The rules below define the engineering workflow for release one. BSOA term labels are confirmed. Portfolio content coverage is supplied in `coordinator-portfolio-template.md`; program applicability, reviewers/deadlines, attendance settings and placements must be confirmed and published before clearance is available.

### Enrollment identity and displayed state

Create one enrollment per student, academic term, practicum component, and attempt, with a frozen published policy version. A new policy version cannot create a second enrollment for the same attempt. Components remain separate: the two BSHM, BSCPE, and BSOA hour requirements never share one combined progress counter. An enrollment may have multiple sequential placements, but only one active placement at a time. Retry attempts create new enrollments; old ones remain readable under their access policy. Approved transfer hours are attributed to the originating placement and credited once to the enrollment. Cross-enrollment credit requires a separately approved institutional transfer policy and is deferred.

Lifecycle stages are Pre-OJT, During OJT, Post-OJT, Portfolio Completion, and Completed. Completed is a terminal outcome after explicit coordinator finalization, not a percentage inferred from file counts. Withdrawn is a separate outcome. The four working stages remain suitable for the current sidebar.

Deployment clearance is separately Not issued, Active, Suspended, or Revoked. Moving stages does not grant clearance. Requirements and MOA revisions do not silently revoke it. The coordinator must issue or suspend clearance explicitly, with a reason, actor, timestamp, and effective date. The UI shows the current stage, clearance status, and blocking reasons independently.

The dashboard, sidebar, MOA page, and attendance screen read one enrollment projection. Stage progress counts four working stages; Completed displays a separate completed outcome. Rendered/approved hours come from credited minutes, remaining hours are `max(0, required - credited)`, and extra hours do not bypass evidence approval. Pending attendance is shown separately. Never infer lifecycle from the page route, MOA label, checklist percentage, or hours alone.

### Named coordinator actions

| Transition or action | Required conditions | Authority |
| --- | --- | --- |
| Issue clearance and enter During OJT | Active enrollment and placement; complete configured Pre-OJT approvals; final MOA accepted; confirmed policy settings | Coordinator |
| Record attendance | Active clearance and placement; enrollment in During OJT; placement date and work schedule valid | Student command validated by server |
| Enter Post-OJT | Required credited hours reached; required During-OJT items approved; no unresolved attendance or review disputes | Coordinator |
| Enter Portfolio Completion | Required Post-OJT items and evaluations approved | Coordinator |
| Complete enrollment | Required portfolio approvals; complete mandatory items; required credited hours; no unresolved disputes | Coordinator |
| Suspend clearance | Explicit documented issue, such as expired agreement or unsafe placement | Coordinator |
| Reopen completed work | Reason and impact assessment; versioned correction; never overwrite history | Coordinator |

All actions require an active, verified coordinator profile, staff MFA, program scope, no self-approval, a nonempty reason, and the expected enrollment revision. These are database checks even when a public RPC is called directly. Student/adviser roles can submit/review evidence but cannot run stage actions.

| Command | Allowed prior state | Result and additional rules |
| --- | --- | --- |
| Issue clearance | Active enrollment in Pre-OJT or During OJT; clearance Not issued or Revoked | Validate confirmed policy, placement/schedule, accepted MOA version, configured Pre-OJT evidence, and no open sessions/disputes; enter During OJT with Active clearance in the same transaction |
| Suspend clearance | During OJT with Active clearance | Immediate suspension; stage/history unchanged; can proceed even with an open session |
| Resume clearance | During OJT with Suspended clearance | Recheck issuance conditions and identical placement/MOA basis; a changed basis requires revoke then new issuance |
| Revoke clearance | Active enrollment with Active/Suspended clearance | Stop new attendance; preserve prior evidence and credits |
| Enter Post-OJT | During OJT | Require credited minutes at target, resolved configured During-OJT evidence, zero open sessions/disputes; revoke remaining attendance authority atomically |
| Enter Portfolio Completion | Post-OJT | Require resolved configured Post-OJT evidence/evaluations and zero open sessions/disputes |
| Complete | Portfolio Completion | Recheck required minutes, mandatory evidence across all stages, both portfolio approvals, and zero open sessions/disputes; store completed time and revoke attendance authority |
| Return to training | Active Post-OJT/Portfolio Completion | Record deficit/impact reason; return to During OJT with Revoked clearance; new clearance required before attendance |
| Reopen completion | Completed | Return to Portfolio Completion with Active outcome and Revoked clearance; retain the old finalization event and summary; renewed completion requires new portfolio decisions |
| Withdraw | Any active working stage | Terminal Withdrawn outcome; retain last stage; revoke clearance immediately, preserve unresolved sessions for authorized resolution |

No stage skipping, arbitrary set-stage command, automatic completion, or reopening a withdrawn attempt exists. A new attempt is a new enrollment. A completed enrollment needing additional training first reopens to Portfolio Completion, then uses Return to training, then receives new clearance. Reopening invalidates current finalization/portfolio decisions but preserves their immutable history. Returning to training also invalidates current portfolio/finalization decisions; unaffected evidence remains subject to version and policy checks.

Suspension, withdrawal, or leaving training blocks new clock-ins. An existing session is not deleted or silently awarded hours: a narrowly scoped closeout/correction operation may resolve its actual interval without restoring clearance. The attendance implementation must distinguish ordinary clock-in authority from this resolution workflow. Ordinary future clock-outs do not grant credit automatically.

Empty mandatory lists fail stage gates until a published requirement configuration exists. A waiver must be authorized, reasoned, and recorded against the exact requirement/version; a client checkbox or remark is insufficient. Post-OJT entry does not require currently Active clearance if training evidence was valid and all blockers are resolved. This permits finishing documentation after suspension without authorizing additional attendance.

### Clearance basis changes and transaction history

A revised MOA is a new document version. The previous approved version remains the clearance basis until a coordinator replaces it or suspends clearance. If policy requires immediate suspension for a particular change, implement that as an explicit server event and show the reason. Existing attended hours are never erased automatically.

No general force-stage operation exists in the live backend. Exceptions are named actions with reasons and audit events. No mandatory requirement may be waived without coordinator authority, a reason, and a recorded waiver. An empty requirement list must fail clearance checks rather than pass vacuously.

Issuance stores the exact placement, accepted MOA version, policy version, and approved/waived requirement versions. A pending revised upload never replaces this basis. Resume checks the retained accepted basis, not a pending upload. Company transfers require resolution of open sessions, revocation of old placement clearance, activation of the replacement placement, and new clearance; prior placement credits remain attributed to their source. This release permits immediate server-time actions only; future-dated/backdated authority changes require a later explicit scheduling/correction design.

Lock the enrollment aggregate before checking its revision and reading dependent approvals, assignment, placement, and credit records. All commands that change those dependencies must participate in the same locking/revision convention. Record from/to stage, outcome and clearance, actor, reason, command ID, basis, and before/after revisions. State changes, history, audit, command receipt, and notification outbox commit together. A conflicting action returns the current revision without partial advancement. A repeated identical command returns its receipt.

### Part 3 completion criteria

The local backend now enforces placement configuration, evidence gates, clearance issue/resume/suspend/revoke, Post-OJT/Portfolio entry, withdrawal and return to training under enrollment locks and revision checks. All development views share the scoped enrollment projection. Completion/reopen and source invalidation remain dependent on the specialized portfolio/credit implementation. Real independent-connection tests and official policy/placement publication are still required.

## Part 4 Requirements and document review

This part defines the engineering rules for evidence and approval. Existing screen counts and sample documents remain draft configuration. The university still needs to confirm the official items, due dates, recurrence, reviewer plans, and permitted waivers before publishing a program policy.

### Published requirements and recurrence

Requirements are versioned by program, term, stage, reviewer, evidence type, recurrence, due date, and whether they block progress. Enrollments receive a snapshot of the applicable published version. Later template edits apply to future enrollments unless an explicit audited amendment is applied to existing ones.

Preserve the current 14 Pre-OJT items and four Post-OJT items as draft configuration, not universal official policy. The 12-week journal/documentation schedule becomes configurable. Physical evidence such as an envelope or orientation attendance uses staff verification, not a fabricated PDF. The MOA checklist item references the canonical MOA review; no second independent MOA approval state.

A definition includes a stable code, title, evidence type, reviewer plan, mandatory flag, allowed submission stages, recurrence rule, deadline, and immutable template reference if applicable. Publication validates these fields, rejects duplicate codes and ambiguous recurrence, and verifies template bytes exist. Enrollment instances use stable occurrence keys such as `once` or a configured week/period ID, never a displayed list position. Retry generation must not duplicate an occurrence. Deadlines use stored timestamps and Manila display dates. A late submission is visibly flagged; rejection or closure requires an explicitly published rule. There is no guessed automatic penalty.

The current policy blueprint uses confirmation as the publication boundary; policy confirmation and requirement/template publication must be one validated server operation. Existing instances retain their definition snapshot and template version. An amendment to an existing enrollment requires an audited change, impact summary, notifications, and a revised enrollment revision; changing the catalog alone cannot rewrite student obligations. A waiver is a separate coordinator event with reason and exact occurrence, not an Approved submission.

### Evidence types and upload boundary

| Evidence type | Authoritative record |
| --- | --- |
| File | Validated private document attached to an exact submission version |
| Staff verification | Student request plus staff verification event for that exact version, including verifier, timestamp, and factual note |
| MOA | Canonical coordinator routing and accepted MOA version; generic approval is disabled |
| DTR | Frozen attendance revisions and approved credit allocation from the attendance workflow |
| Journal, evaluation, portfolio | Their module's versioned artifact, rubric or manifest, and required review decisions |

Generic file commands cannot approve specialized artifacts. Their module commands must publish a scoped evidence/approval projection consumed by the requirement gates. No company-supervisor application account exists; externally signed evaluations are uploaded as evidence under the evaluation workflow.

For file evidence, release one accepts PDF/JPEG/PNG up to 10 MiB per file as engineering defaults. Reserve a random immutable private object path; validate actual stored bytes, type, size, and SHA-256 before finalization. Browser extensions/MIME values are only hints. Submission must reference a validated document owned by the student in the same enrollment, reserved for the intended requirement. A successful upload is not a successful submission. Quarantine, missing objects, foreign ownership, failed validation, or storage/network errors cannot create Submitted/Approved records. Drafts may be incomplete; submitted file evidence may not. A generated sample or fallback file is never evidence.

Templates have separate versioned private assets and scoped access; they are not personal enrollment uploads. The displayed template update date comes from its published version. Do not silently replace a template object's bytes after publication. Security implementation, short-lived links, validation tooling, reservations, and cleanup are tracked in the integration checklist and storage part.

### Submission state and version rules

Submission states are Draft, Submitted, Under Review, Needs Revision, Approved, Rejected, Superseded, and Withdrawn. Student changes are allowed only in Draft or as a new version after Needs Revision/Rejected. Submitted evidence is immutable. Approval requires the actual file or documented non-file evidence, submission timestamp, reviewer, review timestamp, and applicable policy version.

Each revision has its own file, content hash, author, submission time, and review events. A new version does not inherit an old approval. Historical versions remain available to authorized reviewers. Reviews reference a specific version and stage of review. Adviser academic approval and coordinator verification are separate events; when both are required, both must pass. No free-text remark may implicitly change clearance.

| Action | Allowed state and result |
| --- | --- |
| Edit/save draft | Student owns current Draft; allow incomplete content; submitted bytes/content are never edited |
| Submit | Current Draft, active enrollment, permitted submission stage and valid evidence; freeze content and store server submission time |
| Withdraw | Current Submitted version with no review-start event or prior approval; preserve evidence and withdrawal event |
| Start review | Authorized configured reviewer, current Submitted/Under Review version; mark review started even if no decision follows |
| Approve | Validated evidence and correct current review step; persist reviewer/time/version; never accept client approval flags |
| Request revision or reject | Current reviewable version, configured reviewer, nonempty remarks; clear current approval eligibility while retaining old decisions |
| Create revision | Student owns current Needs Revision/Rejected/Withdrawn version; create version N+1 as Draft with no approvals or inherited verification |
| Revoke approval | Scoped coordinator, prior approval, reason/impact assessment; record revocation and Needs Revision; do not overwrite the original approval |

Creating a new version marks the previous version noncurrent and preserves its decision status and events in history. Exactly one current version exists per requirement occurrence. Approved generic evidence cannot be casually replaced: use explicit revocation/revision first; revocation/dependency propagation remains an implementation item. MOA replacement uses the canonical pending-upload/basis model; its accepted clearance basis remains until a coordinator replaces or suspends it.

Physical evidence requests can be submitted before verification; they remain pending until an authorized assigned adviser or program coordinator records the actual observation. A verifier may also perform the configured review step, provided they are not the student/submission author. Verification starts review and prevents withdrawal. A revision receives no verification from its predecessor.

### Reviewer plans and concurrent decisions

Advisers review assigned enrollments only. Coordinator review covers their programs. Reviewers cannot approve their own submission. Needs Revision and Rejected require remarks. Bulk approval is deferred; a review queue and preview are preferred for release one.

Reviewer plans are Adviser only, Coordinator only, or Both. For Both, adviser approval precedes coordinator verification of the same version. Adviser approval leaves the aggregate Under Review; only the second approval makes it Approved. The coordinator cannot bypass an unapproved adviser step. Revision/rejection by the currently permitted step invalidates eligibility of earlier steps for that version; a new version starts both again. A review step that already approved cannot approve again through a new command; identical retries use the original receipt. Administrative revocation is separately coordinator-controlled regardless of reviewer plan.

Use verified identity, active membership, current assignment/program scope, staff MFA, and no self-review checks for each decision. Reassignment removes the former adviser's access immediately. Earlier valid decisions retain attribution; reassignment alone does not rewrite them. If an old approval is disputed, revoke it explicitly. Completed/withdrawn enrollments reject ordinary evidence changes; completed work must reopen through Part 3 first.

Commands carry the expected enrollment and submission revisions. Lock the enrollment and requirement occurrence, resolve the current version and reviewer step, then commit decision, projection, history, revisions, audit, receipt, and notification outbox together. Reviews and stage advancement share the Part 3 lock/revision convention. A stale page gets Conflict and current revisions, never a second silent decision. Transaction success is the UI success boundary; mail delivery may retry afterward.

### MOA routing and SAS submission

The project owner confirmed that only the coordinator updates MOA status. The seven allowed statuses are SAS COPY SUBMITTED, SIGNED AND NOTARIZED, FOR NOTARIZATION, IN-PROCESS FOR REVISION, IN-PROCESS FOR REVIEW OF ULCO, FOR COMPANY REVIEW, and NO MOA. SAS COPY SUBMITTED means the signed and notarized MOA copy has been submitted to SAS; the coordinator records it only after confirming SIGNED AND NOTARIZED for that copy. The older ambiguous label SAS COPY is excluded. A student's upload creates a submission event and notification; it does not change the coordinator-controlled status. External company/ULCO activity is recorded with supporting evidence. Both SIGNED AND NOTARIZED and SAS COPY SUBMITTED retain accepted MOA eligibility; SAS submission does not send the student back to Pre-OJT. Issuing deployment clearance remains a separate coordinator action. Any additional clearance requirements must be confirmed before a pilot.

NO MOA can be recorded without a submission version. Other routing states reference validated evidence. Every routing change requires a reason and current enrollment revision. SIGNED AND NOTARIZED records the coordinator's signature/notarization confirmation; SAS COPY SUBMITTED additionally records submission evidence or a factual acknowledgment note and the same already-notarized version. A new copy cannot inherit the old copy's notarization/SAS flag. Company/ULCO routing may move backward for revision with a reason; there is no invented mandatory linear routing sequence. These commands never implicitly change lifecycle, clearance, or credited minutes.

### Review screens and Part 4 completion criteria

Show occurrence, submission version, real submitted time, current status, pending reviewer step, due/late indicator, and version-specific remarks. Separate Not submitted, Draft, and Submitted counts. Approval counts reflect the complete configured plan, not uploaded-file counts. Reviewers open exact evidence and history; stale or inaccessible files block approval with a retry/error message. Download authorization checks the current relationship. Preserve drafts after recoverable failure and avoid claiming a reviewer was notified before an outbox entry commits.

Local migrations and workspaces implement catalog publication, explicit occurrence generation, immutable file submissions, sequential reviews, physical-verification events and coordinator MOA/SAS routing. SQL tests exercise scope, stale commands, transaction rollback, revisions and same-copy SAS handling. Official catalogs/deadlines, antivirus/full-content scanning, approval revocation with source invalidation, real Auth/Storage/browser/race tests and full production screen integration remain required.

## Part 5 Attendance and credited hours

This part finalizes the engineering workflow. The supplied program hour targets remain confirmed; schedules, breaks, daily caps, holidays, geofence tolerances, and exception rules are configurable proposals that must be published by authorized university staff before live attendance.

### Time authority and clock commands

Store timestamps as PostgreSQL `timestamptz`. Server time establishes receipt/clock time. Attendance dates use Asia/Manila, including early mornings. Store minutes as integers; convert to hours only for display. Clock-in and clock-out are paired by session ID, never by the first record with a missing time-out.

Failed attempts have their own table and cannot create an active session. Permit only one open session per enrollment. Duplicate requests use idempotency keys and return the original result. A new clock-in is blocked by an unresolved previous open session. Multiple completed shifts in a day are allowed when the approved schedule permits them.

Clock-in checks active student ownership, active enrollment, During OJT, Active clearance for the current placement, placement dates, published policy, approved schedule, location rule, and expected enrollment revision. The server supplies time and resolves all authority; no client timestamp, mock location, or claimed exception grants attendance. Attendance sessions retain the clearance, placement, schedule, geofence, and policy basis at entry. Network failure is Unconfirmed until receipt/refetch determines whether the command committed. Offline clock-in is deferred.

Clock-out references the exact session and expected session/enrollment revisions. Use server receipt time and the session's historical location/policy basis, not newly edited placement coordinates. Successful ordinary clock-out leaves a resolved Pending session; it credits zero minutes until DTR approval. Early/late checkout does not create an automatic penalty or overtime award; eligible time is the intersection with approved work windows. Missing, stale, inaccurate, or outside-boundary GPS leaves the session unresolved and creates a failed attempt; offer correction/exception handling.

If clearance is suspended/revoked, a placement changes, or an enrollment is withdrawn while a session is open, allow only a narrow ownership-checked closeout of that existing session. It becomes Disputed and needs adviser resolution before DTR credit. Account suspension still denies student access; staff resolution remains available under its own authority. Sessions beyond the configured maximum duration require correction rather than fabricated automatic checkout. Withdrawal cannot silently erase open time. New clock-in remains blocked until the old session is resolved or explicitly voided with evidence and a reason.

### Location and approved exceptions

GPS captures latitude, longitude, accuracy, captured time, and server receipt time. Validate ranges and freshness; calculate distance server-side. Poor accuracy, denied permission, outside-boundary reports, or unavailable GPS produce an exception workflow. They never fall back to mock coordinates in live mode. GPS is supporting evidence and can be spoofed; it is not definitive proof of presence. Authorized off-site or remote work needs a recorded exception, dates, and approver.

The prepared circular-geofence rule uses server-calculated distance plus reported accuracy no greater than the configured radius. This conservative boundary rule is an engineering choice, not an official attendance policy. Invalid coordinates/fence settings fail closed. Record denied permission/unavailable location distinctly; never substitute zero coordinates. Capture location at the punch only; continuous tracking is outside release one.

Exceptions are coordinator decisions bound to enrollment, placement, permitted action, kind, and a bounded time interval. Location exceptions may permit a punch without GPS; schedule exceptions may permit a specified work window. Neither waives ownership, clearance, session uniqueness, time limits, or credit review. Students request exceptions with reason/evidence; advisers resolve factual corrections but cannot grant remote work, holiday attendance, or policy deviations. Revocation stops future use without deleting historical attribution. No supervisor application role or shared exception bypass exists.

### Program targets and candidate minutes

Required hours supplied by the project owner are below. Store each component separately; do not combine them into one enrollment. `domain/programRequirements.ts` and the SQL draft policy rows preserve these values. Publication still requires confirmed attendance and requirement settings.

| Program | Component | Required hours | Year and term |
| --- | --- | --- | --- |
| BSIT | 1 | 500 | 4th year, 2nd semester |
| BSHM | 1 | 300 | 2nd year, summer term |
| BSHM | 2 | 600 | 4th year, 2nd semester |
| BSCPE | 1 | 300 | 2nd year, summer term |
| BSCPE | 2 | 300 | 3rd year, summer term |
| BSOA | 1 | 300 | 2nd year; 2nd semester |
| BSOA | 2 | 300 | 4th year; 2nd semester |

Proposed configurable attendance defaults: 08:00 to 17:00 schedule; 60-minute unpaid scheduled break; 480-minute daily credit cap; 24-hour maximum session; 100-meter maximum reported GPS accuracy; 60-second coordinate age. These are engineering starting values, not confirmed PUP policy. Geofence radius is placement-specific and must be configured, not guessed. No automatic holiday attendance. Overnight schedules require explicit configuration.

Calculate unpaid breaks from the actual overlap with approved break intervals, not a fixed deduction for every short shift. Apply the daily cap across all shifts on the same Asia/Manila calendar day, not independently per shift; split authorized overnight sessions at local midnight before allocating credits. Allocate in clock-in order with session ID as a stable tie breaker. Save the schedule/policy version used. Credited hours come from approved DTR versions and their unique session allocations. Pending sessions and disputed records are shown separately and do not unlock completion. An 08:00 to 17:00 shift with a full 60-minute break produces 480 minutes.

Intersect actual time with authorized work intervals before computing candidate minutes; union overlapping unpaid breaks, then subtract their actual overlap. Reject overlapping sessions rather than count simultaneous work twice. Split by Manila date and round down to whole minutes per session/day before allocation. Apply the frozen enrollment's daily cap across all placements/shifts and DTRs on that day. The allocation helper receives all eligible resolved intervals for affected days, never just the newest DTR. Candidates remain distinct from approved credits. Zero-minute entries are permitted as documented attendance; an empty DTR cannot grant credit. Approved leave, absence, and holidays receive no invented training minutes; any institution-approved credit policy must be separately published.

### Corrections and historical revisions

Students request corrections with original and requested timestamps, reason, and supporting evidence. Assigned advisers decide attendance corrections; policy exceptions and overrides belong to coordinators. Approval creates a new session revision. Original timestamps remain intact. A correction affecting an approved DTR invalidates its active credit allocation and requires a new DTR review; no double counting or silent retroactive change.

One pending request per session/source revision is allowed. Student ownership and active account access are required to request; attendance clearance is not required to report a missed punch. Withdrawn enrollments may resolve existing sessions; completed enrollments must reopen before credit changes. An assigned adviser with MFA checks the current source revision, actual supporting facts, timestamp order, maximum duration, overlap, placement dates, schedule, and any coordinator-authorized exception. Reasons are mandatory for both request and decision. An old request cannot overwrite a newer checkout/correction. Rejection preserves the session and records the reason; approval appends a revision and updates the projection atomically. Backdated proposed times are correction evidence, never ordinary clock events.

Supporting uploads use a private Attendance resolution purpose and enrollment ownership, rather than inventing a mandatory checklist item. They pass the same file validation limits and remain separate from requirement-submission evidence. Reconstruction records carry an explicit reconstructed source and no fabricated GPS. A GPS-exempt clock record references the exact approved location exception in its authority snapshot.

A missed clock-in has no existing session to correct: use a separately audited adviser-reviewed attendance reconstruction with evidence and coordinator policy exceptions where needed. It must pass the same chronology, overlap, schedule, and credit checks and may not impersonate a GPS punch. Explicit voiding also requires authority, reason, preserved original evidence, and credit invalidation. These resolution paths need server commands before a pilot; there is no direct hours editor.

Changing an approved interval may change another shift's daily-cap allocation. Invalidate the affected DTR and all approved DTRs/credits sharing affected Manila dates, including both old and corrected dates. Preserve their immutable prior approved snapshots as historical; mark current versions Needs Revision. Recompute/review the affected day together under the enrollment lock. The credited total may decrease and must show a reason. Do not silently revoke clearance or move stages; completion impact follows Part 3's explicit reopen/review workflow.

### DTR submission review and credit ledger

DTRs have date ranges, versions, source session revisions, generated time, submission time, reviewer decisions, and a frozen printable snapshot. Approval is transactional and creates credit allocations once. Partial-day absence, approved leave, missing checkout, remote work, and holidays are distinct states. An incomplete session earns no credit until resolved.

Published policy defines DTR period keys and date ranges; students cannot evade the daily cap with overlapping custom periods. Generation includes every applicable session/day segment and marks unresolved entries visibly. Submission is blocked by unresolved sessions, disputes, or pending corrections in that period. A session crossing a period boundary retains one source revision and contributes only the relevant day segments to each period. Drafts can regenerate; submitted snapshots cannot be edited. Generated/Submitted times come from the server, and preview totals are labeled Pending.

Assigned adviser review requires MFA, no self-review, the submitted version, matching enrollment/DTR revisions, matching current session revisions, valid period coverage, and no conflicting approved period. Needs Revision requires remarks. Approval locks the enrollment, revalidates source records and daily allocations, and commits DTR decision, active credits, session projection, revision/history, audit, receipt, and notifications together. The browser supplies no credited total. A repeated identical request returns its receipt; a second command cannot credit an already approved version again. New DTR revisions preserve old printouts and decisions.

The ledger's active allocations are unique by session and Manila credit date. Every allocation references a frozen source revision belonging to the reviewed DTR and enrollment. Dashboard rendered hours sum only non-invalidated approved allocations; remaining hours are clamped at zero, and extra approved hours remain visible without changing the component requirement. No credits transfer between separate practicum components/attempts automatically. Coordinator administrative adjustments use evidenced correction/reconstruction events and reviewed DTRs, never assignment to a total field.

Session source revisions identify punch/time/evidence changes. DTR approval updates the derived credited/session projection through its ledger and review events; it must not increment the frozen source revision merely to show Approved. Corrections change the source revision and invalidate dependent approvals. This prevents an approval from immediately making its own frozen DTR sources stale.

### Part 5 completion criteria

Clock authority, scoped exceptions, session closeout, candidate-minute calculation, correction history, DTR review, and credit invalidation are specified. `domain/attendance.ts` provides contracts and acceptance helpers for ownership, location, historical-session resolution, Manila splitting, daily caps, current-revision corrections, and DTR review. These helpers do not authorize live requests. Migrations `202610140017`–`202610140019` now implement scoped punches/exceptions, corrections, reconstruction/void, resolution-file reservations, explicit DTR periods, frozen snapshots and ledger approval. Corrections conservatively invalidate all current enrollment DTR credits and dependent journal/portfolio approvals so every affected daily allocation is recalculated. Synthetic PostgreSQL tests cover these operations; real JWT/browser/GPS and independent-connection tests remain required before live attendance. Confirm the official attendance settings before publishing policy; BSOA second-semester labels are confirmed.

## Part 6 Journals evaluations and portfolios

This part specifies the academic artifacts for release one. Journal periods, required reflection fields, evaluator/rubric content, mandatory portfolio categories, and allowed submission stages must come from a published program policy. Existing example weeks, scores, and files are not official records.

### Common version and review rules

Daily tasks, journals, evaluations, and portfolios each have a stable aggregate/occurrence ID, version, revision, author, status, server submission time, and review history. Use Draft, Submitted, Under Review, Needs Revision, Rejected, Approved, Superseded, and Withdrawn consistently with Part 4. Save/delete incomplete drafts only; submitted content is immutable. A requested/rejected/withdrawn revision creates a new Draft without inherited approvals. Never edit approved work in place: a coordinator records revocation/impact and reopens the affected requirement before a replacement version. Completed enrollments must reopen through Part 3 first.

All commands check active identity, membership, ownership/current adviser assignment/program scope, published policy, allowed student submission stage, expected enrollment/artifact revisions, and no self-review. Staff require MFA. Assignment changes remove old access while preserving valid historical attribution. Lock the enrollment and artifact before decision/source validation, then commit versions, requirement projection, audit, receipt, and notification outbox together. The generic file-review endpoint cannot approve these specialized artifacts.

### Daily tasks and journal periods

Tasks may be saved as drafts and edited until submitted. Submitted tasks used in an approved journal remain immutable; changes become revisions. Weekly journals snapshot their task references, week dates, reflection, attachments, and approved attendance references. Journal text never supplies credited hours.

Task submission requires a valid Manila task date within the enrollment/placement period, nonempty work description, any published required fields, and allowed stage. Several distinct tasks on one date are allowed; retrying one task must not create another. Students cannot supply an official hours total in task content. Standalone task review belongs to the assigned adviser; policy determines whether it is required before the journal may advance.

Journal periods use published start/end dates and a stable occurrence key, not a guessed 12-week counter. A period may include several placement days; its references retain placement attribution. Freeze exact submitted task versions belonging to this enrollment and period. Referenced tasks may be awaiting standalone approval only when the published journal policy permits it; a Draft task is never submitted evidence. Require the configured reflection fields. A no-activity journal is allowed only by published policy with a reason, such as an approved no-work period; do not invent tasks or attendance for it.

Attendance references point to specific session/DTR revisions and show Pending versus Approved accurately. A narrative can be submitted while attendance is pending if policy allows, but it must not label those hours approved. Stale/invalidated attendance references block academic approval until the journal is rebuilt or revised. Preserve the original submitted snapshot. Assigned advisers approve or request revision with remarks; journal approval never writes the credit ledger.

### Evaluation rubric and external evidence

Evaluation templates are versioned by program and term. Validate scores against each criterion's range, compute totals server-side, and store the exact rubric version. Require evaluator identity and date. For the first release, external supervisor evaluations are signed evidence reviewed by the adviser; they are not treated as authenticated supervisor commands.

An evaluation occurrence records its kind (midterm/final/company), frozen published rubric, evaluator name and affiliation, evaluation date, source evidence, author, and review decisions. Student-entered scores are a transcription awaiting adviser verification against the actual signed evidence, never an authenticated external evaluator decision. The evaluator must be identified and the evaluation date valid within the configured evaluation window; reject future dates using server Manila time. No company-supervisor invitation or portal exists. Direct internal staff scoring needs an explicitly configured assessment workflow and is not silently enabled by a student-upload form.

Criteria have stable IDs, order, maximum points, and any published weighting/rounding rule. Require exactly one bounded score per criterion; reject missing, duplicate, foreign-rubric, negative, nonnumeric, and above-maximum values. Store scores in integer hundredths at the contract boundary, equivalent to two-decimal PostgreSQL numeric values. The server computes earned and possible points exactly. Weights, pass marks, percentages, and rounding are not guessed; block publication if a required calculation rule is absent. Never accept a browser-supplied total or use a changed rubric for an existing occurrence.

The assigned adviser verifies evidence, evaluator/date, and scores before academic approval. Unreadable, unsigned, incomplete, or foreign evidence needs revision with a reason. A revised evaluation repeats verification with a new version; old scores and decisions remain available as history. Evaluation approval does not issue deployment clearance, credit attendance, or complete an enrollment.

### Portfolio manifest and completion handoff

Portfolio submission freezes a versioned manifest of actual files, approved documents, DTRs, journals, and evaluations. Adviser review and coordinator finalization remain separate. Missing mandatory items block finalization. Completion produces an immutable summary; later corrections use an explicit reopen process.

Generate the manifest from scoped server records: source kind/ID, enrollment, requirement occurrence, exact version/revision, content hash, and approval basis. Submitted portfolios store references to existing immutable objects rather than reupload copies or save expiring download URLs. Optional additional files use validated private uploads. A validated optional file does not satisfy an unapproved mandatory requirement. Mandatory coverage comes from the configured requirement occurrence and its complete approval plan or an authorized waiver, not an uploaded-file count.

Validate every source belongs to this enrollment, is accessible and current, and remains approved/validated as appropriate. Include the complete approved DTR/credit source set for the enrollment; no cherry-picking convenient periods. Missing required categories, unresolved disputes, stale source revisions, invalidated credits, pending evidence, and unavailable bytes block review. Content hashes bind the manifest to actual files or a canonical serialized academic snapshot; a client-supplied hash is not evidence. Waivers are resolved from protected requirement events and included with their reasons.

The adviser reviews the exact submitted manifest first; adviser approval leaves Under Review. Coordinator verification follows for the same version, then the portfolio becomes Approved. Revision/rejection clears current eligibility of both steps, preserves their historical decisions, and requires a fresh manifest/version. A coordinator cannot bypass the adviser step or approve their own submission. Approved portfolio status alone does not complete an enrollment: Part 3's explicit completion command rechecks approved hours, mandatory items, both portfolio decisions, and unresolved records under the same enrollment lock.

Maintain source-dependency records for journals, evaluations, and portfolios. A source correction/revocation marks dependent current approvals stale and requiring review while retaining their frozen history. It cannot silently rebuild an already approved manifest or leave an old approval valid against different bytes. Reopening completion invalidates current portfolio decisions as defined in Part 3. Finalization stores an immutable completion summary with policy, requirement outcomes/waivers, ledger sources, manifest hash/version, approvers, and server completion time. Later corrections create a new finalization record after explicit reopen; previously issued summaries remain historical.

### Part 6 completion criteria

Academic versioning, periods, rubric validation, evidence handling, portfolio coverage and completion handoff are specified in `domain/academic.ts`. Migrations `202610140020`–`202610140029` implement submitted task/journal versions, configured journal fields/dates/sources, rubric publication/copying, exact signed-evidence evaluation scores, immutable portfolio manifests with the supplied 32-item outline, sequential adviser/coordinator decisions, specialized requirement bindings, explicit completion/reopen summaries and approval withdrawal/dependency invalidation. The current supported academic review plan is adviser review for tasks/journals/evaluations and both roles for portfolio; unsupported plans are blocked. Production adapters and real Auth/Storage/concurrency acceptance remain incomplete. The owner-provided portfolio categories are recorded in `coordinator-portfolio-template.md`; official rubrics, reflection fields/periods and program-specific approval rules remain publication inputs. A structural guard test does not establish a working academic module.

## Part 7 PostgreSQL model

### Consolidated baseline and validation status

The canonical baseline reference is `database/supabase-model.sql`. It contains 52 domain tables and 28 integrity/history guards and remains byte-for-byte frozen in `database/migration-candidates/202610100001_domain_baseline.sql`. It was validated with PGlite and then applied to local Supabase as migration `202610100001`. Subsequent forward migrations add the implemented account, evidence, enrollment, communication and recovery capabilities listed above. `database/schema-inventory.json` describes the original baseline, not the full migrated schema. Generated public API types come from the actual local database. No staging or production project is claimed. See [PGlite documentation](https://pglite.dev/docs/) for the isolated test engine.

| Records | Purpose |
| --- | --- |
| profiles, programs, memberships, eligible_students | Identity, account state, and program authority |
| academic_terms, policy_versions | Term boundaries and confirmed policy snapshots |
| companies, enrollments, placements, adviser_assignments | Historical practicum and assignment records |
| requirement_definitions, enrollment_requirements | Published requirements and enrollment snapshots |
| template_versions, evaluation_templates, evaluation_criteria, evaluation_scores | Staff templates, immutable rubric versions, and bounded criterion scores |
| documents, submission_versions, review_events | Private objects, immutable evidence, version-specific decisions |
| clearance_events, enrollment_events | Explicit authority and lifecycle history |
| attendance_sessions, attendance_attempts, correction_requests | Successful sessions, failures, and changes |
| dtr_versions, dtr_entries, hour_credits | Frozen DTRs and unique approved credit allocations |
| journal_versions, task_versions, evaluation_versions, portfolio_versions | Versioned academic work |
| notifications, notification_outbox, messages, announcements | Recipient-scoped communication and reliable delivery |
| privacy_acknowledgments, audit_events, command_receipts | Notice history, accountability, and duplicate protection |

Additional supporting tables cover import previews/batches, invitations, staff verification, attendance exceptions and reconstruction, session revisions, DTR/academic review history, journal DTR sources, portfolio sources and completion summaries. Identity and scoped relationships use normalized foreign keys. Snapshot/policy JSON is bounded domain content, not one mutable application state blob. Normalized evaluation scores are authoritative and their frozen JSON representation is written by the same transaction.

### Structural guarantees and command responsibilities

UUIDs identify records. Composite foreign keys prevent unrelated enrollment, placement, submission, and document combinations. Database uniqueness prevents duplicate versions and open sessions. Check constraints enforce nonnegative minutes, score bounds, coordinate bounds, and ordered dates. Every mutable aggregate has a revision number for optimistic concurrency. Transaction functions must additionally verify policy/program/component agreement, rubric/criterion agreement, actor authority, published template immutability, and clearance prerequisites; foreign keys alone do not encode those rules. The SQL blueprint intentionally does not implement those functions yet.

RLS is enabled with no anonymous access and no client mutation grants in the blueprint. Read policies must use active account status, current assignments, and program membership. Former advisers lose access on reassignment; their historical review attribution remains. RLS tests are mandatory before exposing read views. Storage must use the same scope rules.

The baseline also revokes client/PUBLIC function and sequence privileges and default future privileges. Guard functions have fixed empty search paths and fully qualified table references; they are invoker trigger functions, not public APIs. Triggers freeze submitted artifact payloads and linked references, validated asset identity, published policy/requirement/rubric content, and submitted normalized scores. Review status/projection fields may change through future authorized commands; those commands must still enforce valid transitions and revisions. Append-only history, summaries, audit events and receipts cannot be rewritten/deleted by routine application commands. Database guards do not protect Storage bytes or replace actor checks.

Publication assembles requirements and rubric criteria in draft before freezing their parent. Existing published catalog rows cannot be amended directly, including by adding a late requirement. New versions and explicit enrollment amendments carry the change. Baseline seed rows remain unpublished and do not create accounts, student records, sample approvals or clearances. Their original BSOA null labels are preserved in the frozen baseline; migration `202610140006` sets semester `2` on the unconfirmed BSOA policies.

### Migration sequence and verification gates

Keep legacy MySQL SQL outside this migration path. Execute the checked candidate through the local Supabase migration runner; compare its actual schema to the inventory. Then add trusted identity/admin workflows, protected authorization helpers, one complete requirement/upload/review workflow, scoped read views/RLS and explicit RPC grants. Add remaining domains as reviewed forward migrations. Generate database TypeScript types from the verified Supabase schema rather than treating the hand-written domain interfaces as database types.

Staging uses the same migration files and synthetic users/files. Test real JWTs, direct RPC bypass attempts, account suspension/reassignment, retries, Auth/Storage partial failures, and two independent connections competing for reviews/sessions/credits. Validate expected query plans before broadening indexes or enabling report/export routes. Separate production promotion follows staging and recovery gates; no cloud project is created by Part 7.

Check applied migration checksums and do not edit an applied baseline. Structural changes use additive migrations/backfills and forward repairs that preserve evidence. A failed initial transaction rolls back; routine production rollback must not drop the domain schema or truncate records. Retention/anonymization and receipt expiry need a separately controlled maintenance design, rather than weakening immutable guards in normal RPCs.

### Part 7 completion criteria

`npm run test:database` validates the baseline and forward account, policy, evidence, MOA, communication and lifecycle operations using synthetic PostgreSQL identities. `npm run db:prepare` describes the frozen baseline only. Local Supabase migrations and generated types are applied; real Auth/Storage/browser acceptance, independent-connection races, recovery execution and staged deployment remain separate gates. A synthetic JWT fixture is not proof of a real Auth/MFA integration test.

## Part 8 Files and storage

Use a private `ojt-documents` bucket. Proposed file limits are 10 MiB per file and PDF/JPEG/PNG for release one. Staff-managed PDF/DOCX templates use a separate private `ojt-templates` bucket with coordinator-only upload authority and scoped signed downloads. Submitted DOCX support is deferred until a safe preview/download path exists. Staff determine any different permitted evidence types.

Objects use random IDs, never student names or student numbers in public URLs. Original filenames are metadata. Validate type, size, content signature, and ownership server-side. Files move from pending upload to validated to attached. Unknown or active content cannot be previewed. Scan/quarantine processing is a pilot requirement for public uploads.

Upload sequence: authorize upload intent; upload to an immutable reserved path; validate stored bytes; finalize the document and submission transaction; display confirmed success. Failed finalization does not create a submitted record. Cleanup abandoned uploads after a configurable period. Preserve attached versions; no overwrite/upsert at an existing evidence path.

The implemented local file service issues 60-second download URLs after current scope checks. URLs are not stored as document identity. Pilot download logging/expiry requirements remain configurable decisions. Previously issued URLs can remain usable until expiry; new grants stop when authority is revoked.

## Part 9 Commands and consistency

`src/app/domain/contracts.ts` defines the command envelope and gateway boundary. Components receive an asynchronous result; they cannot show success before it resolves. Errors distinguish unauthenticated, forbidden, validation, conflict, duplicate/open attendance, policy blocking, unavailable service, and upload failure. UI drafts survive retry. Never auto-save seeded state after a failed initial load.

Every mutation supplies a UUID command ID and expected aggregate revision. The server derives actor and role from Auth/database records, not request fields. A repeated command with the same actor and payload returns its receipt; changed payload under the same key is rejected. Concurrent stale writes return Conflict with the current revision. Lock the affected aggregate and commit record changes, review/audit events, receipt, and notification outbox together.

Core operations: invite/import account; publish policy; enroll/assign/transfer; issue/suspend/revoke clearance; reserve/finalize upload; submit/withdraw/review requirement; route/review MOA; clock in/out; request/decide correction; generate/submit/review DTR; submit/review task/journal/evaluation/portfolio; complete/reopen enrollment; send message; publish announcement; acknowledge notice. Every operation requires an explicit permission, valid prior state, input validation, audit event, idempotency, and concurrency test before integration.

Search is scoped to the same records as normal reads and starts with students, requirements, journals, and DTRs. Remove unsupported global search until its query exists. Use pagination and indexes for review queues. Notification badges reflect unread records, not a permanent decorative dot. In-app notifications are authoritative; email delivery is retried separately and must not undo a successful review.

Reporting distinguishes submitted, approved, disputed, and credited hours. Export scope is enforced server-side. Escape formula-leading CSV values, minimize personal columns, and audit sensitive exports. Messages are visible to participants only; adviser/student contact must match a current assignment. Announcements use explicit program, term, and role audiences.

## Part 10 Privacy operations and recovery

Keep notice acknowledgment separate from consent for optional processing. A privacy notice alone does not establish legal compliance. University approval must supply lawful processing grounds, required notice wording, contact channel, retention schedule, hosting/region decision, and location-data policy. Do not fabricate those decisions or publish an invented retention period.

Record authenticated acknowledgment, notice version, and server time. Purge consent on behalf of someone else is forbidden. Version material changes. Draft local data must not contain credentials. Clear cached student data on logout; no sensitive service-worker cache in release one. Production logs contain correlation IDs rather than passwords, OTPs, document contents, or full personal records.

Separate development, staging, and production projects and keys. Use synthetic fixtures in development. Never import the current browser account/password snapshot. Pilot data migration must be explicitly approved, validated, reconciled, and audited. Unknown historical dates remain marked unknown; do not invent them to make a card look complete.

Migrations are versioned and additive where possible. Test backup restoration into an isolated environment before a pilot. Database backups do not include the stored file objects: provide a separate private Storage backup and restore procedure. See [Supabase backups](https://supabase.com/docs/guides/platform/backups). Recovery targets and backup frequency are university operational decisions; pilot readiness requires a named owner and an executed restoration test.

Rate-limit Auth and sensitive commands. Keep allowed redirect URLs and origins explicit. Monitor failed writes, outbox backlog, storage processing failures, and database availability. An outage shows a clear retry state, not a success toast. Offline attendance is deferred; offline text drafts may be retained with a visible unsent state.

## Part 11 Frontend preparation

Use `domain/policy.ts` for shared prototype validation and `domain/contracts.ts` for the future gateway. The server must reimplement or invoke equivalent rules; these helpers are not a security boundary. The existing OJTContext is still the legacy adapter and must not be mistaken for these settled rules already being enforced across the app.

New IT demo profiles and the reference dashboard figures use the owner-supplied 500-hour requirement. Existing persisted prototype snapshots may still contain old values. They are not automatically reclassified or migrated; reconcile them explicitly during integration, and never copy their sample completion states into real enrollments. Other program components are prepared in the new catalog, not yet selectable in the legacy enrollment UI.

Demo mode is explicit through `VITE_BACKEND_MODE=demo`, also the fallback when unset. Simulator controls are visible only in development demo mode. Any other mode shows an integration-pending screen before mounting the legacy authentication and OJT contexts. Live mode cannot reuse browser login, OTP, or MySQL snapshot endpoints. Demo authentication still contains browser credentials and must use test credentials only.

Student dashboard priorities are today's status, the next required action, and approved versus pending hours. Locked navigation explains the clearance reason. Adviser review defaults to pending submissions in a paginated table with a document preview and version history. Forms distinguish uploading, validating, saved, conflict, and failed states. Standardize badge labels, dates, spacing, and button verbs. Test keyboard focus, modal focus return, readable contrast, screen-reader labels, 200 percent zoom, and small-screen attendance.

## Part 12 Decisions requiring institutional confirmation

These proposed defaults allow engineering work to proceed. They cannot be labeled official policy until the authorized university personnel confirm them.

| Decision | Proposed behavior | Confirmation required before |
| --- | --- | --- |
| Official requirement lists, reviewers and deadlines | All supplied hours/year/term labels are preserved; the coordinator template contents are recorded additively, with applicability/reviewers/deadlines still unset | Publishing live policy and issuing clearance |
| Schedule and breaks | Configured placement schedule and overlapping unpaid breaks | Crediting live attendance |
| GPS accuracy, radius, remote work | Placement-specific radius, explicit exceptions, configurable accuracy limit | Attendance pilot |
| Additional MOA clearance conditions | Seven statuses and coordinator authority confirmed; clearance is explicit | Deployment pilot |
| Company evaluation evidence | No company-supervisor role; existing roles review signed evidence | Evaluation pilot |
| Retention, processing grounds, region | Supplied by university and privacy office | Real personal-data upload |
| Recovery and operations | Named operator, tested database and file restoration | Real-user pilot |

Engineering decisions settled here: Supabase stack; normalized relational records; versioned evidence; explicit clearance; scoped roles; server timestamps; integer credited minutes; private storage; transactional commands; idempotency; concurrency control; outbox notifications; separate demo fixtures; test-first integration gates.

## Part 13 Integration acceptance gates

Follow `docs/integration-checklist.md` in order. No gate is complete merely because a screen exists or a helper test passes. Local/staging Supabase must demonstrate permissions, storage policies, transactions, and recovery. No live credentials or personal data are needed for the preparation package.


## Latest verification and remaining release work

Migrations through 202610140032 are applied locally. The training workspace is /?trainingTest=1; command contracts are in local-training-workspace.md. Explicit paid/unpaid break configuration is enforced. Evaluation current versions are keyed by requirement occurrence so multiple final-stage forms do not replace each other. Withdrawal permits factual resolution and reviewed credit for previously authorized intervals, while historical-authority checks forbid credit after deployment authority ended.

The local database recovery tool successfully restored 97 application/public/Auth/Storage-metadata tables into intrack_restore_20261014_e771e8ab with matching row counts and hashes. This was a same-instance test against the snapshot taken before migration 029; file bytes, service reconnection, independent-host loss and migration-history restoration remain separate acceptance work. Earlier failed isolated attempts were retained; the source database was never reset or replaced. Dumps/reports are ignored local operator artifacts under ackups/ and are not public deliverables.

The whole backend is not yet complete. Remaining technical work includes DOCX/scanning, approved enrollment-policy amendments and broader academic review plans, intentional invitation resend/provider invalidation, formal MFA/global-operator recovery, configured Auth inbox delivery and the separate notification/outbox worker, other artifact search/export and production-page adapters, full browser/Storage and attendance/review/credit race acceptance, file-object/service recovery, retention/anonymization, edge/Auth request throttling and operational alerts. Institution-approved configuration remains required before live publication or pilot release. Existing requirement fields and historical records remain intact.

The previous batch passed 146 automated tests. The following implementation supersedes its template/export/operations pending status; database recovery checks cover data restoration, not file bytes or complete service deployment.

### Follow-up implementation: migrations 030–031

Private PDF templates now have coordinator/program/MFA authorization, reserved immutable paths, measured byte count/signature/SHA-256, an explicit approval reference, sequential versions, publication/archive commands and 60-second scoped download grants with audit records. Upload reservations do not fabricate asset hashes. Published templates are included in the existing operator asset inventory. The local template screen preserves publication retries and clears private draft data on account loss. DOCX validation, malware scanning, template upload expiry cleanup and real-browser upload/download acceptance remain open; no unseen coordinator file has been manufactured or published.

Enrollment search/report pages now display scoped records, paginate 100 rows, and produce an audited server snapshot for CSV export. CSV values are formula-escaped. Export receipts recheck current row authority before returning cached results after reassignment. This covers enrollment reports, not the entire journal/requirement/DTR search and export scope.

New domain commands using the shared receipt helper have a transactional 300-new-command/minute/actor technical ceiling. Exact retries bypass the ceiling; failed commands roll back the counter. This is a successful-command burst control, not a substitute for Auth, edge/IP throttling or monitoring denied attempts. Existing specialized commands that do not use this helper retain their own controls.

`node --env-file=.env scripts/backend-health.mjs` reads service-only aggregate health counters without personal rows or credentials. It was executed successfully against local Supabase: current notice configured, no published policies, four programs without configured domains, no pending delivery or expired upload counters. Email stays paused. Container/service alerts and deployment monitoring remain separate work.

A fresh isolated restoration after migration 031 matched 99 tables and 223 rows in `intrack_restore_20261014_3a598b44`. `verify-local-command-races.mjs` then used independent PostgreSQL connections against that clone: simultaneous duplicate reservations returned the same single asset intent; concurrent same-series publications allocated versions 1 and 2. Synthetic records were added only to the restore clone. These tests use SQL Auth claim fixtures, not real JWT/browser/Storage bytes; attendance, review and credit race cases remain pending.

Follow-up verification: 150 automated tests passed, the final frontend build passed (existing large-chunk warning), four Edge Function entry points bundled successfully, and public database definitions were regenerated from local Supabase. Activation/invitation requests now bound bytes while streaming; oversized JSON is rejected before unrestricted allocation.

### Supabase email OTP and template cleanup follow-up

The owner requested real Outlook/PUP inbox OTP delivery. Auth email delivery is authorized, but an approved sending domain/address and provider credentials are not supplied. Local delivery therefore remains in Mailpit. `local-backend-workspaces.md` provides the sender, hosted/local Supabase and app settings. Outlook is the destination inbox, not a required SMTP sender. Supabase owns OTP issuance/verification; the app uses `shouldCreateUser:false` and `verifyOtp(type:'email')`, clears typed codes, shows a resend countdown and preserves staff MFA/identity gates. Live mode exposes the account page at `/login` or `/?authSetup=1`; ordinary live OJT pages remain blocked pending adapters and acceptance. Demo login still belongs to the separate prototype.

Real Auth acceptance uncovered the disabled email provider. Local `auth.email.enable_signup=true` enables email authentication, while global `auth.enable_signup=false` blocks public signup. Both behaviors were verified with actual requests. Codes are six digits with 600-second expiry and 60-second resend minimum; invite/recovery links share this expiry. The synthetic Mailpit test verified correct OTP sign-in, rejection of incorrect/consumed codes, signup blocking, a real unprovisioned JWT identity state and denied enrollment reads. The temporary Auth account was deleted; the synthetic Mailpit message remains unusable. No real Outlook mail was sent. Timed expiry, delivery failure cases and actual browser/MFA acceptance are not claimed.

Migration 032 adds service-only expired-template claims/deletion acknowledgment. Claimed expired reservations cannot publish; acknowledgment requires absence of the exact private Storage object; published assets are never selected. The local cleanup script executed successfully with zero expired candidates. Its nonempty/failure paths are verified in PostgreSQL tests. Operator health excludes cleaned intents; its paused email flag refers to notification outbox delivery, not Auth SMTP configuration.

Current verification: 153 automated tests passed, frontend build passed, migration 032 applied locally and public types regenerated. The last isolated database restoration remains the migration-031 snapshot; no later complete file/service restoration has been claimed.

### Configured local Brevo SMTP — October 14, 2026

The owner signed into Brevo, approved the verified existing Gmail sender for development and approved reuse of the `InTrack Supabase Auth` key with its actual `Never` expiry after the UI did not offer editing an existing key's expiry. No replacement key was generated; the earlier unrelated reservation-system key was left unchanged. The active InTrack key is stored only in ignored `.env`; source configuration contains an environment reference for its password.

`verify-brevo-smtp.mjs` successfully authenticated over required STARTTLS with certificate validation. `configure-local-smtp.mjs` wrote the local sender/host/port settings with a private configuration backup. `restart-local-auth.mjs --smtp` reloaded local Supabase without resetting database volumes and synchronized its public/operator connection keys. Inspection of the running Auth container confirmed `smtp-relay.brevo.com:587`, a one-minute resend interval and a present password, without printing credential values. The browser delivery hint is now `smtp`.

Supabase accepted one OTP request to the owner-specified PUP Outlook address, and the owner confirmed **Received in Inbox**. A temporary unprovisioned Auth fixture was removed afterward; this delivery-test code does not grant app access. No university memberships, enrollments, approvals or clearance records were created. Real sign-in uses coordinator-provisioned identities and retains MFA/notice checks.

This configuration is applied to the existing local Docker project, not a hosted cloud Supabase project. Production domain authentication and university configuration remain separate pilot requirements. Notification/outbox email remains separate from Supabase Auth. For future local restarts, load `.env` so the configured SMTP password reference resolves; do not run the synthetic Mailpit OTP acceptance script while external SMTP is enabled.

### Actual login and OTP pages — October 14, 2026

The normal `/login` and `/verify-otp` routes now use Supabase email OTP through the configured Auth SMTP delivery, in both demo and live runtime modes. Login is passwordless: registered email plus the emailed code. The selected role is only an intent, never an assignment. Signup is not enabled by the page (`shouldCreateUser: false`). The page clears retired prototype login/OTP records and never stores a code, code hash, password or invented authenticated user. Session storage contains only normalized email, role intent and request time to support refresh. Resend has a 60-second interface cooldown in addition to Supabase enforcement; Supabase owns actual expiry and single-use verification.

Verification leads to `/account-access`, which reads caller-scoped identity and handles missing/disabled accounts, activation, current-notice acknowledgment and staff authenticator MFA. Displayed privacy text must match the configured notice version before acknowledgment is offered; mismatched/missing notice blocks account setup. This does not publish an institutional privacy policy. Unfinished MFA can be resumed or restarted; verified factors cannot be removed through that control. Retired password-decision, browser reset and fake email-verification routes redirect to the real sign-in/account flow.

Real authentication does not populate legacy localStorage `user` or grant access to the prototype dashboard. The domain dashboards still need their live adapters. A ready development account can open the existing protected saved-requirements workspace. Account registration/invitation remains coordinator/operator-managed; the earlier temporary Outlook delivery-test user was removed and does not become a university account through signing in.

The owner-confirmed SMTP inbox test predates this page change. Browser checks for this change cover rendered login, direct OTP/account route guards and retired fake-email links; no additional external mail or actual-user verification was performed during these UI checks. Credential issuance, role provisioning and institutional decisions are not fabricated for testing.

Verification for the actual-page change: **155 automated tests passed**, including real-provider request/verification contract tests and challenge storage validation; the final frontend build passed with the existing large-bundle warning. The browser displayed the updated normal login, rejected direct OTP access without request metadata, redirected signed-out account access and redirected retired fake email-verification links. Complete user-entered inbox-code/MFA/activation acceptance through these pages remains to be exercised with a provisioned account. Local Auth currently retains a two-email/hour service limit; the resend countdown cannot override it. Sender/domain and hosted-project production configuration remain unchanged.

### Preserve original login UI — October 14, 2026

The owner's correction supersedes the passwordless UI described above. The login again retains the branded header, centered card, Welcome Back heading, Student/Adviser/Coordinator icon tabs, PUP Webmail label, password field with visibility toggle, Forgot Password link, Login button, activation information panel, terms/privacy footer and existing privacy dialog. Supabase checks the entered password using a separate nonpersistent Auth client, revokes that transient session, and only then requests the emailed OTP. No password is copied into navigation metadata or the legacy account snapshot. Supabase's email OTP remains server verified; this sequence is not Supabase AAL2, so staff authenticator requirements remain enforced by protected identity. The pre-login privacy dialog does not manufacture the database's required current-notice acknowledgment.

Forgot Password keeps its existing card layout and now requests real Supabase recovery instructions, using the existing recovery-link/account-setup handler rather than a browser OTP preview. No university account was provisioned and no extra external message was sent during UI review. Browser review confirmed the restored login controls and visual layout.

Verification: 157 automated tests passed, including password-check ordering and prevention of OTP issuance after rejected passwords, missing password sessions or failed transient-session revocation. The frontend build passed with the existing large-bundle warning.

### Local login configuration troubleshooting — October 15, 2026

A duplicate `VITE_SUPABASE_PUBLISHABLE_KEY` entry in `.env` placed an invalid value after the valid public key. The duplicate was removed without printing key material; exactly one publishable-key entry remains. The local sync tool now replaces all duplicates of each managed setting with one authoritative value, including whitespace/export forms. Restart Vite after this correction. No Auth account, role, SMTP credential, database row or UI layout was changed. `node --check scripts/sync-local-supabase-env.mjs` passed.

To run with the existing Brevo configuration: open Docker Desktop; from the project run `node --env-file=.env scripts/restart-local-auth.mjs --smtp`; in a second terminal run `npx supabase functions serve --env-file .env`; in a third terminal run `npm run dev:client`. Stop an already-running frontend before starting it again. Open `http://localhost:5173/login` with a provisioned Supabase account and its actual password, then enter the latest emailed OTP. Prototype passwords/accounts and the deleted Outlook delivery-test fixture do not authenticate. Do not reset the database to troubleshoot login.

### Coordinator whitelist → default password → OTP → password decision — October 16, 2026

The owner clarified the intended first-login flow and approved **one shared default password configured privately**. This supersedes the previous invitation-first/passwordless descriptions for newly whitelisted students and advisers. The existing normal login UI was not changed in this update.

The coordinator's protected backend workspace now provisions Student/Adviser whitelist accounts using the existing program/domain/masterlist/MFA authorization. The server creates the initial Supabase credential using `INTRACK_DEFAULT_PASSWORD`, links the new Auth identity and whitelist setup atomically, and leaves the application profile invited/inactive. It does not send an activation invitation or grant enrollments. Existing active identities can receive a permitted additional membership without resetting their passwords. Creation/link failure preserves the original reservation for explicit reconciliation rather than overwriting an existing Auth account.

The shared default was generated into ignored `.env` without printing it or applying it to existing accounts. `.env.example` documents the variable. The browser cannot provide or retrieve this default through the provisioning endpoint, and command receipts/retry metadata/audit records contain no password. Trusted administration must supply the shared default to approved users privately. Changing the configured default affects future provisioning, not existing credentials.

Normal login validates the provided credential and requests the real email OTP. After verification, authoritative identity sends a newly whitelisted user to the original Password Decision page. `Change Password Now` updates Auth and then commits activation; `Do It Later` keeps the default and activates without pretending a password change occurred. The retained-default suggestion is stored in a private table and appears again after a later login; successful replacement clears it. Activation records the configured current-notice acknowledgment and still requires the matching active membership. Missing/mismatched displayed privacy text blocks activation rather than acknowledging unseen content. Staff MFA remains a separate backend access requirement.

Migration `202610160033_whitelist_password_decision.sql` adds deny-by-default private setup records, coordinator-scoped linking, and server-only decision completion. Its identity wrapper requires an Auth-issued OTP method for whitelisted accounts; password-only sessions and forged user metadata do not unlock domain RPCs. The original public identity function OID is preserved with CREATE OR REPLACE; its prior implementation is a private helper with no client execution grant. The Edge activation handler independently verifies Auth claims before a whitelist decision. Expiration of an old invitation link does not expire the coordinator's whitelist; suspension/revocation still blocks activation/access. Legacy non-whitelist invitations retain their original expiry rules.

Validation: **164 automated tests passed**, including isolated PostgreSQL whitelist scope, wrong-role/MFA, default-only rejection, inactivity before the decision, both decision outcomes, retry/audit behavior and revocation; frontend routing and OTP-proof tests also passed. The frontend build passed with the existing large-bundle warning, and both modified Edge Function entry points bundled successfully. These are source/isolated tests, not a new real-inbox/browser acceptance run. Public TypeScript signatures were updated for the new RPCs; regeneration from the local stack remains pending.

**Local application is pending:** the attempted forward migration could not connect, and Docker reported `Docker Desktop is unable to start`. Migration 033 was not applied; no existing database was reset. Once Docker works, run the SMTP-aware local reload, apply the migration, then serve functions with their private default:

```powershell
node --env-file=.env scripts/restart-local-auth.mjs --smtp
npx supabase migration up --local
npx supabase functions serve --env-file .env
```

Run the frontend separately with `npm run dev:client`. A ready development coordinator can reach **Manage approved users and whitelist** from `/account-access`, or use `/?backendTest=1`. The original coordinator management screens and role dashboards remain prototype adapters; they must not be represented as saving these real whitelist operations. The protected workspace is the real implementation currently available. Approved domain/masterlist and current-notice settings are still prerequisites and have not been invented or published for university use. Hosted secrets/deployment and actual first-login acceptance remain pending.


### Authenticator before password decision (local update, October 16)

Migration 202610160038 is applied locally. Whitelisted students and advisers now complete: webmail and password → emailed OTP → authenticator app setup/challenge → password decision → activation. First-time users enroll a TOTP authenticator; existing verified factors are challenged. Email OTP remains required alongside verified AAL2 assurance. Password Decision and Change Password redirect MFA-incomplete sessions to Account Access. The activation Edge handler checks verified Auth claims before changing any password or activating a whitelist account. Coordinator MFA and its dashboard route remain enforced. The OTP verification page layout is unchanged.


### Password replacement and later sign-in (October 17)

Owner-approved migration 202610170039 is applied locally. Whitelisted students and advisers who retain the default continue to verify email OTP and their authenticator before the password decision. After server-confirmed replacement (`requires_password_change=false` and a recorded `password_changed_at`), later sign-in uses their chosen password plus email OTP and skips the authenticator challenge and password reminder. Existing authenticator factors are preserved; this change does not delete recovery/enrollment records. Active coordinator membership still requires MFA. Notice, suspension, membership, and OTP checks remain enforced. First-login password replacement itself still requires both email OTP and AAL2 verification at the activation endpoint.


### Current MFA login policy (October 17; supersedes the OTP-only exception)

Migrations 202610170040 and 202610170041 are applied locally. Every role requires password authentication, an additional email verification step, and an authenticator app challenge for each new login. Replacing the default password removes only the password reminder. The main Auth session retains its verified password AMR; email OTP is checked in an isolated transient session. The `confirm-login-email` handler verifies both JWTs with Auth, requires matching users and recent distinct sessions, and records a private receipt bound to the password session. Raw tokens and OTPs are not stored in the database. The receipt expires after 12 hours and is deleted with its password session. Protected identity requires password AMR, a valid matching email receipt, and AAL2 assurance; email OTP plus TOTP without password proof is denied. First-login activation also checks password AMR and MFA. The authenticator page and first-name greetings remain shared across roles. Existing users must sign in again under this flow.

Validation: isolated database and unit tests cover password replacement, all roles, forged claims, mismatched/stale sessions, private receipt permissions and expiry. A disposable local Auth account verified the complete password → email proof → TOTP → ready sequence, including rejection of an OTP-only caller. The disposable account and factor were removed; real users and their factors were not changed. This implements the MFA flow; it is not a formal certification of all NIST AAL2 requirements (including phishing-resistant options and operational controls).


### Protected student portal (October 17)

Ready students now enter `/dashboard` after required activation/password setup and MFA. The original StudentDashboard, Layout and student module components are reused; typography, cards, sidebar and page structure are preserved. The dashboard route and shared messages/settings routes dispatch by verified server roles, and student module routes use StudentPortal rather than demo/local-storage authentication. Controlled Auth/OJT context bridges supply only the signed-in profile and scoped saved reads; legacy demo providers are not mounted. Migration 202610170042 adds a caller-only profile read protected by the student role and current MFA. Existing enrollment projections supply stages, credited hours, requirements, attendance, DTR, academic logs and portfolio states. Before enrollment, the dashboard shows the saved account and curriculum hours with zero progress and deployment locks; no enrollment or clearance is created. Saved feedback/notification data replaces sample approvals. Protected document downloads use the student role.

Scope: login routing and saved reads are connected. Original controls whose save handlers are not integrated are blocked with an explicit failure; they do not persist a mock submission or display a successful backend save. Student messaging currently has an empty saved-data view and blocked send, and profile edits remain blocked. Original developer simulation controls cannot mutate real records. Further module-by-module write integration is separate from this portal connection.

Validation: 199 automated tests passed, including caller-only profile authorization, MFA denial, enrollment-free projection and student dashboard routing. An isolated UI preview verified the original dashboard and Pre-OJT navigation. A disposable local Auth student verified its own portal profile after password, email proof and authenticator verification; the fixture account and factor were removed.

### Student requirement uploads (October 17)

Migration 202610170043 is applied locally. The original Pre-OJT, During-OJT, Post-OJT and MOA dialogs now use the real upload pipeline. File bytes go directly to the private `ojt-documents` bucket. The existing PDF-only dialogs retain that restriction and a 10 MB limit; the storage pipeline also supports JPEG and PNG for modules that permit them. Server finalization checks measured size, format signatures and SHA-256 before saving the versioned submission, audit and workflow notifications. Format validation is not a malware scanner. Downloads require current scope and use links valid for 60 seconds. Student clients cannot publicly read, overwrite or delete files.

Checklist labels resolve to a single assigned requirement by enrollment, stage, explicit occurrence and template aliases. Unassigned or ambiguous items fail. Saved filenames, final server statuses and current review remarks reload from PostgreSQL. Student views do not treat an intermediate adviser approval as final approval under a two-role review plan. MOA uploads preserve coordinator routing status. Physical confirmations save requests for actual staff verification. DTR, journal, evaluation and portfolio artifacts retain their dedicated workflows.

Upload command IDs and reservation metadata are retained for retries; file bytes are not cached in browser storage. Repeated clicks are blocked during saving. Success appears only after finalization. Expired uncommitted reservations and definitive validation/conflict failures can start fresh; unknown transport failures retain the original IDs.

**Configuration prerequisite:** the local database had zero enrollments, zero published policies and zero assigned requirements when this integration was applied. Whitelisting provisions an account only. A scoped coordinator must configure and publish a policy with explicit reviewers and occurrences, then create the student's enrollment and assigned requirements. The supplied portfolio list remains an additive display catalog until assigned. No institutional settings, enrollment or deployment clearance were fabricated. The existing policy/enrollment controls are in the protected local backend workspace at `/?backendTest=1`; policy publication requires complete confirmed settings.

Validation: automated tests and the production build passed. A disposable local account completed password, email proof and authenticator verification, uploaded real bytes, finalized a saved submission, reloaded its actual filename and downloaded identical bytes through the protected endpoint. Anonymous reads and replacing a pending submission were denied. Its test file, account, factor, enrollment and policy were removed afterward. Real user authentication and enrollments were not changed.


### Unenrolled student access (October 17)

A verified student without a saved OJT enrollment can access only /dashboard. StudentPortal redirects other student module, account-feature and print routes back to the dashboard before mounting those pages. Its original enrollment warning explains that the coordinator must assign a practicum component, term and requirements. Sidebar entries, dashboard shortcuts, clock controls, search, notification dropdown and profile/settings menu actions are disabled; navigation controls and sign-out remain usable. The header says Not enrolled and stage progress is 0/4. No enrollment is inferred from the whitelist, curriculum hours or displayed checklist. Dashboard data refreshes from scoped enrollment reads on focus or every minute, so a coordinator-created enrollment is picked up without a new activation. Existing enrolled students retain their separate stage restrictions.

Coordinator enrollment controls currently exist only in the protected development workspace at /?backendTest=1: Coordinator administration → student, published policy and academic term → Create enrollment. The normal coordinator Student Management and System Configuration pages do not yet expose enrollment/practicum/term administration. The development workspace selects existing terms; it has no term-creation form. These are remaining coordinator UI integrations, not completed features.

Validation: enrollment-route policy tests, student projection/upload regression tests and production build passed. An isolated browser preview entered the Pre-OJT route without an enrollment and displayed the dashboard with its enrollment explanation and disabled controls. No real student records were changed.


### Class-code enrollment and staff configuration (October 18; supersedes manual enrollment guidance above)

Migrations 202610170044 through 202610170047 are applied locally. The normal coordinator sidebar, Student Management and System Configuration link to /coordinator/enrollment. Verified advisers reach /adviser/enrollment through their protected portal and after account setup/MFA. Both roles can create academic terms and read published practicums. Coordinators publish practicum requirement versions, retaining the approved curriculum hours/year/semester; advisers create their own classes and approve student join requests. The normal coordinator Allocate action has been replaced with Enrollment. Other adviser modules remain outside this integration and are disabled in the protected configuration shell.

The coordinator selects the program and curriculum component, reviews the complete additive 46-item proposed checklist, chooses reviewers, evidence types, submission windows, required flags and optional deadlines, records a reference and confirms publication. Blank deadlines explicitly mean no fixed deadline. MOA routing requires the coordinator; system DTR/journal bindings require the adviser; system portfolio bindings require both reviewers. These compatibility rules are checked in the browser and database. Document-intake publication does not require invented attendance/GPS defaults: it stores attendance confirmed=false and cannot issue deployment clearance. Full publication requires explicit confirmed attendance settings. No real policies, terms or enrollments are seeded automatically.

An adviser creates a class for an authorized program, published practicum, matching section year and academic term. The class creator becomes its adviser automatically; another adviser cannot take over the same program/term/section. This is a recorded class-creation workflow, not an inference from an external university teaching schedule. Sections saved as roster display details are not treated as authorization. The adviser receives a private 10-character code and can copy, reset, enable or disable it. Reset invalidates the former code; disable stops new requests without deleting pending requests or existing enrollment. Term expiry and active adviser membership are enforced. Coordinators can view the program-scoped class/request overview but cannot retrieve another adviser's code or approve that adviser's requests.

A ready student enters the class code on the dashboard. The backend verifies the student's existing whitelist program/section and the adviser's current authority, then creates only a pending request. It does not create an account, membership, enrollment or adviser assignment from the code alone. The dashboard-only lock remains until approval. Failed code attempts use a generic result and are limited to five per minute per verified student; failures persist their rate-limit records. Only the class adviser can approve or reject with a reason. Approval atomically creates the enrollment, frozen requirement assignments, class membership, adviser assignment, audit/history and notification records. Manual adviser enrollment is no longer publicly executable; its private helper is invoked by approval. Rejection creates no enrollment; the class adviser may reconsider a rejected request with a new reason, retaining history. Repeated and stale commands cannot duplicate or replace decisions.

Student request status refreshes every 20 seconds, on focus, or on manual refresh; approved requests refresh scoped student records and unlock their existing Pre-OJT modules. Existing stage/deployment restrictions remain separate. The dashboard join control also remains available for later practicums, and saved enrollments retain their own versions. Backend draft cleanup removes enrollment/join command IDs on sign-out. File bytes and login credentials are not stored in those drafts.

Validation: the full automated suite passed 223 tests, followed by targeted tests for the final reviewer-plan and retry changes. Production builds passed. Isolated browser previews verified the adviser code/request controls, the coordinator's full retained checklist and bulk reviewer compatibility, and the student's pending-approval dashboard. A disposable local coordinator, adviser and student each completed password, email proof and TOTP; they published intake configuration, created a term/class/code, requested/approved membership, loaded saved student records and uploaded real requirement bytes. Deployment stayed not_issued. The test accounts, factors, code, requests, policy, term, enrollment and object were removed. Generated database TypeScript definitions include the new RPCs.

Remaining boundary: publishing a later full policy does not silently alter an existing intake enrollment's frozen policy. An audited enrollment-policy amendment is still required before moving those intake records to a different published training policy. Other adviser/student module write adapters, institutional attendance/retention decisions and production pilot acceptance remain separate work.

## October 18: Restore coordinator Template Management references

Migration 048 restores the original 15 Google Drive/Docs reference links, including their names, categories and descriptions, in a private per-program template_links catalog. These remain external links; no uploaded files or external document permissions are fabricated. Private template file versions remain separate and are still displayed/downloaded through their existing protected storage workflow.

The original coordinator table and add/edit dialogs now read saved links and persist publication, metadata edits and disable/republish actions through authenticated RPCs. Membership scope and ready identity/MFA are checked server-side; anonymous/direct table access is revoked, changes are audited and retry-safe, stale revisions are rejected, and links require HTTPS. Multi-program coordinators select the program being managed. Loading, empty and error states are explicit rather than rendering an unexplained blank table. The new read RPC also filters disabled links for student/adviser callers; their existing Forms & Templates UI adapters are separate from this coordinator restoration.

Validation: four PostgreSQL integration tests verify all original reference values, scoped permissions, replay/stale-command handling, disable/republish visibility and invalid URL rejection. Migration applied locally and generated database types refreshed. Production build verified. The linked Google documents themselves were preserved without being edited or their sharing permissions changed.

## October 18: Simplified My Classes and standard program checklists (supersedes publication UI)

The owner selected the simpler class-code workflow. The existing enrollment URLs remain valid, but the adviser navigation and page are now My Classes, with My Classes, Create Class, Join Requests and Class List controls. Coordinators have Classes & Requirements with Classes, Program Requirements and separate Attendance Settings. The normal portal no longer exposes a practicum-publication step, publication modes, approval-reference fields or class-reference fields.

Migration 050 initializes one private checklist per program with all 46 existing requirements, retaining the latest saved requirement overrides and additional configured rows where available. Default review is adviser, with MOA routed to the coordinator; no deadlines or attendance/GPS values are invented. Coordinator saves use revision checks, append-only checklist history and audit receipts. Existing items cannot be removed by the editor. Requirement editing changes future classes only; existing class/enrollment snapshots remain unchanged. The historical policy-publication RPCs remain protected for compatibility, but are not part of the normal new class workflow.

The adviser enters academic year, term and section under their authorized program. Hours and curriculum component are determined server-side from the approved program/year/semester mapping; supplied policy IDs, adviser IDs or hours cannot override them. Existing term dates are reused in long-date display format; new term dates are entered inline. Class creation atomically registers/reuses the term, freezes the current checklist and attendance settings into an internal version, and creates an adviser-owned class/code. That freeze is application snapshot bookkeeping, not a claim of institutional policy approval. No coordinator publication is required to begin document intake.

Entering a code still creates only a pending join request. Approval records the adviser, enrollment and all requirements; rejection requires a note. The new protected Class List reads actual enrolled class members and excludes pending students. Other advisers cannot read the roster or approve requests for another class. Coordinators can oversee their scoped programs without seeing adviser class codes. Existing code rotation, disabled-code checks, rate limits, whitelist program/section checks, MFA and dashboard-only access before approval remain intact. Deployment clearance remains separate.

Attendance settings are maintained separately for future classes. Unconfigured attendance stays disabled; an explicit coordinator confirmation and bounded values are required. Existing intake classes do not silently inherit later attendance settings; an audited amendment remains necessary to change their frozen training configuration. No real attendance policy values were supplied or seeded during this change.

Validation: 233 automated tests passed, including six new PostgreSQL workflow/security tests; production build passed. A disposable local adviser created a term/class/code without publication, a student requested and received approval, Class List correctly changed from empty to enrolled, saved student reads and a real private upload succeeded, and deployment stayed not_issued. All disposable Auth factors/accounts, term, class, requests, snapshots, enrollment and upload were removed. Isolated browser previews verified automatic 500 BSIT hours, long term-date labels, the absence of a published-practicum selector, the ready 46-item coordinator checklist and Save requirements instead of publication. Generated database types include the new APIs.

### Coordinator overview and custom requirements follow-up

The owner explicitly authorized the local school coordinator to oversee BSIT, BSCpE, BSHM and BSOA. The existing coordinator's active program memberships were extended and audited; no adviser/student role or authentication factor changed. Classes Overview defaults to All programs and supports filtering; coordinator Join Requests, Class List and per-class roster actions are hidden. Adviser controls remain available. Program Requirements and Attendance Settings still target one explicit program.

Coordinators can use Add Requirement to append a named Pre/During/Post item, choose file/physical evidence, reviewer, mandatory flag, submission windows and optional deadline. Adding creates a clearly indicated local checklist draft and reveals the selected stage; Save requirements persists it through the existing scoped/revision-checked RPC. The dialog prevents duplicate names within a stage and enforces the 100-item checklist cap. Existing items are retained, and existing classes remain frozen. PostgreSQL tests verify an added 47th item and deadline persist into a new class while the previous class retains 46 items. Six workflow tests and production build passed. Isolated browser verification confirmed coordinator-only overview controls and a newly added Post-OJT item increasing its stage count from five to six without altering other stages. No synthetic requirement was saved to the real local program catalog.

### Requirement descriptions

Migration 051 adds bounded plain-text descriptions to requirement definitions and the protected requirement projection. New checklist items require a nonblank description; existing items without descriptions remain compatible. The coordinator Add Requirement dialog includes a required description, and existing descriptions can be edited in the checklist. Descriptions persist in checklist/history JSON, new class definitions and enrollment snapshots. Students see their assigned description in Pre-, During- and Post-OJT checklists, with original explanatory text used when no saved description exists. Existing class descriptions are not rewritten by later program edits. Sixteen targeted tests, a production build and the disposable local enrollment/read/upload verification passed. The dashboard subtitle now says Monitor OJT activities across all four programs.

### Adviser modules are accessible before class creation

The protected adviser navigation no longer uses an integration-path allowlist to lock whole modules. Dashboard, My Classes, Forms & Templates, Review Requirements, Student Monitoring, Attendance Monitoring, Weekly Journal Review, Portfolio Completion Review, Messages and Settings open without a class prerequisite. Dedicated adviser URLs prevent shared dashboard/messages/settings links from redirecting back to My Classes. The original page layouts are retained, with zero counts and empty states when there are no actual assignments.

The adviser provider reads authenticated, assigned enrollments and requirements, owned-class metadata/rosters and scoped notifications. It loads academic, DTR, attendance and portfolio details only for the relevant modules, with bounded enrollment request concurrency; no demo students are injected. Current profile ownership is checked before rendering saved records. Requirement, journal and DTR review adapters wait for server decisions before the original UI reports success. Portfolio revision requests are connected; final portfolio approval still requires the separate item-by-item verification workflow and is not simulated through the generic button. Whitelisting remains coordinator-only, and unfinished profile/preference writes stay disabled for protected advisers. Messages opens its original empty shell; its adviser send adapter remains separate work. Authentication, OTP and authenticator requirements are unchanged.

Validation: ten targeted data-isolation/identity tests passed and production builds succeeded. A disposable adviser could load empty dashboard data before creating a class, and all six data-bearing adviser module reads succeeded after approving a disposable student; the student's private upload still succeeded and deployment stayed locked. Test records were removed. An isolated browser clicked through every adviser sidebar module with no classes and confirmed the actual original screens opened without lock redirects or sample student records.
