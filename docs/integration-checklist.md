# InTrack Supabase integration checklist

The preparation specification is `backend-readiness.md`. This checklist tracks implementation and verification separately. Unchecked items are required backend work.

## October 16 local whitelisting checkpoint

- [x] Ready coordinators automatically enter `/coordinator/dashboard` after email OTP and required authenticator verification; the OTP page UI is unchanged.
- [x] Coordinator sidebar connects dashboard and all module routes behind the same Supabase identity/MFA gate. Backend workflow controls are reused for modules whose original UI adapters remain pending.
- [x] Dashboard aggregates scoped saved records rather than reference/demo figures. Unavailable historical analytics are explicitly labeled.

This checkpoint supersedes older pending-local-deployment notes below.

- [x] Migrations 033–035 applied locally; regenerated public database types.
- [x] Normal Student Management and Adviser Management use protected, program-scoped Supabase rosters and persisted whitelist operations.
- [x] Whole-batch CSV validation, safe provisioning retries, pending/error states, reasoned access changes, and adviser contact/section persistence.
- [x] Owner-approved local student/adviser domains configured; shared default remains server-only.
- [x] Owner-authorized synthetic coordinator recovery and old authenticator reset completed; old sessions invalidated. Owner reports setup complete; one verified factor confirmed without reading secrets.
- [x] Local-only `dev-test-only` notice accurately displayed for development activation; no institutional notice approval invented.
- [x] 174 automated tests and frontend build passed. Local frontend and Edge Functions running.
- [ ] Signed-in acceptance of both normal coordinator pages and provision/retry/access actions in the owner's browser.
- [ ] Complete newly whitelisted user login/default-password → real email OTP → password decision → activation acceptance.
- [ ] Remaining dashboard/enrollment adapters and institutional pilot decisions. Whitelist creation does not create an enrollment.

See the current setup section in `local-backend-workspaces.md` for local URLs and restart instructions. Original login layout is preserved. Other prototype pages are not evidence of backend persistence.

## Current local implementation — October 14, 2026

This section supersedes older deployment-pending notes below. Historical acceptance scenarios stay unchecked until their actual end-to-end verification is recorded; a synthetic PostgreSQL test is not a real Auth/Storage test.

