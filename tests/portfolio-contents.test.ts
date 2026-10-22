import {test} from 'node:test';
import assert from 'node:assert/strict';
import {portfolioContents,appendMissingRequirements,addedPostOJTRequirements} from '../src/app/domain/portfolioContents.ts';

test('template catalog preserves all supplied contents and separate pre/post resume evidence',()=>{
  assert.equal(portfolioContents.length,32);
  assert.equal(new Set(portfolioContents.map(item=>item.id)).size,32);
  assert.equal(portfolioContents.filter(item=>item.group==='Pre-OJT appendices').length,13);
  assert.equal(portfolioContents.find(item=>item.id==='pre-resume')?.templatePage,'38');
  assert.equal(portfolioContents.find(item=>item.id==='post-resume')?.templatePage,'65');
  assert.equal(portfolioContents.find(item=>item.id==='registration')?.existingRequirement,'Certificate of Registration (COR)');
});
test('additive checklist upgrade keeps existing custom fields, evidence and decisions and is repeat-safe',()=>{
  const existing=[{name:'Additional existing requirement',status:'Approved',file:{id:'saved-file'},custom:'preserved'}];
  const make=(name:string)=>({name,status:'Not Submitted',file:null,custom:''});
  const updated=appendMissingRequirements(existing,addedPostOJTRequirements,make);
  assert.strictEqual(updated[0],existing[0]);
  assert.equal(updated.length,2);
  assert.equal(updated[1].status,'Not Submitted');
  assert.deepEqual(appendMissingRequirements(updated,addedPostOJTRequirements,make),updated);
  assert.equal(existing.length,1);
});
