import {test} from 'node:test';
import assert from 'node:assert/strict';
import {localTestNoticeAvailable} from '../src/app/lib/privacy.ts';
test('local development acknowledgment never substitutes for a cloud, production or unknown notice',()=>{
 assert.equal(localTestNoticeAvailable('dev-test-only',{development:true,url:'http://127.0.0.1:54321'}),true);
 for(const settings of [{development:false,url:'http://127.0.0.1:54321'},{development:true,url:'https://example.supabase.co'},{development:true,url:'http://localhost:54320'},{development:true,url:'http://127.0.0.1.example.test:54321'}])assert.equal(localTestNoticeAvailable('dev-test-only',settings),false);
 assert.equal(localTestNoticeAvailable('unseen-version',{development:true,url:'http://localhost:54321'}),false);
});
