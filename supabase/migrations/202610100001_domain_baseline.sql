-- InTrack PostgreSQL/Supabase REFERENCE BLUEPRINT, not an applied migration.
-- Run only in a clean isolated Supabase project during integration.
-- RLS denies client access until the read policies described in the specification
-- are implemented and tested. No application-wide JSON state, passwords or OTPs.
begin;
create schema if not exists intrack;

create table intrack.programs (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);
create table intrack.profiles (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null,
  student_number text unique,
  status text not null default 'invited' check (status in ('invited','active','suspended','archived')),
  activated_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'active' or (auth_user_id is not null and activated_at is not null))
);
create table intrack.memberships (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references intrack.profiles(id),
  program_id uuid not null references intrack.programs(id),
  role text not null check (role in ('student','adviser','coordinator')),
  active boolean not null default true,
  revision integer not null default 0 check (revision >= 0),
  granted_by uuid references intrack.profiles(id),
  granted_at timestamptz not null default now(),
  revoked_by uuid references intrack.profiles(id),
  revoked_at timestamptz,
  change_reason text,
  check (active or (revoked_at is not null and nullif(trim(change_reason),'') is not null)),
  unique(profile_id, program_id, role),
  unique(id, profile_id)
);
-- Trusted operator actions also write audit events; no fourth application role.
create table intrack.import_previews (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references intrack.profiles(id),
  content_hash text not null,
  normalized_rows jsonb not null check (jsonb_typeof(normalized_rows) = 'array'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at > created_at),
  consumed_at timestamptz
);
-- Validation tokens refer to private previews; scope/uniqueness is rechecked on
-- commit. Remove expired/consumed preview payloads under the short cleanup policy.
create table intrack.import_batches (
  id uuid primary key default gen_random_uuid(),
  imported_by uuid not null references intrack.profiles(id),
  content_hash text not null,
  row_count integer not null check (row_count > 0),
  imported_count integer not null check (imported_count >= 0),
  unchanged_count integer not null check (unchanged_count >= 0),
  created_at timestamptz not null default now(),
  check (row_count = imported_count + unchanged_count)
);
create table intrack.eligible_students (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references intrack.programs(id),
  student_number text not null unique,
  email text not null unique check (email = lower(trim(email))),
  display_name text not null check (nullif(trim(display_name),'') is not null),
  section text not null check (nullif(trim(section),'') is not null),
  import_batch_id uuid not null references intrack.import_batches(id),
  imported_by uuid not null references intrack.profiles(id),
  imported_at timestamptz not null default now(),
  invited_profile_id uuid references intrack.profiles(id)
);
create table intrack.account_invitations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references intrack.profiles(id),
  membership_id uuid not null,
  eligible_student_id uuid references intrack.eligible_students(id),
  email text not null check (email = lower(trim(email))),
  state text not null default 'reserved' check (state in ('reserved','sent','delivery_failed','accepted','revoked')),
  requested_by uuid not null references intrack.profiles(id),
  revision integer not null default 0 check (revision >= 0),
  delivery_attempts integer not null default 0 check (delivery_attempts >= 0),
  correlation_id uuid not null default gen_random_uuid(),
  expires_at timestamptz,
  sent_at timestamptz,
  accepted_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  foreign key (membership_id, profile_id) references intrack.memberships(id, profile_id),
  check (state <> 'sent' or (sent_at is not null and expires_at is not null and expires_at > sent_at)),
  check ((state = 'accepted') = (accepted_at is not null))
);
create unique index one_pending_invitation on intrack.account_invitations(profile_id)
  where state in ('reserved','sent','delivery_failed');
