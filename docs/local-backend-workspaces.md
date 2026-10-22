# Local backend workspaces

## Current local setup — October 16, 2026

**Adviser Management consistency:** emails use regular font weight; separate Program and Section columns are adjacent. Filters and Add/Edit Adviser expose BSIT, BSCpE, BSHM, BSOA plus sections 2-1, 2-2, 3-1, 3-2, 4-1, 4-2 and existing saved values. The section selector preserves multiple adviser sections. Migration 037 (applied locally) filters advisers against their saved section array and retains migration 036's read-write RPC classification, MFA, program scope and grants. Program choices do not grant coordinator scope. Scoped whitelist SQL tests and frontend build passed.


**Roster transaction fix (migration 036, applied locally):** intrack_coordinator_roster was incorrectly STABLE even though its authorization helper acquires FOR SHARE locks. PostgREST therefore ran its POST calls in READ ONLY transactions, causing the reported import/reload error. Migration 202610160036_roster_transaction_mode.sql marks the existing function VOLATILE and reloads the API schema cache; its body, identity checks, MFA, scope and grants are preserved. Existing imports are not deleted or reset. A regression test reproduces the original read-only failure, applies the forward migration, then verifies the roster call and unchanged function privileges. A live read-only aggregate check showed 60 saved masterlist rows and 60 whitelist profiles with no reserved invitations.


**Import refresh and Excel section recovery:** Student Management refreshes the saved roster after imports (including partial provisioning failures) and resets search, page and status filters so imported records are visible without a manual refresh. Import errors persist inside the dialog as well as in toast notifications. Year & Section values converted by Excel into dates can be recovered only when that exact cell has an explicit day/month-only display format such as d-m or m-d; its displayed order is preserved. Date order is never inferred from the workbook filename or locale, and other date/numeric identity fields remain rejected with row/column guidance. The supplied workbook was inspected read-only; its latest copy parsed 60 BSIT rows with section 4-1. This was parsing validation, not coordinator provisioning or a database write.


**Owner-specified whitelist columns (current):** normal CSV and Excel imports require Student Number | PUP Webmail | Last Name | First Name | Middle Name | Program | Year & Section. This supersedes the former five-column portal file format below. Headers tolerate repeated whitespace/case changes and are matched by name. Student Number maps to the existing studentNumber field, PUP Webmail to email, Program to programCode, and Year & Section to section. Last Name and First Name are required; Middle Name may be blank. New imports store/display the explicit name parts as Last Name, First Name M.I., e.g. Dela Cruz + Juan Carlo + Reyes → Dela Cruz, Juan Carlo R. Each middle-name word contributes an uppercase initial; no middle name adds no suffix. Compound surnames and first names are preserved. Existing saved names are not guessed or bulk rewritten. Internal/operator masterlist tools retain their original five-field contract; normal portal imports convert the seven columns into it before server validation.


**Excel whitelist import:** Student Management → Import Masterlist accepts `.xlsx` and `.csv` through the original dialog layout. Excel reads the first worksheet, with headers `studentNumber,email,name,programCode,section` in the first row (column order may vary). Format cells as Text before entering identifiers, email, names, program and section; numeric/date cells are rejected to avoid lost leading zeros or Excel date conversion. Each file supports up to 500 students and 512 KB. Older `.xls` files must be saved as `.xlsx`. Workbook ZIP contents are bounded before parsing (8 MB expanded, 128 entries); encrypted/macro workbooks and unsupported formats are rejected. The file is parsed locally and the resulting records use the same whole-batch server validation, scope/domain checks, idempotent import and whitelist provisioning as CSV. No spreadsheet file is stored as a student requirement. Dependency installation reported zero known audit vulnerabilities. All 183 tests passed, including real XLSX parsing and existing provisioning/retry coverage.