- [x] Apply migrations `202610100001` through `202610140032` to local Supabase and regenerate public API TypeScript definitions. Preserve the frozen baseline and all previously applied migrations.
- [x] Record BSOA second-semester labels for both 300-hour components. The owner subsequently supplied the coordinator portfolio contents; these are recorded additively. Program applicability, reviewers/deadlines and attendance settings remain unset.
- [x] Preserve the 32 coordinator-template contents in an ordered catalog/portfolio outline; add the orientation certificate and post-OJT CV to new and saved demonstration checklists without deleting existing fields, evidence or custom requirements. Record title mappings separately from live evidence equivalence. No database policy publication is performed.
- [x] Implement scoped masterlist preview/commit, exact domain configuration, membership changes, Student/Adviser invitation reservation/linking and retry recovery. Provider resend/token invalidation and formal verified-MFA recovery remain pending.
- [x] Implement immutable policy publication, enrollment snapshots, occurrence generation, adviser assignment and the shared enrollment projection. Publication requires explicit approved settings; demo defaults cannot issue real clearance.
- [x] Implement physical evidence observations, seven coordinator MOA states, same-copy notarization/SAS checks, approved placements, evidenced waivers and explicit clearance/lifecycle commands. Completion/reopen commands now require verified portfolio coverage, exact source revisions, both decisions, credits and the explicit requirement bindings.
- [x] Implement scoped notices/read state, participant messages and announcements. Email delivery remains paused; message read state, workflow notices and enrollment reports are implemented; the email delivery worker remains pending.
- [x] Add development-only real-backend workspaces and local password-recovery handling. Normal production pages still use demonstration providers.
- [x] Add operator-only verified-asset inventory and separate asset backup/isolated restore tooling. This does not back up the database or establish a tested recovery procedure.
- [ ] Execute real invited-user activation, staff MFA, recovery, Auth-success/link-failure reconciliation and browser file upload/download acceptance.
- [x] Implement and locally apply attendance/DTR/credit, correction/reconstruction, task/journal/evaluation/portfolio, completion/reopen, specialized bindings and revocation commands. Synthetic PostgreSQL tests verify their supported workflows; no real university policy is published.
- [x] Implement private PDF template publication, scoped upload/download, measured-byte verification, immutable versions, archive and download auditing; add `/?templatesTest=1`. DOCX, scanning and browser acceptance remain pending.
- [x] Implement enrollment search/report pagination and staff-only audited CSV exports. Receipt replays reject lost row authority; CSV cells escape spreadsheet formulas. Other artifact search/export remains pending.
- [x] Add shared successful-command burst control (300 new commands/minute/actor), service-only aggregate health projection and an executed local health script. Auth/edge/IP protection, failed-attempt monitoring and service alerts remain pending.
- [ ] Finish approved policy amendments/additional reviewer plans, invitation resend/MFA recovery and production gateway/page replacement. Execute actual Auth/Storage/browser acceptance.
- [x] Execute a fresh same-instance application/Auth/Storage-metadata restoration after migration 031: 99 tables and 223 rows with matching hashes. Source data remains intact; file bytes/services/independent-host recovery are not covered.
- [x] Execute independent-connection duplicate-reservation and concurrent template-publication races against the verified restoration clone. SQL Auth claim fixtures do not establish real JWT acceptance.
- [x] Follow-up verification: 150 automated tests passed, final frontend build passed (existing large-chunk warning), four Edge Function entry points bundled, and public database types regenerated. Activation/invitation bodies are now bounded while streaming rather than after unrestricted allocation.
- [x] Implement email OTP in Supabase account access with no automatic account creation, code-only email template, 600-second expiry, 60-second resend interval and preserved staff MFA. Enable the email provider while retaining global signup blocking.
- [x] Verify real local Supabase Auth + Mailpit OTP issuance/verification, incorrect/consumed code rejection, public signup denial and unprovisioned JWT enrollment-read denial. Remove the ephemeral synthetic Auth account afterward.
- [ ] Complete production sender/domain and cloud configuration, timed expiration and browser/MFA failure cases. Local approved development SMTP and actual Outlook Inbox delivery are verified in the later SMTP entry below. Notification/outbox delivery remains separate work.
- [x] Implement service-only expired-template cleanup with publication blocking, exact Storage deletion confirmation and idempotent acknowledgment; execute the local cleanup script (zero expired candidates).
- [x] OTP/cleanup batch: 153 automated tests passed, frontend build passed, migration 032 applied and public database types regenerated. Database restoration last covered migration 031.
- [x] Configure approved development Brevo SMTP locally, verify STARTTLS authentication and running Auth SMTP host/port, and execute a Supabase OTP delivery test. Owner confirmed arrival in the PUP Outlook **Inbox** on October 14, 2026. SMTP key stored in ignored server environment; its `Never` expiry is explicitly owner-approved.
- [ ] Configure cloud SMTP and university-approved sending domain; complete end-to-end provisioned-user activation/sign-in/MFA/expiry and delivery failure acceptance. The successful local Inbox test does not close those gates.
- [ ] Execute independent-connection attendance/review/credit races and combined file-object/service recovery; establish approved retention, hosting region, full operational monitoring and pilot inputs.

Start the frontend with `npm run dev:client` and all local Edge Functions with `npx supabase functions serve`. Use `/?authSetup=1` for account setup, `/?backendTest=1` for administration, reports and communications, `/?requirementsTest=1` for evidence, `/?trainingTest=1` for attendance and academics, and `/?templatesTest=1` for private PDF templates. The development workspaces require local Supabase and protected identities; selecting a role does not grant authority. See `local-backend-workspaces.md` for the sequence.

## Preparation delivered