-- Functions must validate membership/profile correspondence, email allowlists,
-- eligibility, verified Auth linkage, delivery reconciliation and activation.
-- Provider secrets/tokens/passwords are never stored in these tables.
create table intrack.academic_terms (
  id uuid primary key default gen_random_uuid(),
  academic_year text not null,
  semester text not null,
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  unique(academic_year, semester)
);
create table intrack.policy_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references intrack.programs(id),
  component integer not null check (component > 0),
  version integer not null check (version > 0),
  year_level integer check (year_level > 0),
  semester text,
  required_minutes integer not null check (required_minutes > 0),
  timezone text not null default 'Asia/Manila' check (timezone = 'Asia/Manila'),
  attendance_policy jsonb not null default '{}'::jsonb,
  confirmed_by uuid references intrack.profiles(id),
  confirmed_at timestamptz,
  unique(program_id, component, version),
  unique(id, program_id, component),
  check ((confirmed_by is null and confirmed_at is null) or
         (confirmed_by is not null and confirmed_at is not null and year_level is not null and semester is not null))
);
create table intrack.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null,
  contact_name text,
  contact_email text,
  archived_at timestamptz
);
create table intrack.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references intrack.profiles(id),
  program_id uuid not null references intrack.programs(id),
  term_id uuid not null references intrack.academic_terms(id),
  policy_version_id uuid not null references intrack.policy_versions(id),
  component integer not null check (component > 0),
  attempt integer not null default 1 check (attempt > 0),
  lifecycle text not null default 'pre_ojt' check (lifecycle in ('pre_ojt','during_ojt','post_ojt','portfolio','completed')),
  outcome text not null default 'active' check (outcome in ('active','completed','withdrawn')),
  revision integer not null default 0 check (revision >= 0),
  required_minutes integer not null check (required_minutes > 0),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(student_id, term_id, program_id, component, attempt),
  foreign key(policy_version_id, program_id, component) references intrack.policy_versions(id, program_id, component),
  check ((outcome = 'completed') = (completed_at is not null)),
  check ((lifecycle = 'completed') = (outcome = 'completed'))
);
create table intrack.adviser_assignments (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  adviser_id uuid not null references intrack.profiles(id),
  assigned_by uuid not null references intrack.profiles(id),
  starts_at timestamptz not null default now(),
  ends_at timestamptz check (ends_at > starts_at)
);
create unique index one_current_adviser on intrack.adviser_assignments(enrollment_id) where ends_at is null;
create table intrack.placements (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  company_id uuid not null references intrack.companies(id),
  starts_on date not null,
  ends_on date check (ends_on >= starts_on),
  active boolean not null default false,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  radius_meters integer check (radius_meters > 0),
  schedule_snapshot jsonb not null,
  revision integer not null default 0 check (revision >= 0),
  unique(id, enrollment_id),
  check (not active or (latitude is not null and longitude is not null and radius_meters is not null))
);
create unique index one_active_placement on intrack.placements(enrollment_id) where active;
create table intrack.template_versions (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references intrack.programs(id),
  template_key uuid not null,
  code text not null,
  title text not null,
  stage text not null check (stage in ('pre','during','post','portfolio','evaluation')),
  version integer not null check (version > 0),
  object_path text not null unique,
  approved_external_url text,
  status text not null check (status in ('draft','published','archived')),
  mime_type text not null check (mime_type in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  byte_count bigint not null check (byte_count > 0 and byte_count <= 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  published_by uuid references intrack.profiles(id),
  published_at timestamptz,
  check (status <> 'published' or (published_by is not null and published_at is not null)),
  unique(template_key, version),
  unique(program_id, code, version)
);
create table intrack.requirement_definitions (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references intrack.policy_versions(id),
  code text not null,
  title text not null,
  stage text not null check (stage in ('pre','during','post','portfolio')),
  evidence_type text not null check (evidence_type in ('file','staff_verification','moa','dtr','journal','evaluation','portfolio')),
  reviewer text not null check (reviewer in ('adviser','coordinator','both')),
  mandatory boolean not null default true,
  allowed_submission_stages text[] not null default '{}'
    check (allowed_submission_stages <@ array['pre_ojt','during_ojt','post_ojt','portfolio']::text[]),
  template_version_id uuid references intrack.template_versions(id),
  recurrence jsonb not null default '{}'::jsonb,
  unique(policy_version_id, code)
);
create table intrack.enrollment_requirements (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  definition_id uuid not null references intrack.requirement_definitions(id),
  instance_key text not null default 'once',
  definition_snapshot jsonb not null,
  due_at timestamptz,
  waiver_actor uuid references intrack.profiles(id),
  waiver_reason text,
  waived_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  unique(enrollment_id, definition_id, instance_key),
  unique(id, enrollment_id),
  check ((waiver_actor is null and waiver_reason is null and waived_at is null) or
         (waiver_actor is not null and waiver_reason is not null and length(trim(waiver_reason)) > 0 and waived_at is not null))
);
create table intrack.documents (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  requirement_id uuid,
  purpose text not null default 'requirement' check (purpose in ('requirement','attendance_resolution')),
  check ((purpose = 'requirement') = (requirement_id is not null)),
  uploaded_by uuid not null references intrack.profiles(id),
  bucket text not null default 'ojt-documents' check (bucket = 'ojt-documents'),
  object_path text not null unique,
  original_name text not null,
  mime_type text not null check (mime_type in ('application/pdf','image/jpeg','image/png')),
  byte_count bigint not null check (byte_count > 0 and byte_count <= 10485760),
  sha256 text check (sha256 ~ '^[a-f0-9]{64}$'),
  status text not null default 'pending' check (status in ('pending','validated','quarantined','attached')),
  created_at timestamptz not null default now(),
  validated_at timestamptz,
  unique(id, enrollment_id),
  unique(id, requirement_id, enrollment_id),
  foreign key(requirement_id, enrollment_id) references intrack.enrollment_requirements(id, enrollment_id),
  check (status not in ('validated','attached') or (sha256 is not null and validated_at is not null))
);
create table intrack.submission_versions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  requirement_id uuid not null,
  version integer not null check (version > 0),
  submitted_by uuid not null references intrack.profiles(id),
  document_id uuid,
  evidence_note text,
  artifact_ref jsonb,
  status text not null check (status in ('draft','submitted','under_review','needs_revision','approved','rejected','superseded','withdrawn')),
  submitted_at timestamptz,
  revision integer not null default 0 check (revision >= 0),
  is_current boolean not null default true,
  review_started_at timestamptz,
  unique(requirement_id, version),
  unique(id, enrollment_id),
  foreign key(requirement_id, enrollment_id) references intrack.enrollment_requirements(id, enrollment_id),
  foreign key(document_id, enrollment_id) references intrack.documents(id, enrollment_id),
  foreign key(document_id, requirement_id, enrollment_id) references intrack.documents(id, requirement_id, enrollment_id),
  check (status = 'draft' or document_id is not null or (evidence_note is not null and length(trim(evidence_note)) > 0) or artifact_ref is not null),
  check (status = 'draft' or submitted_at is not null)
);
create unique index one_current_submission on intrack.submission_versions(requirement_id) where is_current;
create table intrack.staff_verification_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  submission_id uuid not null,
  verified_by uuid not null references intrack.profiles(id),
  note text not null check (length(trim(note)) > 0),
  command_id uuid not null,
  submission_revision integer not null check (submission_revision >= 0),
  verified_at timestamptz not null default now(),
  foreign key(submission_id, enrollment_id) references intrack.submission_versions(id, enrollment_id)
);
create table intrack.review_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  submission_id uuid not null,
  reviewer_id uuid not null references intrack.profiles(id),
  reviewer_role text not null check (reviewer_role in ('adviser','coordinator')),
  decision text not null check (decision in ('under_review','approved','needs_revision','rejected','revoked')),
  remarks text not null default '',
  command_id uuid not null,
  submission_revision integer not null check (submission_revision >= 0),
  created_at timestamptz not null default now(),
  foreign key(submission_id, enrollment_id) references intrack.submission_versions(id, enrollment_id),
  check (decision in ('under_review','approved') or length(trim(remarks)) > 0)
);
create table intrack.clearance_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  placement_id uuid not null,
  moa_submission_id uuid,
  status text not null check (status in ('active','suspended','revoked')),
  actor_id uuid not null references intrack.profiles(id),
  reason text not null check (length(trim(reason)) > 0),
  command_id uuid not null,
  enrollment_revision integer not null check (enrollment_revision > 0),
  basis_snapshot jsonb not null check (jsonb_typeof(basis_snapshot) = 'object'),
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  foreign key(placement_id, enrollment_id) references intrack.placements(id, enrollment_id),
  foreign key(moa_submission_id, enrollment_id) references intrack.submission_versions(id, enrollment_id),
  check (status <> 'active' or moa_submission_id is not null)
);
create table intrack.moa_routing_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  submission_id uuid,
  actor_id uuid not null references intrack.profiles(id),
  status text not null check (status in ('SAS COPY SUBMITTED','SIGNED AND NOTARIZED','FOR NOTARIZATION','IN-PROCESS FOR REVISION','IN-PROCESS FOR REVIEW OF ULCO','FOR COMPANY REVIEW','NO MOA')),
  remarks text not null,
  evidence_note text,
  command_id uuid not null,
  enrollment_revision integer not null check (enrollment_revision > 0),
  created_at timestamptz not null default now(),
  foreign key(submission_id, enrollment_id) references intrack.submission_versions(id, enrollment_id),
  check (length(trim(remarks)) > 0),
  check (status = 'NO MOA' or submission_id is not null),
  check (status not in ('SIGNED AND NOTARIZED','SAS COPY SUBMITTED') or
    (evidence_note is not null and length(trim(evidence_note)) > 0))
);
create table intrack.enrollment_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  actor_id uuid not null references intrack.profiles(id),
  action text not null check (action in ('issue_clearance','resume_clearance','suspend_clearance','revoke_clearance','enter_post_ojt','enter_portfolio','complete','withdraw','reopen_completion','return_to_training')),
  reason text not null check (length(trim(reason)) > 0),
  command_id uuid not null,
  before_revision integer not null check (before_revision >= 0),
  after_revision integer not null check (after_revision = before_revision + 1),
  from_stage text not null check (from_stage in ('pre_ojt','during_ojt','post_ojt','portfolio','completed')),
  to_stage text not null check (to_stage in ('pre_ojt','during_ojt','post_ojt','portfolio','completed')),
  from_outcome text not null check (from_outcome in ('active','completed','withdrawn')),
  to_outcome text not null check (to_outcome in ('active','completed','withdrawn')),
  from_clearance text not null check (from_clearance in ('not_issued','active','suspended','revoked')),
  to_clearance text not null check (to_clearance in ('not_issued','active','suspended','revoked')),
  basis_snapshot jsonb not null check (jsonb_typeof(basis_snapshot) = 'object'),
  unique(enrollment_id, after_revision),
  created_at timestamptz not null default now()
);
create table intrack.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  placement_id uuid not null,
  clock_in_at timestamptz not null,
  clock_out_at timestamptz check (clock_out_at > clock_in_at and clock_out_at <= clock_in_at + interval '24 hours'),
  attendance_date date not null,
  gps_in jsonb,
  gps_out jsonb,
  policy_snapshot jsonb not null,
  authority_snapshot jsonb not null,
  original_clock_in_at timestamptz not null,
  original_clock_out_at timestamptz,
  source text not null default 'clock' check (source in ('clock','reconstruction')),
  check (source = 'reconstruction' or gps_in is not null or authority_snapshot ? 'location_exception_id'),
  status text not null check (status in ('open','pending','disputed','approved','void')),
  net_minutes integer check (net_minutes >= 0),
  revision integer not null default 0 check (revision >= 0),
  unique(id, enrollment_id),
  foreign key(placement_id, enrollment_id) references intrack.placements(id, enrollment_id),
  check (attendance_date = (clock_in_at at time zone 'Asia/Manila')::date),
  check ((status = 'open') = (clock_out_at is null) or status in ('disputed','void')),
  check (status <> 'approved' or (clock_out_at is not null and net_minutes is not null))
);
create unique index one_open_session on intrack.attendance_sessions(enrollment_id) where clock_out_at is null and status <> 'void';
create table intrack.attendance_session_revisions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  session_id uuid not null,
  revision integer not null check (revision >= 0),
  origin text not null check (origin in ('clock_in','clock_out','correction','reconstruction','void','review')),
  actor_id uuid not null references intrack.profiles(id),
  command_id uuid not null,
  reason text not null,
  frozen_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  unique(session_id, revision),
  foreign key(session_id, enrollment_id) references intrack.attendance_sessions(id, enrollment_id)
);
create table intrack.attendance_exceptions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  placement_id uuid not null,
  kind text not null check (kind in ('location','schedule')),
  allowed_actions text[] not null check (cardinality(allowed_actions) > 0 and allowed_actions <@ array['clock_in','clock_out','correction']::text[]),
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  status text not null check (status in ('pending','approved','rejected','revoked')),
  requested_by uuid not null references intrack.profiles(id),
  reason text not null check (length(trim(reason)) > 0),
  decided_by uuid references intrack.profiles(id),
  decided_at timestamptz,
  decision_reason text,
  revision integer not null default 0 check (revision >= 0),
  foreign key(placement_id, enrollment_id) references intrack.placements(id, enrollment_id),
  check (status = 'pending' or (decided_by is not null and decided_at is not null and nullif(trim(decision_reason),'') is not null))
);
create table intrack.attendance_attempts (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  actor_id uuid not null references intrack.profiles(id),
  action text not null check (action in ('clock_in','clock_out')),
  session_id uuid,
  command_id uuid not null,
  reason_code text not null,
  gps_evidence jsonb,
  received_at timestamptz not null default now(),
  foreign key(session_id, enrollment_id) references intrack.attendance_sessions(id, enrollment_id),
  unique(actor_id, command_id)
);
create table intrack.correction_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  session_id uuid not null,
  original_revision integer not null check (original_revision >= 0),
  revision integer not null default 0 check (revision >= 0),
  evidence_document_id uuid,
  original_snapshot jsonb not null,
  proposed_snapshot jsonb not null,
  requested_by uuid not null references intrack.profiles(id),
  reason text not null check (length(trim(reason)) > 0),
  status text not null check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  decided_by uuid references intrack.profiles(id),
  decided_at timestamptz,
  decision_reason text,
  foreign key(session_id, enrollment_id) references intrack.attendance_sessions(id, enrollment_id),
  foreign key(evidence_document_id, enrollment_id) references intrack.documents(id, enrollment_id),
  check ((status = 'pending' and decided_by is null and decided_at is null) or
         (status <> 'pending' and decided_by is not null and decided_at is not null and decision_reason is not null and length(trim(decision_reason)) > 0))
);
create unique index one_pending_correction on intrack.correction_requests(session_id) where status = 'pending';
create table intrack.reconstruction_requests (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  placement_id uuid not null,
  requested_by uuid not null references intrack.profiles(id),
  proposed_clock_in timestamptz not null,
  proposed_clock_out timestamptz not null check (proposed_clock_out > proposed_clock_in and proposed_clock_out <= proposed_clock_in + interval '24 hours'),
  evidence_document_id uuid not null,
  reason text not null check (length(trim(reason)) > 0),
  status text not null check (status in ('pending','approved','rejected')),
  revision integer not null default 0 check (revision >= 0),
  requested_at timestamptz not null default now(),
  decided_by uuid references intrack.profiles(id),
  decided_at timestamptz,
  decision_reason text,
  created_session_id uuid,
  foreign key(placement_id, enrollment_id) references intrack.placements(id, enrollment_id),
  foreign key(evidence_document_id, enrollment_id) references intrack.documents(id, enrollment_id),
  foreign key(created_session_id, enrollment_id) references intrack.attendance_sessions(id, enrollment_id),
  check ((status = 'approved') = (created_session_id is not null)),
  check (status = 'pending' or (decided_by is not null and decided_at is not null and nullif(trim(decision_reason),'') is not null))
);
create table intrack.dtr_versions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  version integer not null check (version > 0),
  period_key text not null,
  generated_at timestamptz not null default now(),
  printable_snapshot jsonb not null,
  status text not null check (status in ('draft','submitted','under_review','needs_revision','approved','superseded')),
  submitted_at timestamptz,
  reviewed_by uuid references intrack.profiles(id),
  reviewed_at timestamptz,
  remarks text not null default '',
  revision integer not null default 0 check (revision >= 0),
  unique(enrollment_id, starts_on, ends_on, version),
  unique(enrollment_id, period_key, version),
  unique(id, enrollment_id),
  check (status <> 'approved' or (submitted_at is not null and reviewed_by is not null and reviewed_at is not null))
);
create table intrack.dtr_review_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  dtr_id uuid not null,
  actor_id uuid not null references intrack.profiles(id),
  command_id uuid not null,
  decision text not null check (decision in ('under_review','approved','needs_revision','invalidated')),
  reason text not null,
  dtr_revision integer not null check (dtr_revision >= 0),
  created_at timestamptz not null default now(),
  foreign key(dtr_id, enrollment_id) references intrack.dtr_versions(id, enrollment_id),
  check (decision in ('under_review','approved') or nullif(trim(reason),'') is not null)
);
create table intrack.dtr_entries (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  dtr_id uuid not null,
  session_id uuid not null,
  session_revision integer not null check (session_revision >= 0),
  frozen_snapshot jsonb not null,
  unique(dtr_id, session_id),
  unique(dtr_id, session_id, enrollment_id, session_revision),
  foreign key(dtr_id, enrollment_id) references intrack.dtr_versions(id, enrollment_id),
  foreign key(session_id, enrollment_id) references intrack.attendance_sessions(id, enrollment_id)
);
create table intrack.hour_credits (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  dtr_id uuid not null,
  session_id uuid not null,
  session_revision integer not null check (session_revision >= 0),
  credit_date date not null,
  minutes integer not null check (minutes >= 0),
  credited_at timestamptz not null default now(),
  invalidated_at timestamptz,
  invalidated_by uuid references intrack.profiles(id),
  invalidation_reason text,
  foreign key(dtr_id, session_id, enrollment_id, session_revision) references intrack.dtr_entries(dtr_id, session_id, enrollment_id, session_revision),
  foreign key(dtr_id, enrollment_id) references intrack.dtr_versions(id, enrollment_id),
  foreign key(session_id, enrollment_id) references intrack.attendance_sessions(id, enrollment_id),
  check (invalidated_at is null or (invalidated_by is not null and nullif(trim(invalidation_reason),'') is not null))
);
create unique index one_active_credit_per_session_day on intrack.hour_credits(session_id, credit_date) where invalidated_at is null;
create table intrack.task_versions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  task_key uuid not null,
  version integer not null check (version > 0),
  task_date date not null,
  content jsonb not null,
  status text not null check (status in ('draft','submitted','under_review','needs_revision','rejected','approved','superseded','withdrawn')),
  revision integer not null default 0 check (revision >= 0),
  is_current boolean not null default true,
  submitted_at timestamptz,
  content_hash text check (content_hash ~ '^[a-f0-9]{64}$'),
  created_by uuid not null references intrack.profiles(id),
  created_at timestamptz not null default now(),
  unique(enrollment_id, task_key, version),
  check (status = 'draft' or (submitted_at is not null and content_hash is not null)),
  unique(id, enrollment_id)
);
create unique index one_current_task on intrack.task_versions(enrollment_id, task_key) where is_current;
create table intrack.journal_versions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  starts_on date not null,
  ends_on date not null check (ends_on >= starts_on),
  version integer not null check (version > 0),
  content jsonb not null,
  period_key text not null,
  created_by uuid not null references intrack.profiles(id),
  revision integer not null default 0 check (revision >= 0),
  is_current boolean not null default true,
  content_hash text check (content_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('draft','submitted','under_review','needs_revision','rejected','approved','superseded','withdrawn')),
  submitted_at timestamptz,
  reviewed_by uuid references intrack.profiles(id),
  reviewed_at timestamptz,
  unique(enrollment_id, starts_on, ends_on, version),
  unique(enrollment_id, period_key, version),
  check (status = 'draft' or (submitted_at is not null and content_hash is not null)),
  check (status <> 'approved' or (reviewed_by is not null and reviewed_at is not null)),
  unique(id, enrollment_id)
);
create unique index one_current_journal on intrack.journal_versions(enrollment_id, period_key) where is_current;
create table intrack.journal_tasks (
  enrollment_id uuid not null references intrack.enrollments(id),
  journal_id uuid not null,
  task_version_id uuid not null,
  primary key(journal_id, task_version_id),
  foreign key(journal_id, enrollment_id) references intrack.journal_versions(id, enrollment_id),
  foreign key(task_version_id, enrollment_id) references intrack.task_versions(id, enrollment_id)
);
create table intrack.evaluation_templates (
  id uuid primary key default gen_random_uuid(),
  policy_version_id uuid not null references intrack.policy_versions(id),
  kind text not null check (kind in ('midterm','final','company')),
  title text not null,
  version integer not null check (version > 0),
  published_at timestamptz,
  calculation_rule jsonb not null,
  unique(policy_version_id, kind, version)
);
create table intrack.evaluation_criteria (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references intrack.evaluation_templates(id),
  label text not null,
  ordinal integer not null check (ordinal > 0),
  max_points numeric(8,2) not null check (max_points > 0),
  unique(template_id, ordinal),
  unique(id, template_id)
);
create table intrack.evaluation_versions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  kind text not null check (kind in ('midterm','final','company')),
  version integer not null check (version > 0),
  template_id uuid not null references intrack.evaluation_templates(id),
  rubric_snapshot jsonb not null,
  scores jsonb not null,
  evaluator_name text not null,
  evaluator_affiliation text not null,
  evaluated_on date,
  created_by uuid not null references intrack.profiles(id),
  revision integer not null default 0 check (revision >= 0),
  is_current boolean not null default true,
  content_hash text check (content_hash ~ '^[a-f0-9]{64}$'),
  evaluator_profile_id uuid references intrack.profiles(id),
  document_id uuid,
  status text not null check (status in ('draft','submitted','under_review','needs_revision','rejected','approved','superseded','withdrawn')),
  submitted_at timestamptz,
  reviewed_by uuid references intrack.profiles(id),
  reviewed_at timestamptz,
  unique(enrollment_id, kind, version),
  unique(id, enrollment_id),
  unique(id, template_id),
  check (status = 'draft' or (submitted_at is not null and evaluated_on is not null and document_id is not null and content_hash is not null)),
  check (status <> 'approved' or (reviewed_by is not null and reviewed_at is not null)),
  foreign key(document_id, enrollment_id) references intrack.documents(id, enrollment_id)
);
create unique index one_current_evaluation on intrack.evaluation_versions(enrollment_id, kind) where is_current;
create table intrack.evaluation_scores (
  evaluation_id uuid not null references intrack.evaluation_versions(id),
  criterion_id uuid not null references intrack.evaluation_criteria(id),
  template_id uuid not null,
  max_points_snapshot numeric(8,2) not null check (max_points_snapshot > 0),
  points numeric(8,2) not null check (points >= 0 and points <= max_points_snapshot),
  primary key(evaluation_id, criterion_id),
  foreign key(evaluation_id, template_id) references intrack.evaluation_versions(id, template_id),
  foreign key(criterion_id, template_id) references intrack.evaluation_criteria(id, template_id)
);
create table intrack.portfolio_versions (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  version integer not null check (version > 0),
  manifest jsonb not null,
  created_by uuid not null references intrack.profiles(id),
  revision integer not null default 0 check (revision >= 0),
  is_current boolean not null default true,
  manifest_hash text check (manifest_hash ~ '^[a-f0-9]{64}$'),
  status text not null check (status in ('draft','submitted','under_review','needs_revision','rejected','approved','superseded','withdrawn')),
  submitted_at timestamptz,
  adviser_reviewed_by uuid references intrack.profiles(id),
  adviser_approved_at timestamptz,
  coordinator_reviewed_by uuid references intrack.profiles(id),
  coordinator_approved_at timestamptz,
  unique(enrollment_id, version),
  unique(id, enrollment_id),
  check (status = 'draft' or (submitted_at is not null and manifest_hash is not null)),
  check (status <> 'approved' or (adviser_reviewed_by is not null and adviser_approved_at is not null and coordinator_reviewed_by is not null and coordinator_approved_at is not null))
);
create unique index one_current_portfolio on intrack.portfolio_versions(enrollment_id) where is_current;
create table intrack.journal_dtr_sources (
  enrollment_id uuid not null references intrack.enrollments(id),
  journal_id uuid not null,
  dtr_id uuid not null,
  dtr_revision integer not null check (dtr_revision >= 0),
  frozen_snapshot jsonb not null,
  primary key(journal_id, dtr_id),
  foreign key(journal_id, enrollment_id) references intrack.journal_versions(id, enrollment_id),
  foreign key(dtr_id, enrollment_id) references intrack.dtr_versions(id, enrollment_id)
);
create table intrack.portfolio_sources (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  portfolio_id uuid not null,
  requirement_id uuid,
  document_id uuid,
  submission_id uuid,
  dtr_id uuid,
  journal_id uuid,
  evaluation_id uuid,
  source_revision integer not null check (source_revision >= 0),
  source_hash text not null check (source_hash ~ '^[a-f0-9]{64}$'),
  check (num_nonnulls(document_id, submission_id, dtr_id, journal_id, evaluation_id) = 1),
  foreign key(portfolio_id, enrollment_id) references intrack.portfolio_versions(id, enrollment_id),
  foreign key(requirement_id, enrollment_id) references intrack.enrollment_requirements(id, enrollment_id),
  foreign key(document_id, enrollment_id) references intrack.documents(id, enrollment_id),
  foreign key(submission_id, enrollment_id) references intrack.submission_versions(id, enrollment_id),
  foreign key(dtr_id, enrollment_id) references intrack.dtr_versions(id, enrollment_id),
  foreign key(journal_id, enrollment_id) references intrack.journal_versions(id, enrollment_id),
  foreign key(evaluation_id, enrollment_id) references intrack.evaluation_versions(id, enrollment_id)
);
create table intrack.academic_review_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  task_id uuid,
  journal_id uuid,
  evaluation_id uuid,
  portfolio_id uuid,
  actor_id uuid not null references intrack.profiles(id),
  reviewer_role text not null check (reviewer_role in ('adviser','coordinator')),
  decision text not null check (decision in ('under_review','approved','needs_revision','rejected','revoked','invalidated')),
  reason text not null,
  command_id uuid not null,
  artifact_revision integer not null check (artifact_revision >= 0),
  created_at timestamptz not null default now(),
  check (num_nonnulls(task_id, journal_id, evaluation_id, portfolio_id) = 1),
  check (decision in ('under_review','approved') or nullif(trim(reason),'') is not null),
  foreign key(task_id, enrollment_id) references intrack.task_versions(id, enrollment_id),
  foreign key(journal_id, enrollment_id) references intrack.journal_versions(id, enrollment_id),
  foreign key(evaluation_id, enrollment_id) references intrack.evaluation_versions(id, enrollment_id),
  foreign key(portfolio_id, enrollment_id) references intrack.portfolio_versions(id, enrollment_id)
);
create table intrack.completion_summaries (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  portfolio_id uuid not null,
  version integer not null check (version > 0),
  enrollment_revision integer not null check (enrollment_revision > 0),
  finalized_by uuid not null references intrack.profiles(id),
  command_id uuid not null,
  summary jsonb not null,
  summary_hash text not null check (summary_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique(enrollment_id, version),
  foreign key(portfolio_id, enrollment_id) references intrack.portfolio_versions(id, enrollment_id)
);
create table intrack.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references intrack.profiles(id),
  enrollment_id uuid references intrack.enrollments(id),
  event_key text not null,
  content jsonb not null,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  unique(recipient_id, event_key)
);
create table intrack.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null references intrack.notifications(id),
  channel text not null check (channel in ('email')),
  attempts integer not null default 0 check (attempts >= 0),
  next_attempt_at timestamptz not null default now(),
  delivered_at timestamptz,
  last_error_code text,
  unique(notification_id, channel)
);
create table intrack.messages (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references intrack.enrollments(id),
  sender_id uuid not null references intrack.profiles(id),
  recipient_id uuid not null references intrack.profiles(id),
  body text not null check (length(trim(body)) > 0),
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create table intrack.announcements (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references intrack.programs(id),
  term_id uuid references intrack.academic_terms(id),
  audience_role text check (audience_role in ('student','adviser','coordinator')),
  author_id uuid not null references intrack.profiles(id),
  title text not null,
  body text not null,
  published_at timestamptz,
  archived_at timestamptz
);
create table intrack.privacy_acknowledgments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references intrack.profiles(id),
  notice_version text not null,
  acknowledged_at timestamptz not null default now(),
  unique(profile_id, notice_version)
);
create table intrack.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references intrack.profiles(id),
  enrollment_id uuid references intrack.enrollments(id),
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  command_id uuid not null,
  before_revision integer,
  after_revision integer,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table intrack.command_receipts (
  actor_id uuid not null references intrack.profiles(id),
  command_id uuid not null,
  payload_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(actor_id, command_id)
);