**Original UI restoration:** normal coordinator routes again render the original CompanyManagement, MOAManagement, RequirementsReview, TemplateManagement, OJTDatabase, PortfolioManagement, Announcements and Settings components. Messages and account settings reuse their original layouts. The header, search area, notifications/account menus, sidebar spacing, collapse controls and logout dialog follow the original Layout component. Development workspaces no longer replace normal module pages. Student/Adviser whitelisting, server identity/MFA, direct dashboard routing and the 12-second OTP cooldown remain in place. No database records were reset or migrated for this UI correction.

A separate coordinator data adapter projects real enrollments, requirements, portfolio endorsements, announcements and private templates into the original component shapes. It never mounts the demo OJT/Auth providers. Supported mutations await server confirmation before success messages; protected documents resolve through authenticated downloads. Company/HTE directory editing, template-link metadata editing, global settings, announcement priority/deletion, final portfolio content verification and several export/preferences controls still require original-UI backend adapters; unavailable actions are disabled or explicitly fail without claiming a save. Existing development workflows remain available separately. Company/HTE directory lists are unavailable rather than fabricated. CSV export uses the server snapshot (up to 100 records).

Validation: 179 automated tests passed; original module components rendered in static empty-fixture previews with the original navigation. Company and MOA layouts were visually checked. This does not replace authenticated acceptance in the owner's browser.


OTP request limit: owner-requested five per minute per email is implemented as a server-enforced 12-second interval (`auth.email.max_frequency = "12s"`), with the same interval in both app resend countdowns. The separate project email budget is 300/hour (`auth.rate_limit.email_sent`); this hourly setting is not a project-wide five-per-minute burst limit. Other Supabase/IP and SMTP-provider limits still apply. Local Auth was reloaded and its active non-secret settings verified. The OTP layout and staff authenticator requirement are unchanged. Hosted Supabase settings have not been changed.

Latest routing update: the OTP verification component and its layout are unchanged. After successful email verification, a server-ready coordinator goes directly to `/coordinator/dashboard`; MFA-required accounts still complete their authenticator challenge on `/account-access` first, then redirect automatically. Completed coordinator recovery/setup also redirects to the dashboard after password recovery and MFA requirements are satisfied. No server authentication requirement was removed.

The coordinator sidebar now opens all protected module routes. Dashboard figures come from scoped enrollments, roster totals and notifications; unavailable trend/compliance history is labeled unavailable. Student/Adviser Management retain their integrated screens. Requirements/MOA, private templates and portfolio routes reuse existing protected backend workflows in coordinator-only portal mode. Company placement, reports/export, announcements and enrollment conversations use saved records. Some of these reuse development-style forms (including structured placement/portfolio commands); integration into each original module's full UI remains separate work. Configuration currently displays approved settings rather than inventing missing policies. The agent browser confirmed unsigned dashboard access redirects to login; authenticated browser acceptance remains unverified.

This section supersedes older pending-Docker and prototype-management notes below. Migrations 033–035 are applied, public TypeScript definitions are regenerated, and the local frontend and Edge Functions are running. The original login layout is preserved. Normal `/coordinator/students` and `/coordinator/advisers` now use protected Supabase identity and saved records even when remaining prototype screens use demo mode.

Student Management supports validated masterlist CSV import, individual whitelisting, resumable provisioning, reasoned access changes, filtering and pagination. Adviser Management saves real whitelist accounts, phone/sections, and access changes. Allocation requires an existing real enrollment; whitelisting does not invent one. CSV headers: `studentNumber,email,name,programCode,section`. Never put the shared default password in CSV or browser configuration.

The owner approved local student domain `iskolarngbayan.pup.edu.ph` and adviser domain `pup.edu.ph`, applied to all configured programs. Coordinator program scope remains unchanged. The owner separately authorized recovery of the existing synthetic coordinator to a controlled Gmail inbox and reset of its old test authenticator. Old sessions were invalidated. The owner confirmed setup complete; a read-only check found one active coordinator and one verified authenticator. Gmail was not added to the adviser allowlist.

Open `http://localhost:5173/coordinator/students` or `http://localhost:5173/coordinator/advisers` in the browser where setup was completed. Browser sessions are separate, and `localhost` and `127.0.0.1` are different origins. Complete staff MFA if prompted. The agent browser remained signed out, so authenticated portal acceptance and a newly whitelisted user's complete inbox/activation test remain unverified.

