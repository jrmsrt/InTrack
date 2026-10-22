import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertBrowserSupabaseKey} from '../src/app/lib/supabaseBrowserKey.ts';
const jwt=(role:string)=>`header.${Buffer.from(JSON.stringify({role})).toString('base64url')}.signature`;
test('browser connection permits publishable/anon API configuration, not privileged keys or user tokens',()=>{
  assertBrowserSupabaseKey('sb_publishable_synthetic');assertBrowserSupabaseKey(jwt('anon'));
  for(const key of ['sb_secret_synthetic',jwt('service_role'),jwt('authenticated'),'signing-secret','malformed'])assert.throws(()=>assertBrowserSupabaseKey(key));
});
