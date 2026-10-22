import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite();
before(async () => {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth; create schema intrack;
    create table auth.users(id int primary key, email text, deleted_at timestamptz, banned_until timestamptz);
    create table intrack.profiles(auth_user_id int unique, status text, activated_at timestamptz);
    insert into auth.users(id,email) values
      (1,'active@example.test'),(2,'invited@example.test'),(3,'incomplete@example.test'),
      (4,'suspended@example.test'),(5,'deleted@example.test'),(6,'banned@example.test');
    insert into intrack.profiles values
      (1,'active',now()),(2,'invited',null),(3,'active',null),
      (4,'suspended',now()),(5,'active',now()),(6,'active',now());
    update auth.users set deleted_at=now() where id=5;
    update auth.users set banned_until=now()+interval '1 hour' where id=6;
  `);
  await db.exec(await readFile(new URL('../../supabase/migrations/202610210053_password_recovery_activation.sql', import.meta.url), 'utf8'));
  await db.exec('set role anon');
});
after(async () => db.close());

async function status(email) {
  return (await db.query('select public.intrack_password_recovery_status($1) as status', [email])).rows[0].status;
}

test('anonymous recovery check requires both active status and completed activation', async () => {
  assert.equal(await status(' Active@Example.test '), 'ready');
  assert.equal(await status('invited@example.test'), 'activation_required');
  assert.equal(await status('incomplete@example.test'), 'activation_required');
});

test('unknown, suspended, deleted and banned accounts cannot request recovery through the form', async () => {
  for (const name of ['unknown', 'suspended', 'deleted', 'banned']) {
    assert.equal(await status(`${name}@example.test`), 'unavailable');
  }
  await assert.rejects(db.query('select * from intrack.profiles'), error => error.code === '42501');
});