For a future restart, keep Docker Desktop running. First run the SMTP-aware reload and forward migration:

```powershell
node --env-file=.env scripts/restart-local-auth.mjs --smtp
npx supabase migration up --local
```

Then run each server in a separate terminal:

```powershell
npx supabase functions serve --env-file .env
```

```powershell
npm run dev:client
```

Services are already running at this checkpoint. Do not reset the database or rerun completed coordinator recovery to sign in.

The current local notice is `dev-test-only`. Its clearly labeled development text is available only in DEV against the local Supabase URL. It is not university privacy approval and cannot activate cloud/production accounts. Institutional policy publication, enrollment integration, other dashboards and pilot acceptance remain separate work. Auth SMTP is independent of the paused notification outbox.

Validation: 174 automated tests passed and the frontend build passed with the existing large-bundle warning. SQL tests include scope/MFA, pagination, stale revisions, retry behavior and recovery session invalidation. Workflow tests cover whole-batch validation and partial provisioning. These do not substitute for authenticated browser acceptance.

Current email status (October 14, 2026): this local Supabase project is configured to deliver Auth OTPs through Brevo. STARTTLS authentication passed, and the owner confirmed the test code arrived in the PUP Outlook Inbox. The approved development sender is already verified in Brevo. The `InTrack Supabase Auth` key is active with owner-approved `Never` expiry; its password is in ignored `.env`, never in browser settings. The hosted cloud project has not been changed.

For a future local stack reload, use `node --env-file=.env scripts/restart-local-auth.mjs --smtp`. A plain start without loading the SMTP environment can fail to resolve the password reference. Restart Vite if it has not picked up `VITE_AUTH_EMAIL_DELIVERY=smtp`, then open `/?authSetup=1` for real Supabase OTP sign-in. The ordinary demo login remains a separate prototype flow.

The first delivery test used a temporary unprovisioned Auth account that was removed; its code is delivery proof only. Do not use that old code for login. Normal sign-in requires a coordinator-provisioned account. To check relay authentication without sending email, use `node --env-file=.env scripts/verify-brevo-smtp.mjs`. To deliberately send a new delivery-only test to an address you control, use `node --env-file=.env scripts/send-auth-delivery-test.mjs --email YOUR_AUTHORIZED_TEST_ADDRESS`. The script sends one OTP, never prints its code, and removes only an Auth fixture it created itself.

These workspaces test persistent Supabase operations separately from the demonstration screens. Use synthetic accounts and documents. They are development-only and require a local API URL. They do not make the application pilot-ready.

## Private templates and enrollment reports

Migrations through `202610140031` are locally applied. Start the existing frontend and `npx supabase functions serve` before opening `http://localhost:5173/?templatesTest=1`. Sign in through `/?authSetup=1`, acknowledge the current notice and verify staff MFA. Only an active coordinator in the selected program can reserve or publish templates.

Enter a stable code such as `ORIENTATION_CERTIFICATE`, a descriptive title, the applicable stage, the actual approval reference and a PDF up to 10 MiB. Use synthetic files/references during local testing. The screen reserves a private path, uploads without overwrite, verifies the stored bytes and publishes a sequential version. Reuse the saved retry after a lost response. If bytes never uploaded, select the original PDF again; the server will reject any size/type mismatch. Publication approval cannot be inferred from the portfolio contents. Word files are deliberately unsupported until validated processing exists.

Select a published template and prepare a download. The grant is scoped to current membership and expires after 60 seconds. Coordinators can open “Archive this version,” enter a reason and save; students/advisers cannot obtain new grants for archived templates. Historical database records and file bytes remain intact. The equivalent RPC is `intrack_template_command` with `action='archive'` and a payload containing `programCode`, `templateId`, `reason`.