create index assignment_lookup on intrack.adviser_assignments(adviser_id, enrollment_id) where ends_at is null;
create index enrollment_scope on intrack.enrollments(program_id, student_id);
create index submission_queue on intrack.submission_versions(status, enrollment_id);
create index attendance_dates on intrack.attendance_sessions(enrollment_id, attendance_date);
create index unread_notifications on intrack.notifications(recipient_id, created_at) where read_at is null;
create index pending_delivery on intrack.notification_outbox(next_attempt_at) where delivered_at is null;

-- A custom non-exposed schema prevents accidentally exposing incomplete policies.
-- Explicitly deny client and PUBLIC privileges, even if project defaults change.
-- Preserve recorded evidence and decisions even when a privileged command is buggy.
create function intrack.guard_append_only() returns trigger language plpgsql
set search_path = '' as $$
begin
  raise exception 'Recorded history is append-only' using errcode = '23514';
end $$;
create function intrack.guard_submitted_content() returns trigger language plpgsql
set search_path = '' as $$
declare mutable_columns text[] := array['status','revision','is_current','review_started_at',
  'reviewed_by','reviewed_at','remarks','adviser_reviewed_by','adviser_approved_at',
  'coordinator_reviewed_by','coordinator_approved_at'];
begin
  if old.status <> 'draft' then
    if tg_op = 'DELETE' then
      raise exception 'Submitted versions cannot be deleted' using errcode = '23514';
    end if;
    if new.status = 'draft' or (to_jsonb(new) - mutable_columns) is distinct from (to_jsonb(old) - mutable_columns) then
      raise exception 'Submitted evidence requires a new version' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create function intrack.guard_published_policy() returns trigger language plpgsql
