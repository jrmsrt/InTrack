import { spawnSync } from 'node:child_process';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PGlite } from '@electric-sql/pglite';

const root = fileURLToPath(new URL('../', import.meta.url));
const checked = spawnSync(process.execPath, ['--test', 'database/tests/schema.test.mjs'], { cwd: root, stdio: 'inherit' });
if (checked.error) throw checked.error;
if (checked.status !== 0) process.exit(checked.status ?? 1);
const sql = (await readFile(new URL('./supabase-model.sql', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const checksum = createHash('sha256').update(sql).digest('hex');
const db = new PGlite();
let inventory;
try {
  await db.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);');
  await db.exec(sql);
  const tables = (await db.query("SELECT c.relname AS name,c.relrowsecurity AS rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='intrack' AND c.relkind='r' ORDER BY c.relname")).rows;
  const constraints = (await db.query("SELECT c.conname AS name,c.contype AS type,c.conrelid::regclass::text AS relation,pg_get_constraintdef(c.oid) AS definition FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname='intrack' ORDER BY relation,name")).rows;
  const indexes = (await db.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname='intrack' ORDER BY tablename,indexname")).rows;
  const triggers = (await db.query("SELECT c.relname AS relation,t.tgname AS name,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='intrack' AND NOT t.tgisinternal ORDER BY relation,name")).rows;
  const engine = (await db.query('SELECT version() AS version')).rows[0].version;
  inventory = { candidate: '202610100001_domain_baseline.sql', sha256: checksum, validation: 'PGlite PostgreSQL with minimal Auth fixtures; Supabase integration NOT validated', engine, tables, constraints, indexes, triggers };
} finally { await db.close(); }
const directory = new URL('./migration-candidates/', import.meta.url);
await mkdir(directory, { recursive: true });
const candidate = new URL('202610100001_domain_baseline.sql', directory);
try { await writeFile(candidate, sql, { flag: 'wx' }); }
catch (error) {
  if (error.code !== 'EEXIST') throw error;
  if (await readFile(candidate, 'utf8') !== sql) throw new Error('Frozen candidate differs. Prepare a reviewed forward migration; do not overwrite it.');
}
await writeFile(new URL('./schema-inventory.json', import.meta.url), JSON.stringify(inventory, null, 2) + '\n');
console.log(`Prepared isolated candidate: ${inventory.tables.length} tables; ${inventory.constraints.length} constraints; ${inventory.triggers.length} guards. No external database accessed.`);