- [x] Backend stack and component responsibilities selected.
- [x] Part 2 identity workflows specified: invitations, activation, staff MFA, recovery, scoped membership administration, and global administrative boundaries.
- [x] Part 3 lifecycle specified and acceptance oracle tested: named transitions, independent clearance, immutable basis/history, withdrawal, reopen, and stable component identity.
- [x] Part 4 evidence/review specified: published occurrences, versioned files/templates, staff verification, sequential review plans, revocation, and same-copy SAS handling.
- [x] Part 5 attendance specified: server-time punches, scoped exceptions, historical closeout, corrections, Manila day allocation, DTR review, and credit invalidation.
- [x] Part 6 academic artifacts specified: immutable tasks/journals, rubric validation, signed evaluation evidence, portfolio dependencies, sequential reviews and historical finalization summaries.
- [x] Part 7 baseline executed in isolated PostgreSQL; structural database tests, integrity guards, frozen migration candidate, schema inventory and promotion/recovery sequence prepared.
- [x] Part 1 architecture finalized: private domain schema, RLS read views, caller-scoped commands, database authority checks, external-operation retries, and no separate live FastAPI backend.
- [x] Identity, role, program, and assignment scopes specified.
- [x] Lifecycle, document approval, and clearance separated.
- [x] Requirement versioning, revision history, and finalization rules specified.
- [x] Attendance exceptions, timestamp rules, and approved credit model specified.
- [x] PostgreSQL relational schema blueprint and restrictive access baseline written.
- [x] Typed gateway contracts and executable policy helpers written.
- [x] Institutional decisions identified with proposed defaults.
- [x] Integration, migration, operational, and usability acceptance scenarios defined.

## Gate 1 Local Supabase and authentication

- [x] Implement first-Coordinator operator reservation/linking and server-only activation migration, local bootstrap script, invitation template, and development setup/MFA harness. Synthetic PostgreSQL tests verify first-account uniqueness, command retries, exact email/Auth binding, blocked/expired setup and atomic activation.
- [ ] Apply `202610100003`, test actual local Mailpit invitation/password setup/activation/MFA, and exercise Auth-success/database-failure reconciliation. Scoped Student/Adviser invitation/import/resend and live login replacement remain pending. No production privacy version is approved by local test configuration.

- [x] Implement own-identity setup RPC in `202610100002_protected_identity.sql`, app reader and opt-in session hook; PostgreSQL tests cover caller isolation, current Auth status, activation, notice version, membership revocation and staff MFA.
- [ ] Apply identity migration to actual local Supabase, regenerate database types, and verify with real Auth JWTs. Identity RPC is a setup projection, not authorization for domain reads/writes. The approved notice version remains unset until trusted administration configures it.

- [ ] Provision isolated development/staging projects and approved region.
- [ ] Execute the SQL blueprint locally; correct and promote it to timestamped migrations.
- [x] Execute the reference model in isolated PostgreSQL/PGlite with minimal Auth fixtures; verify structural constraints, client grants, immutable records and rollback.
- [ ] Verify the frozen candidate in actual local Supabase, compare inventory/checksum, promote to tracked migrations and generate database types.
- [ ] Implement account invitations, protected memberships, recovery, SMTP, and staff MFA.
- [ ] Replace AuthContext/browser route guards with Supabase session/profile reads.
- [ ] Configure institution-approved student/staff email domains; test import dry run, atomic commit, duplicate/conflicting identity handling, and concurrent imports.
- [ ] Implement invitation reservation/reconciliation/resend and credential setup; test external Auth success followed by database failure without duplicate accounts or false activation.
- [ ] Test revoked/expired invitation links, unverified email, mismatched Auth UUID, staff aal1, membership revocation, and global suspension with unexpired JWTs.
- [ ] Verify recovery cannot activate unfinished accounts, restore suspended access, or grant roles; verify no credentials/tokens enter logs or receipts.
- [ ] Verify self-promotion fails, disabled accounts lose access, and role selection grants nothing.
- [ ] Create synthetic Student A, Student B, assigned Adviser A, unrelated Adviser B, and scoped coordinators.
- [ ] Add and test read policies for each table/view; test with real user JWTs, not service keys.
- [ ] Expose only the approved public read views and command wrappers; verify private domain tables are absent from the Data API.
- [ ] Test RPC calls directly without Edge Functions: denied scope, suspended profile, forged actor, stale revision, and invalid state must still fail.
- [ ] Verify normal Edge Function commands forward caller identity; admin credentials are limited to explicitly privileged administration/workers.

## Gate 2 One complete requirement workflow