set search_path = '' as $$
begin
  if old.confirmed_at is not null then
    raise exception 'Published policy requires a new version' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger preserve_published_policy before update or delete on intrack.policy_versions
for each row execute function intrack.guard_published_policy();
create function intrack.guard_published_catalog() returns trigger language plpgsql
set search_path = '' as $$
declare parent_id uuid; frozen boolean;
begin
  if tg_table_name = 'requirement_definitions' then
    if tg_op = 'INSERT' then parent_id := new.policy_version_id; else parent_id := old.policy_version_id; end if;
    select confirmed_at is not null into frozen from intrack.policy_versions where id = parent_id;
  elsif tg_table_name = 'evaluation_criteria' then
    if tg_op = 'INSERT' then parent_id := new.template_id; else parent_id := old.template_id; end if;
    select published_at is not null into frozen from intrack.evaluation_templates where id = parent_id;
  elsif tg_table_name = 'evaluation_templates' and tg_op <> 'INSERT' then
    frozen := old.published_at is not null;
  end if;
  if frozen then raise exception 'Published catalog requires a new version' using errcode = '23514'; end if;
  if tg_op = 'DELETE' then return old; end if;
  -- Reparenting an existing draft must also not insert into a frozen parent.
  if tg_op = 'UPDATE' and tg_table_name = 'requirement_definitions' then
    if exists (select 1 from intrack.policy_versions where id=new.policy_version_id and confirmed_at is not null) then
      raise exception 'Cannot amend a published policy catalog' using errcode = '23514';
    end if;
  elsif tg_op = 'UPDATE' and tg_table_name = 'evaluation_criteria' then
    if exists (select 1 from intrack.evaluation_templates where id=new.template_id and published_at is not null) then
      raise exception 'Cannot amend a published rubric' using errcode = '23514';
    end if;
  end if;
  return new;
