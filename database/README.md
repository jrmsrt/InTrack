# InTrack PostgreSQL preparation

`supabase-model.sql` is the canonical reference model. `schema.sql` belongs to the legacy MySQL demo and must not be applied to Supabase. This directory has no live connection settings or production deployment command.

## SQL file responsibilities

- `../supabase/migrations/` contains the versioned Supabase schema and workflow changes. Keep applied migrations intact.
- `supabase-model.sql`, `migration-candidates/202610100001_domain_baseline.sql`, and `schema-inventory.json` support baseline preparation and database tests.
- `local-requirement-fixture.sql` supplies synthetic local workflow data and is checked by the requirement workflow tests; it is not a production seed.
- `schema.sql` supports the legacy Python/MySQL demo documented in the root README. Retain it while that backend remains supported.

Unreferenced dashboard scratch queries previously stored in `supabase/snippets/` have been removed. They are not part of database setup or migration history.

## Local checks and candidate

Run `npm run test:database` to execute the entire model in an isolated, in-memory PostgreSQL engine and check relationships, guards, grants and rollback. Run `npm test` for both database and policy suites. The development-only [PGlite engine](https://pglite.dev/docs/) executes PostgreSQL without a separate server. Its tests supply minimal `auth.users`, `anon`, and `authenticated` fixtures; they do not simulate Supabase Auth, Data API, Storage, or independent concurrent connections.

Run `npm run db:prepare` to check the model, freeze `migration-candidates/202610100001_domain_baseline.sql`, and produce `schema-inventory.json` with the executed engine version, SHA-256, tables, constraints, indexes and guards. The command never connects to an external database and refuses to overwrite a different frozen candidate. The candidate is not an applied or approved production migration.

## Migration order and promotion

1. **Isolated baseline:** provision a local Supabase development environment; copy the checked candidate into its timestamped migrations directory. Use the same CLI migration runner used later in staging. Do not create production tables through ad hoc dashboard edits. Verify the candidate hash and real Auth schema/roles, run the baseline, and compare the actual catalog with the inventory.
2. **Trusted administration:** provision the first coordinator separately through the approved administrative process. Add invitation/activation workflows, verified identity helpers and scoped authorization. No personal records or shared credentials belong in the baseline seeds.
3. **First vertical workflow:** add locked requirement submission/review RPCs, explicit public wrappers, security-invoker read views, narrowly scoped grants and RLS, private upload validation and transaction receipts. Test real Student A/B and unrelated staff JWTs before enabling reads.
4. **Remaining domains:** add clearance, attendance/DTR, academic and communication operations in reviewed forward migrations. Each migration includes its constraints, guards, permission tests and deployment dependencies. Public function execute defaults remain revoked; grants name exact functions/signatures.
5. **Staging:** apply identical migrations on a separate project with synthetic identities/files. Test direct RPC authorization, rollback, retries, two connections racing for one session/review, Auth partial failure, Storage policies, and recovery. Generate TypeScript database types from this validated Supabase schema; the hand-written domain contracts are not generated database types.
6. **Production:** promote only after staging gates, backup/recovery checks and deployment inputs pass. Record checksums/applied versions; prohibit editing an already applied migration. Real masterlist imports remain separate audited operations. No browser snapshots, sample approvals, or MySQL application-state dumps migrate as official enrollments.

## Schema boundaries and recovery

The baseline creates the unexposed `intrack` schema, relational tables, indexes and structural guards; RLS is enabled and client table/function/sequence privileges are denied. Only owner-supplied program hour targets are seeded, as **unpublished** policy versions. BSOA semesters are null in the frozen baseline; applied forward migration `202610140006` records the owner-confirmed second semester for both components. Auth fixtures exist only in tests, not in the candidate.

Guard triggers freeze submitted payloads and reference links, published policies/catalogs and validated asset identities, and protect append-only decisions/audit/receipts. They do not authorize actors or implement workflow transitions. Normalized evaluation scores are authoritative; the JSON score/rubric/manifest/printout fields are immutable snapshots written in the same command, not independently editable alternatives. JSON is used for bounded snapshots and policy content, not an application-wide state store.

Restrict/delete policies and history references favor preservation. Profile archival does not delete students' enrollments. Approved retention/anonymization is a separate controlled maintenance operation: immutable guards must not be casually disabled by application functions. Append-only receipts require an explicit future expiry/archive design if retention is introduced.

A failed transactional baseline rolls back. Once users depend on a migration, prefer a forward repair that preserves records; never use `DROP SCHEMA`, remote reset, or table truncation as routine rollback. Add fields/relations first, backfill with verified scope, switch readers, and remove obsolete structures only after separate review and recovery validation. Index choices must later be checked against actual scoped query plans and expected student volume.

## Remaining acceptance limits

PGlite success proves this model executes and the tested structural invariants hold in that engine. Local Supabase execution, server commands, real JWT scope policies, simultaneous-session locking, SMTP/Auth/Storage behavior, backups, and production deployment are still required. No service key, exposed domain API, live university record, or cloud project is created by this preparation.
