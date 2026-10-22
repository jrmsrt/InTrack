import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL execution in memory. These minimal Auth fixtures are NOT Supabase Auth.
const db = new PGlite();
const ids = Object.fromEntries(['student','other','coordinator','term','enrollment','otherEnrollment','placement','otherPlacement','definition','requirement','otherRequirement','document','submission'].map(key => [key, randomUUID()]));
let policyId, programId;
before(async () => {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);');
  await db.exec(await readFile(new URL('../supabase-model.sql', import.meta.url), 'utf8'));
  programId = (await db.query("SELECT id FROM intrack.programs WHERE code='BSIT'")).rows[0].id;
  policyId = (await db.query('SELECT id FROM intrack.policy_versions WHERE program_id=$1', [programId])).rows[0].id;
  for (const key of ['student','other','coordinator']) await db.query('INSERT INTO intrack.profiles(id,display_name) VALUES ($1,$2)', [ids[key], `Synthetic ${key}`]);
  await db.query("INSERT INTO intrack.academic_terms(id,academic_year,semester,starts_on,ends_on) VALUES ($1,'2026-2027','2','2026-01-01','2026-12-31')", [ids.term]);
  for (const [enrollment, student, placement, requirement] of [['enrollment','student','placement','requirement'], ['otherEnrollment','other','otherPlacement','otherRequirement']]) {
    await db.query('INSERT INTO intrack.enrollments(id,student_id,program_id,term_id,policy_version_id,component,required_minutes) VALUES ($1,$2,$3,$4,$5,1,30000)', [ids[enrollment], ids[student], programId, ids.term, policyId]);
    const company = (await db.query("INSERT INTO intrack.companies(name,address) VALUES ('Synthetic company','Test address') RETURNING id")).rows[0].id;
    await db.query("INSERT INTO intrack.placements(id,enrollment_id,company_id,starts_on,schedule_snapshot) VALUES ($1,$2,$3,'2026-01-01','{}')", [ids[placement], ids[enrollment], company]);
  }
  await db.query("INSERT INTO intrack.requirement_definitions(id,policy_version_id,code,title,stage,evidence_type,reviewer) VALUES ($1,$2,'TEST','Synthetic requirement','pre','file','both')", [ids.definition, policyId]);
  for (const [requirement, enrollment] of [['requirement','enrollment'], ['otherRequirement','otherEnrollment']]) await db.query("INSERT INTO intrack.enrollment_requirements(id,enrollment_id,definition_id,definition_snapshot) VALUES ($1,$2,$3,'{}')", [ids[requirement], ids[enrollment], ids.definition]);
  await db.query("INSERT INTO intrack.documents(id,enrollment_id,requirement_id,uploaded_by,object_path,original_name,mime_type,byte_count,sha256,status,validated_at) VALUES ($1,$2,$3,$4,$5,'test.pdf','application/pdf',100,$6,'validated',now())", [ids.document, ids.enrollment, ids.requirement, ids.student, randomUUID(), 'a'.repeat(64)]);
  await db.query("INSERT INTO intrack.submission_versions(id,enrollment_id,requirement_id,version,submitted_by,document_id,status,submitted_at) VALUES ($1,$2,$3,1,$4,$5,'submitted',now())", [ids.submission, ids.enrollment, ids.requirement, ids.student, ids.document]);
});
after(async () => { await db.close(); });
const rejectsCode = (sql, values, code) => assert.rejects(db.query(sql, values), error => error.code === code);