end $$;
create trigger preserve_requirement_catalog before insert or update or delete on intrack.requirement_definitions
for each row execute function intrack.guard_published_catalog();
create trigger preserve_rubric_criteria before insert or update or delete on intrack.evaluation_criteria
for each row execute function intrack.guard_published_catalog();
create trigger preserve_rubric_version before update or delete on intrack.evaluation_templates
for each row execute function intrack.guard_published_catalog();
create function intrack.guard_fixed_asset() returns trigger language plpgsql
set search_path = '' as $$
declare frozen boolean; allowed_columns text[];
begin
  if tg_table_name = 'documents' then frozen := old.validated_at is not null; allowed_columns := array['status'];
  else frozen := old.published_at is not null; allowed_columns := array['status']; end if;
  if frozen then
    if tg_op = 'DELETE' then raise exception 'Recorded asset cannot be deleted' using errcode = '23514'; end if;
    if (to_jsonb(new) - allowed_columns) is distinct from (to_jsonb(old) - allowed_columns) then
      raise exception 'Recorded asset bytes and metadata require a new object/version' using errcode = '23514';
    end if;
    if new.status = 'draft' or new.status = 'pending' then
      raise exception 'Recorded asset cannot return to draft/pending' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger preserve_document_identity before update or delete on intrack.documents