- [x] Implement the local file requirement slice in migrations `202610100004` and `202610100005`, caller-scoped reads/commands, private immutable Storage uploads, server byte/signature/hash checks, submit/withdraw/review/revision history, atomic audit/notification/receipt writes, and privileged expired-upload cleanup. Both migrations are applied to local Supabase; TypeScript definitions are generated from the public API schema.
- [x] Verify PostgreSQL scope, MFA, client/worker privileges, Storage policy predicates, retry conflicts, transaction rollback, review order, version history and cleanup receipts with synthetic PostgreSQL tests. Verify basic file signatures in automated tests and the app build.
- [ ] Complete the real Auth/Storage/browser acceptance sequence below. The development workspace is separate from demo providers; the normal OJT screens and production live mode remain unconnected. Signature checks do not provide malware scanning or full document decoding.

- [ ] Implement upload intents, private storage policies, type/size/content validation, and immutable paths.
- [ ] Publish confirmed requirement/reviewer/stage/deadline/recurrence configuration; verify retry generation creates one instance per occurrence and catalog edits preserve snapshots.
- [ ] Verify document reservation and finalization bind to the exact requirement/enrollment/owner; test quarantine, missing bytes, oversized files and swapped identifiers.
- [ ] Implement current-version uniqueness and draft/revision/withdrawal history; ensure no approvals or physical verification inherit across versions.
- [ ] Test Both reviewer plan: adviser then coordinator; reject skipped/repeated steps and withdrawal after review starts.
- [ ] Implement staff verification records and specialized artifact projections; generic approval cannot approve MOA/DTR/journal/evaluation/portfolio artifacts.
- [ ] Implement submit/review/revise operations and transaction-specific database functions.
- [ ] Ensure actor/role/assignment comes from protected records and version/revision checks occur in the transaction.
- [ ] Verify Student A cannot access Student B files/metadata; unrelated advisers and other-program coordinators are denied.
- [ ] Verify upload succeeds but finalize fails: no false submitted record; retry is safe; orphan cleanup works.
- [ ] Verify two reviewers: only one decision commits against a revision; the other receives a conflict.
- [ ] Verify lost response/retry returns the original receipt; same command ID with different payload fails.
- [ ] Verify revision preserves old evidence and needs its own review.
- [ ] Verify save failure shows retry and never replaces remote data with fixtures.
- [ ] Verify review, audit event, notification, and command receipt commit atomically.
- [ ] Verify reassignment removes previous adviser access and preserves their historical attribution.

## Gate 3 Clearance and MOA

- [ ] Confirm official MOA routing and mandatory evidence.
- [ ] Verify NO MOA needs no file; other routing requires validated evidence; SAS submission requires notarization of the same version and coordinator evidence.
- [ ] Configure and publish confirmed program/term policy; freeze enrollment snapshots.
- [ ] Implement explicit clearance issue/suspend/revoke and enrollment transitions.
- [ ] Implement shared enrollment projections for dashboard/sidebar/MOA/attendance; routes and percentages cannot change lifecycle.
- [ ] Verify policy revisions cannot create duplicate component/attempt enrollments; keep component hour targets separate.
- [ ] Implement shared enrollment locks/revisions for lifecycle commands and all dependent evidence/credit changes; test concurrent approval revocation and finalization.
- [ ] Test suspended-session resolution, withdrawal, return to training, and completed reopening; preserve history and require fresh clearance/portfolio decisions where applicable.
- [ ] Test empty requirements, missing placement, waived requirement without reason, self-approval, and missing final MOA.
- [ ] Test revised MOA preserves approved history; explicit suspension blocks attendance with a visible reason.
- [ ] Test changing a policy/template does not silently change old enrollments.

## Gate 4 Attendance and DTR

- [ ] Implement server-side timestamps, Asia/Manila day keys, pairing by session, idempotency, and one-open-session constraint.
- [ ] Publish approved attendance settings; verify every exception is coordinator-scoped to placement, action and bounded dates and cannot bypass clearance.
- [ ] Test closeout after suspension/withdrawal/placement change: original basis retained, no new session, disputed interval pending factual resolution.
- [ ] Implement immutable session revisions, missed-clock-in reconstruction, and evidenced voiding; test reassignment/self-review and stale correction requests.
- [ ] Implement configured DTR periods, complete period/day coverage, frozen printable snapshots, source-revision checks and approved-period conflict checks.
- [ ] Test corrections shifting dates/earlier shifts invalidate all affected day allocations and DTRs, including other sessions/periods sharing the daily cap.
- [ ] Test GPS denied/stale/inaccurate/outside boundary; no mock fallback or open session is created.
- [ ] Test failed clock-in followed by valid clock-in, repeated click, previous missing checkout, midnight, and approved overnight shift.
- [ ] Test 08:00–17:00 with a 60-minute break yields 480 minutes; short shift deductions use actual overlap.
- [ ] Test geofence changes and placement transfers preserve historical configuration and sessions.
- [ ] Implement corrections, immutable revisions, DTR snapshots, approval, and unique credit allocation.
- [ ] Test approved-session correction removes obsolete active credit and forces DTR rereview.
- [ ] Test pending/disputed records do not count toward completion; transfer hours count once.