test('blueprint executes; all domain tables enable RLS and client grants/functions are denied', async () => {
  const tables = (await db.query("SELECT c.oid, c.relname, c.relrowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='intrack' AND c.relkind='r'")).rows;
  assert.ok(tables.length > 40);
  assert.ok(tables.every(row => row.relrowsecurity));
  for (const role of ['anon','authenticated']) {
    const grants = await db.query("SELECT count(*)::int AS count FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='intrack' AND c.relkind='r' AND (has_table_privilege($1,c.oid,'SELECT') OR has_table_privilege($1,c.oid,'INSERT') OR has_table_privilege($1,c.oid,'UPDATE') OR has_table_privilege($1,c.oid,'DELETE'))", [role]);
    assert.equal(grants.rows[0].count, 0);
    const functions = await db.query("SELECT count(*)::int AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='intrack' AND has_function_privilege($1,p.oid,'EXECUTE')", [role]);
    assert.equal(functions.rows[0].count, 0);
  }
  await db.exec('SET ROLE authenticated');
  try { await rejectsCode('SELECT * FROM intrack.profiles', [], '42501'); }
  finally { await db.exec('RESET ROLE'); }
});
test('confirmed program seeds preserve hours and leave BSOA unpublished with unset terms', async () => {
  const rows = (await db.query('SELECT p.code,v.component,v.required_minutes,v.year_level,v.semester,v.confirmed_at FROM intrack.policy_versions v JOIN intrack.programs p ON p.id=v.program_id ORDER BY p.code,v.component')).rows;
  assert.equal(rows.length, 7);
  assert.deepEqual(rows.filter(row => row.code === 'BSOA').map(row => [row.required_minutes,row.semester,row.confirmed_at]), [[18000,null,null],[18000,null,null]]);
  assert.equal(rows.find(row => row.code === 'BSIT').required_minutes, 30000);
  assert.deepEqual(rows.filter(row => row.code === 'BSHM').map(row => row.required_minutes), [18000,36000]);
});
test('profile activation and practicum component relationships reject invalid records', async () => {
  await rejectsCode("INSERT INTO intrack.profiles(display_name,status) VALUES ('Invalid active','active')", [], '23514');
  await rejectsCode('INSERT INTO intrack.enrollments(student_id,program_id,term_id,policy_version_id,component,required_minutes) VALUES ($1,$2,$3,$4,2,30000)', [ids.student,programId,ids.term,policyId], '23503');
  await rejectsCode('INSERT INTO intrack.enrollments(student_id,program_id,term_id,policy_version_id,component,required_minutes) VALUES ($1,$2,$3,$4,1,30000)', [ids.student,programId,ids.term,policyId], '23505');
});
test('cross-enrollment and cross-requirement document attachments fail their composite foreign keys', async () => {
  await rejectsCode("INSERT INTO intrack.submission_versions(enrollment_id,requirement_id,version,submitted_by,document_id,status,submitted_at) VALUES ($1,$2,1,$3,$4,'submitted',now())", [ids.otherEnrollment,ids.otherRequirement,ids.other,ids.document], '23503');
  const occurrence = (await db.query("INSERT INTO intrack.enrollment_requirements(enrollment_id,definition_id,instance_key,definition_snapshot) VALUES ($1,$2,'second-test-occurrence','{}') RETURNING id", [ids.enrollment,ids.definition])).rows[0].id;
  await rejectsCode("INSERT INTO intrack.submission_versions(enrollment_id,requirement_id,version,submitted_by,document_id,status,submitted_at) VALUES ($1,$2,1,$3,$4,'submitted',now())", [ids.enrollment,occurrence,ids.student,ids.document], '23503');
});
test('submitted evidence cannot be overwritten, deleted or returned to draft', async () => {
  await rejectsCode('UPDATE intrack.submission_versions SET document_id=null,evidence_note=$1 WHERE id=$2', ['Replacement',ids.submission], '23514');
  await rejectsCode('DELETE FROM intrack.submission_versions WHERE id=$1', [ids.submission], '23514');
  await rejectsCode("UPDATE intrack.submission_versions SET status='draft' WHERE id=$1", [ids.submission], '23514');
  await db.query("UPDATE intrack.submission_versions SET status='under_review',revision=revision+1 WHERE id=$1", [ids.submission]);
});
test('exactly one current requirement version exists while superseded history remains', async () => {
  await rejectsCode("INSERT INTO intrack.submission_versions(enrollment_id,requirement_id,version,submitted_by,status) VALUES ($1,$2,2,$3,'draft')", [ids.enrollment,ids.requirement,ids.student], '23505');
});
test('append-only audit events cannot be changed or removed', async () => {
  const row = (await db.query("INSERT INTO intrack.audit_events(actor_id,entity_type,entity_id,action,command_id) VALUES ($1,'enrollment',$2,'test',$3) RETURNING id", [ids.coordinator,ids.enrollment,randomUUID()])).rows[0];
  await rejectsCode("UPDATE intrack.audit_events SET action='rewritten' WHERE id=$1", [row.id], '23514');
  await rejectsCode('DELETE FROM intrack.audit_events WHERE id=$1', [row.id], '23514');
});
test('open attendance uniqueness and Manila day constraints reject duplicate/bad sessions', async () => {
  const values = [ids.enrollment,ids.placement];
  const sql = "INSERT INTO intrack.attendance_sessions(enrollment_id,placement_id,clock_in_at,original_clock_in_at,attendance_date,gps_in,policy_snapshot,authority_snapshot,status) VALUES ($1,$2,'2026-10-09T23:00:00Z','2026-10-09T23:00:00Z',$3,'{}','{}','{}','open')";
  await rejectsCode(sql, [...values,'2026-10-09'], '23514');
  await db.query(sql, [...values,'2026-10-10']);
  await rejectsCode(sql, [...values,'2026-10-10'], '23505');
});
test('NO MOA can have no file while SAS status requires a referenced copy and evidence', async () => {
  await db.query("INSERT INTO intrack.moa_routing_events(enrollment_id,actor_id,status,remarks,command_id,enrollment_revision) VALUES ($1,$2,'NO MOA','No copy',$3,1)", [ids.enrollment,ids.coordinator,randomUUID()]);
  await rejectsCode("INSERT INTO intrack.moa_routing_events(enrollment_id,actor_id,status,remarks,command_id,enrollment_revision) VALUES ($1,$2,'SAS COPY SUBMITTED','Missing evidence',$3,2)", [ids.enrollment,ids.coordinator,randomUUID()], '23514');
});
test('failed database transaction rolls back its earlier successful insert', async () => {
  await db.exec('BEGIN');
  try {
    await db.query("INSERT INTO intrack.programs(code,name) VALUES ('ROLLBACK_TEST','Synthetic')");
    await rejectsCode("INSERT INTO intrack.profiles(display_name,status) VALUES ('Invalid','active')", [], '23514');
  } finally { await db.exec('ROLLBACK'); }
  assert.equal((await db.query("SELECT count(*)::int AS count FROM intrack.programs WHERE code='ROLLBACK_TEST'")).rows[0].count, 0);
});