for each row execute function intrack.guard_fixed_asset();
create trigger preserve_template_identity before update or delete on intrack.template_versions
for each row execute function intrack.guard_fixed_asset();
create function intrack.guard_scores() returns trigger language plpgsql
set search_path = '' as $$
declare parent_id uuid;
begin
  if tg_op = 'INSERT' then parent_id := new.evaluation_id; else parent_id := old.evaluation_id; end if;
  if exists (select 1 from intrack.evaluation_versions where id=parent_id and status <> 'draft') then
    raise exception 'Submitted scores require a new evaluation version' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and exists (select 1 from intrack.evaluation_versions where id=new.evaluation_id and status <> 'draft') then
    raise exception 'Cannot attach scores to a submitted evaluation' using errcode = '23514';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
create trigger preserve_submitted_scores before insert or update or delete on intrack.evaluation_scores
for each row execute function intrack.guard_scores();
create function intrack.guard_artifact_references() returns trigger language plpgsql
set search_path = '' as $$
declare old_parent uuid; new_parent uuid; parent_table text; frozen boolean;
begin
  if tg_table_name in ('journal_tasks','journal_dtr_sources') then
    parent_table := 'journal_versions';
    if tg_op <> 'INSERT' then old_parent := old.journal_id; end if;
    if tg_op <> 'DELETE' then new_parent := new.journal_id; end if;
  elsif tg_table_name = 'portfolio_sources' then
    parent_table := 'portfolio_versions';
    if tg_op <> 'INSERT' then old_parent := old.portfolio_id; end if;
    if tg_op <> 'DELETE' then new_parent := new.portfolio_id; end if;
  else
    parent_table := 'dtr_versions';
    if tg_op <> 'INSERT' then old_parent := old.dtr_id; end if;
    if tg_op <> 'DELETE' then new_parent := new.dtr_id; end if;
  end if;
  execute format('select exists (select 1 from intrack.%I where id in ($1,$2) and status <> ''draft'')', parent_table)
    into frozen using old_parent, new_parent;
  if frozen then raise exception 'Submitted references require a new artifact version' using errcode = '23514'; end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;