## Gate 5 Remaining modules
- [ ] Publish journal periods, reflection fields, task approval rules, evaluator windows/rubrics and mandatory portfolio categories; confirm direct staff assessment scope before enabling it.
- [ ] Test journal foreign/out-of-period/draft/stale task references, no-activity policy, and invalidated attendance sources; journal text cannot write hour credits.
- [ ] Test rubric identity, missing/duplicate/out-of-range scores, evaluator/date/evidence validation and exact totals; student transcription remains pending until verified.
- [ ] Test mandatory requirement coverage versus optional validated files, complete DTR sources, same-version portfolio review order, and source invalidation propagation.
- [ ] Implement immutable completion summaries and test reopen/recomplete preserves prior summaries and requires fresh portfolio decisions.

- [ ] Versioned tasks, journals, evaluation rubrics, portfolio manifests, and explicit completion/reopen.
- [ ] Scoped messages, announcements, notifications, delivery retry, search, reports, and CSV export validation.
- [ ] Test all requirements approved but hours short; hours complete but documents pending; portfolio pending; unresolved disputes.
- [ ] Test task revision after journal approval and document revision after portfolio submission.
- [ ] Verify each visible control has a meaningful action and accessible status/error states.

## Gate 6 Pilot readiness

- [ ] Confirm policy matrix, privacy wording, processing grounds, retention, region, and operational ownership.
- [ ] Run permission tests for every operation/table/storage object and verify no client can write authority fields.
- [ ] Run migration from a clean local project and upgrade a populated synthetic database.
- [ ] Test database AND private file restore in isolation; reconcile document metadata with actual object bytes.
- [ ] Confirm production API origins, redirect allowlist, rate limits, logs, monitoring, and secret handling.
- [ ] Remove MySQL and custom browser authentication from the live path; purge demo fixtures from live deployments.
- [ ] Run mobile/keyboard/screen-reader/zoom usability sessions with students, advisers, and coordinators.
- [ ] Reconcile any approved historical import; never transfer browser passwords or fabricate missing dates.
- [ ] Enable live mode only after all preceding gates pass.

Structural database tests and applied local migrations do not replace real JWT, Storage, browser, concurrency and recovery acceptance tests.

## Local requirement workflow test

The local workspace at `http://localhost:5173/?requirementsTest=1` saves genuine database records and private files. The normal dashboard remains a demo. Use synthetic accounts and sample files while testing this slice.