test('published policy and catalog cannot be rewritten; validated document identity is fixed', async () => {
  const policy = (await db.query("INSERT INTO intrack.policy_versions(program_id,component,version,year_level,semester,required_minutes) VALUES ($1,1,99,4,'2',30000) RETURNING id", [programId])).rows[0].id;
  const definition = (await db.query("INSERT INTO intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer) VALUES ($1,'FROZEN','Frozen catalog','pre','file','adviser') RETURNING id", [policy])).rows[0].id;
  await db.query('UPDATE intrack.policy_versions SET confirmed_by=$1,confirmed_at=now() WHERE id=$2', [ids.coordinator,policy]);
  await rejectsCode('UPDATE intrack.policy_versions SET required_minutes=1 WHERE id=$1', [policy], '23514');
  await rejectsCode("UPDATE intrack.requirement_definitions SET title='Changed' WHERE id=$1", [definition], '23514');
  await rejectsCode("INSERT INTO intrack.requirement_definitions(policy_version_id,code,title,stage,evidence_type,reviewer) VALUES ($1,'LATE','Late amendment','pre','file','adviser')", [policy], '23514');
  await rejectsCode("UPDATE intrack.documents SET object_path='replacement' WHERE id=$1", [ids.document], '23514');
});
test('DTR references freeze on submission and credit requires the exact included source revision', async () => {
  const session = (await db.query('SELECT id FROM intrack.attendance_sessions WHERE enrollment_id=$1', [ids.enrollment])).rows[0].id;
  const dtr = (await db.query("INSERT INTO intrack.dtr_versions(enrollment_id,starts_on,ends_on,version,period_key,printable_snapshot,status) VALUES ($1,'2026-10-01','2026-10-31',1,'october','{}','draft') RETURNING id", [ids.enrollment])).rows[0].id;
  await db.query("INSERT INTO intrack.dtr_entries(enrollment_id,dtr_id,session_id,session_revision,frozen_snapshot) VALUES ($1,$2,$3,0,'{}')", [ids.enrollment,dtr,session]);
  await db.query("UPDATE intrack.dtr_versions SET status='submitted',submitted_at=now() WHERE id=$1", [dtr]);
  await rejectsCode('UPDATE intrack.dtr_entries SET session_revision=1 WHERE dtr_id=$1', [dtr], '23514');
  await rejectsCode("INSERT INTO intrack.hour_credits(enrollment_id,dtr_id,session_id,session_revision,credit_date,minutes) VALUES ($1,$2,$3,1,'2026-10-10',60)", [ids.enrollment,dtr,session], '23503');
  // Direct fixture insertion checks ledger uniqueness; live approval still needs its RPC.
  await db.query("INSERT INTO intrack.hour_credits(enrollment_id,dtr_id,session_id,session_revision,credit_date,minutes) VALUES ($1,$2,$3,0,'2026-10-10',60)", [ids.enrollment,dtr,session]);
  await rejectsCode("INSERT INTO intrack.hour_credits(enrollment_id,dtr_id,session_id,session_revision,credit_date,minutes) VALUES ($1,$2,$3,0,'2026-10-10',60)", [ids.enrollment,dtr,session], '23505');
});