do $$
declare relation_name text;
begin
  foreach relation_name in array array['journal_tasks','journal_dtr_sources','portfolio_sources','dtr_entries'] loop
    execute format('create trigger preserve_artifact_references before insert or update or delete on intrack.%I for each row execute function intrack.guard_artifact_references()', relation_name);
  end loop;
end $$;
do $$
declare relation_name text;
begin
  foreach relation_name in array array['review_events','staff_verification_events','clearance_events',
    'moa_routing_events','enrollment_events','attendance_session_revisions','dtr_review_events',
    'academic_review_events','completion_summaries','audit_events','command_receipts'] loop
    execute format('create trigger preserve_history before update or delete on intrack.%I for each row execute function intrack.guard_append_only()', relation_name);
  end loop;
  foreach relation_name in array array['submission_versions','task_versions','journal_versions',
    'evaluation_versions','portfolio_versions','dtr_versions'] loop
    execute format('create trigger preserve_submitted_content before update or delete on intrack.%I for each row execute function intrack.guard_submitted_content()', relation_name);
  end loop;
end $$;
revoke all on schema intrack from public, anon, authenticated;
create index current_membership_scope on intrack.memberships(profile_id, role, program_id) where active;
create index expiring_previews on intrack.import_previews(expires_at);
create index active_credit_totals on intrack.hour_credits(enrollment_id, credit_date) where invalidated_at is null;
create index scoped_dtr_queue on intrack.dtr_versions(enrollment_id, status, starts_on);
create index portfolio_dtr_dependency on intrack.portfolio_sources(dtr_id) where dtr_id is not null;
create index portfolio_journal_dependency on intrack.portfolio_sources(journal_id) where journal_id is not null;
create index journal_task_dependency on intrack.journal_tasks(task_version_id);
create index journal_dtr_dependency on intrack.journal_dtr_sources(dtr_id);
revoke all on all tables in schema intrack from public, anon, authenticated;
revoke all on all functions in schema intrack from public, anon, authenticated;
revoke all on all sequences in schema intrack from public, anon, authenticated;
alter default privileges in schema intrack revoke all on tables from public, anon, authenticated;
alter default privileges in schema intrack revoke all on functions from public, anon, authenticated;
alter default privileges in schema intrack revoke all on sequences from public, anon, authenticated;
do $$
declare item record;
begin
  for item in select tablename from pg_tables where schemaname = 'intrack' loop
    execute format('alter table intrack.%I enable row level security', item.tablename);
  end loop;
end $$;

-- No personal data seeds. BSOA semester labels remain unset; publication also
-- requires confirmation of requirements and attendance rules by authorized staff.
insert into intrack.programs(code, name) values ('BSHM','BSHM'), ('BSCPE','BSCPE'), ('BSOA','BSOA'), ('BSIT','BSIT');
insert into intrack.policy_versions(program_id, component, version, required_minutes, year_level, semester)
select p.id, v.component, 1, v.hours * 60, v.year_level, v.semester
from (values ('BSHM',1,300,2,'summer'),('BSHM',2,600,4,'2'),('BSCPE',1,300,2,'summer'),('BSCPE',2,300,3,'summer'),('BSOA',1,300,2,null),('BSOA',2,300,4,null),('BSIT',1,500,4,'2')) as v(code,component,hours,year_level,semester)
join intrack.programs p on p.code = v.code;
commit;