1. Finish the first coordinator's invitation, password, activation and MFA in `http://localhost:5173/?authSetup=1`. The configured local test notice must be `dev-test-only`. Keep `VITE_BACKEND_MODE=demo`; the dedicated development workspace runs separately.
2. Migrations through `202610100005` have been applied locally. On another checkout, apply them with `npx supabase migration up --local`. Do not reset the database or edit an applied migration.
3. Open local Studio at `http://127.0.0.1:54323`, then Authentication → Users → Add user → Create new user. Create `student.workflow@example.test` and `adviser.workflow@example.test`, each with a password of at least 12 characters that you choose. Enable automatic email confirmation for these synthetic accounts. Do not create roles through editable Auth metadata.
4. Open `database/local-requirement-fixture.sql`, copy the full SQL into local Studio's SQL Editor, and run it. This trusted local fixture creates the protected profiles/memberships, test notice acknowledgments, a synthetic BSIT policy, enrollment, adviser assignment and one file requirement with sequential Adviser then Coordinator review. It is safe to rerun without duplicate enrollments or submissions. It deliberately bypasses invitations for synthetic testing and is unsuitable for university data.
5. In a terminal at the project directory, run `npx supabase functions serve`. Keep it running; it serves both `activate-account` and `requirement-files`. If a terminal already serves only `activate-account`, stop it with Ctrl+C and restart without a function name. The file handler defaults its public URL to `http://127.0.0.1:54321`; any hosted environment needs an explicit `INTRACK_PUBLIC_SUPABASE_URL` and approved origins before use.
6. In another terminal run `npm run dev:client`. Open the account setup page, sign out, sign in as `student.workflow@example.test`, and follow “Open saved requirements workspace.” Select a real sample PDF/JPEG/PNG of at most 10 MB and choose “Upload and submit.” A saved version appears only after the server validates the private bytes and commits the submission.
7. Reload the page. Confirm the same submission, timestamp and version remain. In Studio, Storage → `ojt-documents` contains the object; the bucket is private. An ordinary public file URL must not download it.
8. Sign out. Sign in through the account setup page as `adviser.workflow@example.test`; enroll and verify the authenticator MFA code. Open the workspace. Download the submitted evidence, then request a revision with remarks. Reload and confirm the saved status and history remain.
9. Sign in again as the student and upload the revised sample. Version 2 must appear while Version 1 and its revision remarks remain accessible in history. Version 2 has no inherited approvals.
10. Sign in as the adviser with MFA and approve Version 2. Its overall status remains `under_review` because this test requirement uses both reviewers. Sign in as the original coordinator with MFA and approve the same version; it becomes `approved`.
11. In local Studio's SQL Editor verify persistence:

    ```sql
    select s.version, s.status, s.is_current, s.submitted_at,
           d.original_name, d.status as file_status, d.byte_count, d.sha256
    from intrack.submission_versions s
    join intrack.documents d on d.id = s.document_id
    join intrack.enrollment_requirements r on r.id = s.requirement_id
    join intrack.requirement_definitions def on def.id = r.definition_id
    where def.code = 'LOCAL-TEST-EVIDENCE'
    order by s.version;
    ```

12. Test failures: an unrelated adviser must see no assigned requirement; a student cannot choose a staff role; staff without MFA cannot read or review; invalid bytes cannot submit; a file from another enrollment cannot be substituted; refreshing after a failed save must never load demo records. Retry a pending upload with the original operation IDs. Pending operation metadata is stored per profile and requirement in browser storage, without passwords, file bytes or signed URLs. Discarding a pending operation leaves its bytes for bounded cleanup.
13. To remove expired unattached uploads after the reservation has expired by at least one hour, run `node --env-file=.env scripts/cleanup-requirement-uploads.mjs`. It processes up to 100 objects per run and records completion so later batches can advance. The operator key stays outside the browser. Submitted evidence and historical metadata are retained. Production requires a scheduled worker and approved retention settings.

This slice does not change MOA statuses, issue deployment clearance, credit attendance hours, or connect journals and portfolios. Scoped invitation administration, official requirement publication, malware scanning, real concurrent-request tests, and full production adapter integration remain prerequisites for a university pilot.

The actual `/login` and `/verify-otp` pages now use the Supabase email-code flow, replacing browser OTP previews. Successful verification routes to `/account-access` for protected identity, notice/activation and staff MFA checks. Domain dashboards remain prototype screens and are not authorized by a Supabase login. Use an already-provisioned Supabase account for sign-in; the temporary Outlook delivery fixture was deleted. Missing or mismatched current privacy text still blocks setup.

Owner UI correction: keep the original login design and password field. The current normal login checks the password through an isolated nonpersistent Supabase client, revokes that transient session, then requests the real email OTP. The earlier passwordless description is superseded. Staff MFA and protected account checks still apply. Forgot Password now checks activation and requests a real six-digit recovery code through Supabase. Reset Password verifies the email/code using the recovery type before the authenticator and password steps. Hosted deployments must also install the code-based recovery email template.

October 16 clarification: new Student/Adviser accounts use coordinator whitelisting with one server-only shared default, followed by real email OTP and the restored password-decision activation flow. Migration 033 and Edge handlers implement that flow; isolated tests passed. Local migration/deployment and a complete provisioned-user browser test remain pending because Docker Desktop could not start. Serve functions with the ignored `.env` file. Do not use the legacy browser whitelist as evidence of real provisioning.
