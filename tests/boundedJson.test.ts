import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundedJson} from '../supabase/functions/_shared/boundedJson.ts';
test('JSON request reader limits encoded bytes and cancels oversized streams',async()=>{
 assert.deepEqual(await boundedJson(new Request('http://localhost',{method:'POST',body:'{"ok":true}'})),{ok:true});
 await assert.rejects(()=>boundedJson(new Request('http://localhost',{method:'POST',body:'{"x":"éé"}'}),10),/BODY_TOO_LARGE/);
 let cancelled=false;const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(8193));},cancel(){cancelled=true;}});
 await assert.rejects(()=>boundedJson(new Request('http://localhost',{method:'POST',body:stream,duplex:'half'} as RequestInit)),/BODY_TOO_LARGE/);
 assert.equal(cancelled,true);
 await assert.rejects(()=>boundedJson(new Request('http://localhost',{method:'POST',body:'invalid'})));
});