`/?backendTest=1` includes enrollment reports: search students/programs, use Previous/Next for 100-row pages, and export a page as adviser/coordinator. Exports contain a bounded authorized snapshot, omit identity/email identifiers, and are audited. The CSV uses integer minutes; the screen displays converted hours. Student report reads are restricted to owned enrollments; students cannot export. Other artifact report types remain pending.

For aggregate operator health, run `node --env-file=.env scripts/backend-health.mjs`. The output contains counts and configuration presence only. Do not copy operator credentials into the browser. The tool reports the paused email state and does not start delivery.

The independent-connection test tool accepts only a previously verified restore-clone name: `node scripts/verify-local-command-races.mjs --database intrack_restore_20261014_3a598b44`. It adds synthetic template/Auth fixtures to that clone only and preserves them for inspection. It verifies command retry/version-allocation races, not real JWTs or file-object storage. Database and asset backup scripts remain separate; no combined service recovery has been claimed.

## Start the local environment

### Email codes delivered to Outlook / PUP webmail

Outlook is the recipient's inbox. Supabase Auth generates and verifies the code. A separate email-sending service delivers the message; students do not need an account with that service. Local Mailpit only previews messages. The app now has **Sign in with an email code** at `/?authSetup=1`; live mode also exposes it at `/login`, but the normal OJT screens remain blocked until their adapters pass acceptance.

