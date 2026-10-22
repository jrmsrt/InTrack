import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectRequirementBytes, MAX_REQUIREMENT_BYTES } from '../supabase/functions/_shared/requirementFile.ts';

test('rejects empty, oversized, HTML masquerading as a PDF and truncated containers',()=>{
  for(const bytes of [new Uint8Array(),new Uint8Array(MAX_REQUIREMENT_BYTES+1),new TextEncoder().encode('<html>fake.pdf</html>'),
    new TextEncoder().encode('%PDF-1.7 truncated'),new Uint8Array([0xff,0xd8,0xff,0x00])])assert.equal(inspectRequirementBytes(bytes),null);
});
test('identifies permitted signatures independently of browser MIME and filenames',()=>{
  assert.equal(inspectRequirementBytes(new TextEncoder().encode('%PDF-1.7\nsynthetic container\n%%EOF\n')),'application/pdf');
  assert.equal(inspectRequirementBytes(new Uint8Array([0xff,0xd8,0xff,0x00,0xff,0xd9])),'image/jpeg');
});
test('PNG requires bounded chunks, dimensions, image data and a final IEND',()=>{
  const bytes=new Uint8Array(58);bytes.set([137,80,78,71,13,10,26,10]);const view=new DataView(bytes.buffer);
  view.setUint32(8,13);bytes.set(new TextEncoder().encode('IHDR'),12);view.setUint32(16,1);view.setUint32(20,1);
  view.setUint32(33,1);bytes.set(new TextEncoder().encode('IDAT'),37);bytes[41]=1;
  view.setUint32(46,0);bytes.set(new TextEncoder().encode('IEND'),50);
  assert.equal(inspectRequirementBytes(bytes),'image/png');
  view.setUint32(33,99999);assert.equal(inspectRequirementBytes(bytes),null);
});
