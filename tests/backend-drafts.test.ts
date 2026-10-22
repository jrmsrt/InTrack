import {test} from 'node:test';
import assert from 'node:assert/strict';
import {clearBackendDrafts} from '../src/app/lib/backendDrafts.ts';
test('sign-out clears real backend operation drafts without deleting unrelated browser data',()=>{
  const data=new Map([['intrack-local-upload:person:requirement','pending'],['intrack-local-invitation:person:student:id','pending'],['intrack-template:person:BSIT','pending'],['intrack-coordinator-command:person:masterlist:digest','pending'],['intrack-enrollment-command:person:digest','pending'],['intrack-class-join-command:person:digest','pending'],['unrelated-preference','preserve']]);
  const storage={get length(){return data.size;},key:(index:number)=>[...data.keys()][index]??null,removeItem:(key:string)=>data.delete(key)} as unknown as Storage;
  clearBackendDrafts(storage);assert.deepEqual([...data],[['unrelated-preference','preserve']]);
});
