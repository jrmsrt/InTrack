import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseApiFetch } from '../src/app/lib/supabaseApiFetch.ts';

for (const key of ['sb_secret_synthetic', 'sb_publishable_synthetic']) {
  test(`${key.split('_')[1]} API key is sent only through apikey in SDK database requests`, async () => {
    let observed: Headers | undefined;
    const transport: typeof fetch = async (_input, init) => {
      observed = new Headers(init?.headers);
      return new Response('{}', { headers: { 'Content-Type': 'application/json' } });
    };
    const client = createClient('http://127.0.0.1:54321', key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: createSupabaseApiFetch(key, transport) },
    });
    const { error } = await client.rpc('synthetic_identity');
    assert.equal(error, null);
    assert.equal(observed?.get('apikey'), key);
    assert.equal(observed?.get('Authorization'), null);
  });
}

test('operator Auth invitation keeps its API key without treating it as a JWT', async () => {
  const key = 'sb_secret_synthetic';
  let observed: Headers | undefined;
  const transport: typeof fetch = async (_input, init) => {
    observed = new Headers(init?.headers);
    return new Response('{"id":"synthetic-user"}', { headers: { 'Content-Type': 'application/json' } });
  };
  const client = createClient('http://127.0.0.1:54321', key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: createSupabaseApiFetch(key, transport) },
  });
  const { error } = await client.auth.admin.inviteUserByEmail('synthetic@example.test');
  assert.equal(error, null);
  assert.equal(observed?.get('apikey'), key);
  assert.equal(observed?.get('Authorization'), null);
});

test('preserves signed-in user JWTs and legacy service JWTs', async () => {
  for (const [key, token] of [
    ['sb_publishable_synthetic', 'user.session.jwt'],
    ['legacy.service.jwt', 'legacy.service.jwt'],
  ]) {
    const transport: typeof fetch = async (_input, init) => {
      assert.equal(new Headers(init?.headers).get('Authorization'), `Bearer ${token}`);
      return new Response('{}');
    };
    await createSupabaseApiFetch(key, transport)('http://localhost', {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
});

test('preserves request body, headers and options without mutating caller headers', async () => {
  const key = 'sb_secret_synthetic';
  const request = new Request('http://localhost', { headers: { 'X-Request': 'preserved' } });
  const headers = new Headers({ Authorization: `Bearer ${key}`, apikey: key });
  const transport: typeof fetch = async (input, init) => {
    assert.equal(input, request);
    assert.equal(init?.method, 'POST');
    assert.equal(init?.body, '{"test":true}');
    assert.equal(new Headers(init?.headers).get('X-Request'), 'preserved');
    assert.equal(new Headers(init?.headers).get('Authorization'), null);
    return new Response('{}');
  };
  await createSupabaseApiFetch(key, transport)(request, { method: 'POST', body: '{"test":true}', headers });
  assert.equal(headers.get('Authorization'), `Bearer ${key}`);
});