The app calls Supabase `signInWithOtp` with `shouldCreateUser:false`, then `verifyOtp` with `type:'email'`. A code never enrolls a student, activates a profile, or grants a role by itself. Staff MFA remains required. Codes are six digits, expire after 600 seconds, and requests have a 60-second server minimum interval. The same expiry applies to invitation and recovery email links. [Supabase email OTP documentation](https://supabase.com/docs/guides/auth/auth-email-passwordless).

For actual delivery, configure a sending service. Brevo's official Supabase integration is one supported route. Create a Brevo account, verify the university-authorized sending domain using the DNS records Brevo supplies, and create a sender on it. This requires access from whoever manages that domain; a student's Outlook address cannot authorize sending from the university domain. Generate an **SMTP key** in Brevo's **Settings → SMTP & API → SMTP** tab and copy the SMTP login shown there. [Brevo SMTP instructions](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [Supabase integration](https://developers.brevo.com/docs/supabase-smtp-integration).

In the hosted Supabase project, open **Authentication → Emails → SMTP Settings**, enable custom SMTP, and enter:

| Field | Input |
| --- | --- |
| Sender email | Exact verified sending address from Brevo |
| Sender name | `InTrack` |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | Exact SMTP login displayed by Brevo |
| Password | Brevo SMTP key; enter privately in Supabase |
| Minimum interval | `60` seconds |

Save. Under **Authentication → Emails → Templates → Magic Link**, use subject `Your InTrack sign-in code` and copy the HTML from `supabase/templates/magic_link.html`. Keep `{{ .Token }}` intact. In the Email provider settings, set OTP length to 6 and expiry to 600 seconds. Keep new-user signup disabled. Set the Site URL to the actual app origin and add its exact `/?authSetup=1` recovery/invitation redirect. Configure a suitable Auth email rate limit within the provider's allowance. Supabase's built-in hosted mail service is limited to project-team addresses; it is not unrestricted student delivery. [Supabase SMTP documentation](https://supabase.com/docs/guides/auth/auth-smtp).

Hosted dashboard changes do **not** change your local Docker project. To deliver from the current local project, replace the commented SMTP example in `supabase/config.toml` with:

```toml
[auth.email.smtp]
enabled = true
host = "smtp-relay.brevo.com"
port = 587
user = "YOUR_ACTUAL_SMTP_LOGIN"
pass = "env(INTRACK_AUTH_SMTP_PASSWORD)"
admin_email = "YOUR_VERIFIED_SENDER"
sender_name = "InTrack"
```

Replace the login and sender placeholders with your actual verified values. In `.env`, put the SMTP key after `INTRACK_AUTH_SMTP_PASSWORD=`. If `.env` does not exist, copy `.env.example` first. In PowerShell, from this project, run:

```powershell
node --env-file=.env scripts/restart-local-auth.mjs --smtp
```

This loads the secret only into the server/CLI environment, reloads Auth while preserving database volumes, synchronizes local app/operator keys and hides credential output. Restart Vite afterward. Keep Mailpit preview until actual SMTP credentials exist; with custom SMTP disabled, `node scripts/restart-local-auth.mjs --preview` loads the OTP template into the local preview stack. Never commit the SMTP key or put it in browser settings.

App settings: retain the URL and public key for the **same** Supabase project containing your existing schema and provisioned accounts. Set `VITE_AUTH_EMAIL_DELIVERY=smtp` in the ignored `.env` only after delivery is configured, then restart Vite. This setting changes help text; it does not send email or configure SMTP. Do not point the app at a new empty hosted project expecting it to contain local accounts.

Test with a coordinator-provisioned account you control: request a code, check Outlook Inbox/Junk, enter it, and verify account access. Check provider delivery logs if it fails. Also test an incorrect code, expiration, a consumed code and staff MFA. The later SMTP setup completed a real local delivery test, with owner-confirmed Outlook Inbox arrival. Cloud setup and full provisioned-user/browser acceptance remain separate. Notification/outbox email delivery is separate from Supabase Auth and remains unimplemented.

1. Open Docker Desktop and wait until its engine is running.
2. In the project terminal, run `npx supabase start`. Preserve its existing volumes. Never use database reset to troubleshoot existing records.
3. Run `npx supabase migration up --local` to apply outstanding forward migrations. Migrations through `202610140016` have already been applied locally.
4. Run `node scripts/sync-local-supabase-env.mjs`. It captures local connection values without printing keys and updates ignored local environment files. Browser configuration uses the publishable key; the operator environment uses the service-role API key, never the JWT signing secret.
5. Run `npx supabase functions serve` in a separate terminal. Serve all functions, including `activate-account`, `requirement-files`, and `account-invitations`.
6. Run `npm run dev:client`. This starts the frontend without the legacy Python/MySQL demonstration server.

The recovery email template was added to `supabase/config.toml`. If the local stack was already running when that configuration changed, stop/start the local stack to load the template, preserving volumes. Restart the frontend after environment changes. Local Mailpit previews are development email only; no external SMTP provider is configured.

## Account setup and identity

Open `http://localhost:5173/?authSetup=1`. Use the existing coordinator bootstrap instructions for the first account. Open its invitation in local Mailpit, complete password setup and acknowledge the configured current notice. Staff then enroll and verify MFA. A development notice is not an approved institutional notice.

Password recovery uses a six-digit emailed code. `/forgot-password` checks activation before requesting the code; inactive accounts must first sign in with their default credentials and complete activation. `/reset-password` verifies the email/code with Supabase using `type: 'recovery'` and requires any enrolled authenticator. `/reset-password/new` reuses the default-password Change Password page. Direct entry or refresh requires code verification again. Abandoned recovery sessions are signed out. Resending checks activation again and has a 60-second interface cooldown; Supabase enforces expiry, single use, and service limits. The recovery email template uses `{{ .Token }}` and contains no credential link. Hosted deployments must install this template separately. Changing a password does not activate an unfinished account, restore a suspended membership or grant roles. Verified-MFA loss requires the formal recovery process.

After a successful forgotten-password change, `password-change-session` immediately completes the verified recovery session on the server. The app adopts this authenticated session and redirects straight to the student's `/dashboard`, adviser's `/adviser/dashboard`, or coordinator's `/coordinator/dashboard`, using server-confirmed roles. Users do not enter their password, an email code, or an authenticator code again after saving. Existing recovery and MFA verification is reused; Auth's actual MFA assurance and account restrictions remain enforced. A temporary session-transfer/routing problem shows a saved-password continuation screen that retries automatic sign-in without resaving the password or returning to Login. Migrations `202610210054`/`202610220055` and the updated `password-change-session` function are required together for hosted deployments. The separate default-password-change flow still supports one immediate sign-in within five minutes on its retained verified session. `scripts/verify-local-password-change-signin.mjs`, with local browser/operator environments loaded, verifies real recovery, MFA, password saving and automatic protected dashboard access against a disposable local student without sending email.

For a browser routing regression without email or password writes, run `node scripts/serve-recovery-routing-fixture.mjs` and open `http://127.0.0.1:5181/forgot-password`. This separate test server accepts only `routing@example.test` and the synthetic code `123456`. Verify email submission reaches code entry, a wrong code stays there, the accepted code opens `/reset-password/new`, and refreshing that page returns to code entry. This fixture mocks the provider transport; real Auth recovery-code acceptance is covered separately by `scripts/verify-local-recovery-code.mjs` with the local browser/operator environments loaded.

If local Edge endpoints return `503` with `name resolution failed`, run `powershell -NoProfile -File scripts/start-local-functions.ps1`. It starts the local function runner as a hidden background process, using `.env`, with logs in `output/local-functions.stdout.log` and `output/local-functions.stderr.log`. Password recovery falls back to authenticated Supabase password saving if the carryover function is unavailable. This fallback still enforces the verified recovery session and enrolled MFA; next-sign-in carryover requires the function service. A failed session transfer never changes an already-successful password save into a failure. Reused passwords and expired sessions have separate messages.

## Administration and communications

Open `http://localhost:5173/?backendTest=1` after setup. A coordinator needs a current scoped membership and verified MFA. The directory shows available programs, policies, terms, memberships and eligible students.

Masterlist CSV headers must be exactly `studentNumber,email,name,programCode,section`. Use complete names and one student per row. Preview first; inspect duplicates/conflicts, then commit that preview. A preview belongs to its actor and expires after 15 minutes. No student import is allowed until trusted administration configures the exact approved email domains using `intrack_configure_email_domains`. Do not assume a university domain from screenshots. Synthetic test domains must be explicitly labeled as test configuration.

Invite a Student using their committed masterlist entry, or an Adviser using an approved staff email and program. The workflow cannot create coordinators or promote the current user. Preserve the original command when delivery/linking is interrupted. Resume the stored reservation; never repeatedly resend when Auth may already contain the new account. Reconciliation requires the exact newly created Auth UUID. Intentional resend and provider-token invalidation remain pending.

Publish a policy only when the approved inputs exist. The policy JSON requires:

- `sourcePolicyId`: an existing component policy UUID from the directory; hours/year/semester are copied from that component.
- `approvalReference`: the real policy approval reference.
- `attendancePolicy`: `confirmed: true`, integer `dailyCapMinutes` and `maxSessionMinutes` (1–1440), positive `maxAccuracyMeters`, and integer `maxCoordinateAgeSeconds` (1–300). These bounds validate input; they do not recommend institutional values.
- `requirements`: each item has `code`, `title`, `stage` (`pre`, `during`, `post`, `portfolio`), `evidenceType`, `reviewer` (`adviser`, `coordinator`, `both`), `mandatory`, and nonempty `allowedStages`. `recurrence` is either `{ "kind": "once", "dueAt": null }` for an explicitly undated one-time item or `{ "kind": "occurrences", "items": [{ "key": "approved-occurrence-key", "dueAt": "approved ISO timestamp" }] }`. Use actual approved deadlines. Evaluation rubrics must be published on the unpublished source policy first, then explicitly referenced and copied by policy publication. See `local-training-workspace.md` for the supported calculation and evidence contracts.

The owner supplied the coordinator portfolio contents; program applicability, reviewer/deadline rules and attendance settings remain unconfirmed. See `coordinator-portfolio-template.md`. Leave publication untouched for real enrollments. Synthetic SQL tests already exercise these contracts; their fixtures must not be promoted to university policy.

With an approved policy and matching academic term, enroll an active student, then assign a currently authorized adviser. The shared enrollment projection provides authoritative stage, required/credited/remaining minutes, clearance and MOA state. The normal dashboard still uses demonstration data.

Placement JSON needs `enrollmentId`, current `expectedEnrollmentRevision`, company name/address, approved start/end dates, latitude/longitude, radius in meters, `approvalReference`, and an explicit `schedule` with weekdays, `start`/`end` in HH:MM and `breaks`. Overnight schedules require explicit approval. Placement configuration is separate from clearance. Clearances and lifecycle commands require current revisions, reasons and evidence gates; completion/reopening now use the separate protected finalization command after portfolio verification and specialized occurrence bindings.

Notifications have persisted unread state. Messages require current enrollment relationships and are participant-only. Announcements retain explicit program/term/role scope. Message read tracking and scoped enrollment reports are implemented; email delivery remains intentionally paused.

## Evidence and MOA

Open `http://localhost:5173/?requirementsTest=1`. Use the existing local requirement fixture only for synthetic testing. File evidence uses a reservation, immutable private upload, server byte/hash verification, submission and reviewer decisions. Physical evidence uses a student request followed by a staff observation tied to that version; a student assertion is not verification.

Only coordinators change MOA states. `SIGNED AND NOTARIZED` needs validated evidence and a factual note. `SAS COPY SUBMITTED` requires the same notarized copy. A revised upload preserves history and cannot inherit SAS verification or approval. MOA routing does not itself issue clearance or change training hours.

## Recovery tooling and acceptance

`node --env-file=.env scripts/asset-recovery.mjs --mode backup --folder local-verification` backs up verified recorded document/template bytes under the ignored `backups` directory and checks hashes. It is separate from the database backup. An empty inventory does not establish successful file recovery.

Restoration requires a separate local Supabase project/API port, a restored matching database inventory, its own ignored restore credentials and `--confirm-isolated-target`. The tool refuses the original API port and different existing bytes. No restore has been executed yet; database-plus-files recovery remains an acceptance gate.

Run `npm test` and `npm run build` after changes. Automated PostgreSQL tests use synthetic Auth fixtures; actual JWT/Storage/Mailpit/browser and independent-connection concurrency checks remain required. Track these in `integration-checklist.md` rather than treating code deployment as completed acceptance.

## Attendance and academic testing

Use /?trainingTest=1 for the real local attendance/DTR/task workbench and advanced journal/evaluation/portfolio/finalization commands. The complete contracts and required explicit configuration are in local-training-workspace.md. These development tools do not replace the production page adapters.

### Current normal first-login flow (October 16, 2026)

Coordinator whitelist → registered webmail + shared default password → Outlook/PUP email OTP → Password Decision → activation by keeping or changing the password. This applies to newly provisioned whitelist accounts after migration 033. The earlier invitation-first/passwordless instructions above describe older development paths. Coordinator bootstrap remains operator managed.

The shared default is in ignored `.env`; no actual password appears in this document. Serve functions with `npx supabase functions serve --env-file .env`. Never copy this setting to a `VITE_` variable. No per-user password field is used in the coordinator workspace. A retained default prompts again on later sign-in; changed passwords clear the reminder. Existing active accounts are preserved.

The source changes passed isolated tests/builds, but applying migration 033 is pending because Docker Desktop could not start during implementation. Once Docker is running, reload local Supabase using the SMTP-aware command, run `npx supabase migration up --local`, and start the functions with the environment file above. The protected account page links a ready coordinator to the real whitelist workspace; the original dashboard management screens still need their backend adapters. Current-notice/domain approvals remain required before real university provisioning.


### Authenticator before password decision (local update, October 16)

Migration 202610160038 is applied locally. Whitelisted students and advisers now complete: webmail and password → emailed OTP → authenticator app setup/challenge → password decision → activation. First-time users enroll a TOTP authenticator; existing verified factors are challenged. Email OTP remains required alongside verified AAL2 assurance. Password Decision and Change Password redirect MFA-incomplete sessions to Account Access. The activation Edge handler checks verified Auth claims before changing any password or activating a whitelist account. Coordinator MFA and its dashboard route remain enforced. The OTP verification page layout is unchanged.


The shared `/verify-authenticator` page now handles authenticator enrollment and challenges for Student, Adviser and Coordinator sign-in. Account Access redirects MFA-required sessions there; protected identity still controls the destination after verification. The page uses the original PUP auth styling and six-slot code entry. Greeting text uses given names while records retain full names.


### Password replacement and later sign-in (October 17)

Owner-approved migration 202610170039 is applied locally. Whitelisted students and advisers who retain the default continue to verify email OTP and their authenticator before the password decision. After server-confirmed replacement (`requires_password_change=false` and a recorded `password_changed_at`), later sign-in uses their chosen password plus email OTP and skips the authenticator challenge and password reminder. Existing authenticator factors are preserved; this change does not delete recovery/enrollment records. Active coordinator membership still requires MFA. Notice, suspension, membership, and OTP checks remain enforced. First-login password replacement itself still requires both email OTP and AAL2 verification at the activation endpoint.


### Current MFA login policy (October 17; supersedes the OTP-only exception)

Migrations 202610170040 and 202610170041 are applied locally. Every role requires password authentication, an additional email verification step, and an authenticator app challenge for each new login. Replacing the default password removes only the password reminder. The main Auth session retains its verified password AMR; email OTP is checked in an isolated transient session. The `confirm-login-email` handler verifies both JWTs with Auth, requires matching users and recent distinct sessions, and records a private receipt bound to the password session. Raw tokens and OTPs are not stored in the database. The receipt expires after 12 hours and is deleted with its password session. Protected identity requires password AMR, a valid matching email receipt, and AAL2 assurance; email OTP plus TOTP without password proof is denied. First-login activation also checks password AMR and MFA. The authenticator page and first-name greetings remain shared across roles. Existing users must sign in again under this flow.

Validation: isolated database and unit tests cover password replacement, all roles, forged claims, mismatched/stale sessions, private receipt permissions and expiry. A disposable local Auth account verified the complete password → email proof → TOTP → ready sequence, including rejection of an OTP-only caller. The disposable account and factor were removed; real users and their factors were not changed. This implements the MFA flow; it is not a formal certification of all NIST AAL2 requirements (including phishing-resistant options and operational controls).


### Protected student portal (October 17)

Ready students now enter `/dashboard` after required activation/password setup and MFA. The original StudentDashboard, Layout and student module components are reused; typography, cards, sidebar and page structure are preserved. The dashboard route and shared messages/settings routes dispatch by verified server roles, and student module routes use StudentPortal rather than demo/local-storage authentication. Controlled Auth/OJT context bridges supply only the signed-in profile and scoped saved reads; legacy demo providers are not mounted. Migration 202610170042 adds a caller-only profile read protected by the student role and current MFA. Existing enrollment projections supply stages, credited hours, requirements, attendance, DTR, academic logs and portfolio states. Before enrollment, the dashboard shows the saved account and curriculum hours with zero progress and deployment locks; no enrollment or clearance is created. Saved feedback/notification data replaces sample approvals. Protected document downloads use the student role.

Scope: login routing and saved reads are connected. Original controls whose save handlers are not integrated are blocked with an explicit failure; they do not persist a mock submission or display a successful backend save. Student messaging currently has an empty saved-data view and blocked send, and profile edits remain blocked. Original developer simulation controls cannot mutate real records. Further module-by-module write integration is separate from this portal connection.

Validation: 199 automated tests passed, including caller-only profile authorization, MFA denial, enrollment-free projection and student dashboard routing. An isolated UI preview verified the original dashboard and Pre-OJT navigation. A disposable local Auth student verified its own portal profile after password, email proof and authenticator verification; the fixture account and factor were removed.


Checklist restoration: the original display catalogs now come from one shared definition. The protected student projection always shows the original 15 Pre-OJT, 26 During-OJT and 5 Post-OJT items, even before enrollment. Saved requirement records merge onto these rows, preserving status, files and remarks; additional configured rows remain visible. Missing submissions display Not Submitted. This catalog does not publish an institutional policy, create an enrollment or grant deployment clearance. The original Pre-OJT page markup and controls are unchanged. Verified all 15 Pre-OJT rows in an isolated portal preview; 201 tests passed.