test('rubric criteria and normalized scores enforce same-template relationships and freeze after publication/submission', async () => {
  const template = (await db.query("INSERT INTO intrack.evaluation_templates(policy_version_id,kind,title,version,calculation_rule) VALUES ($1,'company','Synthetic rubric',1,'{}') RETURNING id", [policyId])).rows[0].id;
  const criterion = (await db.query("INSERT INTO intrack.evaluation_criteria(template_id,label,ordinal,max_points) VALUES ($1,'Criterion',1,5.5) RETURNING id", [template])).rows[0].id;
  const otherTemplate = (await db.query("INSERT INTO intrack.evaluation_templates(policy_version_id,kind,title,version,calculation_rule) VALUES ($1,'company','Other rubric',2,'{}') RETURNING id", [policyId])).rows[0].id;
  const foreignCriterion = (await db.query("INSERT INTO intrack.evaluation_criteria(template_id,label,ordinal,max_points) VALUES ($1,'Foreign',1,5.5) RETURNING id", [otherTemplate])).rows[0].id;
  await db.query('UPDATE intrack.evaluation_templates SET published_at=now() WHERE id=$1', [template]);
  await rejectsCode('UPDATE intrack.evaluation_criteria SET max_points=100 WHERE id=$1', [criterion], '23514');
  const evaluation = (await db.query("INSERT INTO intrack.evaluation_versions(enrollment_id,kind,version,template_id,rubric_snapshot,scores,evaluator_name,evaluator_affiliation,created_by,document_id,evaluated_on,status) VALUES ($1,'company',1,$2,'{}','{}','Synthetic evaluator','Company',$3,$4,'2026-10-10','draft') RETURNING id", [ids.enrollment,template,ids.student,ids.document])).rows[0].id;
  await rejectsCode('INSERT INTO intrack.evaluation_scores(evaluation_id,criterion_id,template_id,max_points_snapshot,points) VALUES ($1,$2,$3,5.5,4.5)', [evaluation,foreignCriterion,template], '23503');
  await db.query('INSERT INTO intrack.evaluation_scores(evaluation_id,criterion_id,template_id,max_points_snapshot,points) VALUES ($1,$2,$3,5.5,4.5)', [evaluation,criterion,template]);
  await db.query("UPDATE intrack.evaluation_versions SET status='submitted',submitted_at=now(),content_hash=$1 WHERE id=$2", ['b'.repeat(64),evaluation]);
  await rejectsCode('UPDATE intrack.evaluation_scores SET points=5.0 WHERE evaluation_id=$1', [evaluation], '23514');
});
