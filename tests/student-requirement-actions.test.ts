import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createStudentRequirementActions,resolveStudentRequirement,studentRequirementItem,liveRequirementTitle} from '../src/app/lib/studentRequirementActions.ts';
import type {LiveRequirement} from '../src/app/lib/requirementGateway.ts';
const row=(extra:Partial<LiveRequirement>={}):LiveRequirement=>({id:'registration',requirementRevision:0,title:'Registration Card/Form',code:'COR',reviewer:'both',evidenceType:'file',stage:'pre',allowedStages:['pre_ojt'],dueAt:null,waived:false,enrollmentId:'own',enrollmentRevision:0,lifecycle:'pre_ojt',outcome:'active',studentName:'Own Student',programCode:'BSIT',submission:null,history:[],...extra});
const file=new File(['%PDF-1.7\n%%EOF'],'Own_BSIT_COR.pdf',{type:'application/pdf'});
test('student checklist retains the assigned requirement description',()=>{
 assert.equal(studentRequirementItem(row({description:'Upload a clear, signed PDF.\nInclude every page.'})).description,'Upload a clear, signed PDF.\nInclude every page.');
});
function fixture(initial=row()){
 const state={row:initial,saved:0,uploads:[] as any[],physical:[] as any[],fail:false};const values=new Map<string,string>();
 const actions=createStudentRequirementActions('self','own',()=>state.saved++,{
  list:async()=>[state.row],storage:{getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);},removeItem:key=>{values.delete(key);}},
  upload:async(operation,_file,save)=>{state.uploads.push(operation);save({...operation,documentId:'private-doc',path:'self/own/private-doc',uploadAttempted:true});if(state.fail)throw new Error('Response lost');},
  physical:async(id,payload)=>{state.physical.push({id,payload});if(state.fail)throw new Error('Response lost');},
 });return {state,actions,values};
}
test('only the exact enrollment, stage and unambiguous requirement alias are selected',()=>{
 assert.equal(resolveStudentRequirement([row(),row({id:'foreign',enrollmentId:'other'})],'own','pre','Certificate of Registration (COR)').id,'registration');
 assert.throws(()=>resolveStudentRequirement([row()],undefined,'pre','Resume'),/enrollment approval/);
 assert.throws(()=>resolveStudentRequirement([row()],'own','post','Registration Card/Form'),/not been assigned/);
 assert.throws(()=>resolveStudentRequirement([row(),row({id:'duplicate'})],'own','pre','Registration Card/Form'),/Multiple assigned/);
 assert.equal(liveRequirementTitle(row({title:'Pictures per week',instanceKey:'week-2'})),'Pictures / Documentation (Week 2)');
});
test('live upload persists retry metadata without file bytes and refreshes only after success',async()=>{
 const {state,actions,values}=fixture();state.fail=true;
 await assert.rejects(actions.upload('pre','Certificate of Registration (COR)',file),/Response lost/);
 assert.equal(state.saved,0);assert.equal(values.size,1);assert.ok(![...values.values()][0].includes('%PDF'));
 // Even after a lost committed response, replay the original command IDs.
 state.row=row({submission:{id:'submitted',version:1,revision:0,status:'submitted',documentId:'private-doc',reviewStartedAt:null,submittedAt:'2026-10-17'}});state.fail=false;
 await actions.upload('pre','Certificate of Registration (COR)',file);
 assert.equal(state.uploads[0].commandId,state.uploads[1].commandId);assert.equal(state.uploads[0].reservationCommandId,state.uploads[1].reservationCommandId);
 assert.equal(state.saved,1);assert.equal(values.size,0);
});
test('approved, wrong-stage and specialized items cannot upload generic file evidence',async()=>{
 for(const extra of [{waived:true},{lifecycle:'during_ojt'},{evidenceType:'evaluation'},{submission:{id:'done',version:1,revision:1,status:'approved',documentId:null,submittedAt:'2026-10-17',reviewStartedAt:null}}]){
  const {state,actions}=fixture(row(extra));await assert.rejects(actions.upload('pre','Registration Card/Form',file));assert.equal(state.uploads.length,0);assert.equal(state.saved,0);
 }
});
test('physical confirmation replays the same command and never represents staff approval',async()=>{
 const {state,actions,values}=fixture(row({title:'Practicum kit (expanded envelope)',evidenceType:'staff_verification'}));state.fail=true;
 await assert.rejects(actions.physical('pre','Practicum kit (expanded envelope)','Handed Over (Physical)'));
 state.fail=false;await actions.physical('pre','Practicum kit (expanded envelope)','Handed Over (Physical)');
 assert.equal(state.physical[0].id,state.physical[1].id);assert.equal(state.physical[1].payload.note,'Handed Over (Physical)');assert.equal(values.size,0);assert.equal(state.saved,1);
});
test('saved document names and final server status survive reload without marking partial reviews approved',()=>{
 const projected=studentRequirementItem(row({submission:{id:'s',version:1,revision:1,status:'under_review',submittedAt:'2026-10-17',documentId:'doc',documentName:'Own_COR.pdf',mimeType:'application/pdf',reviewStartedAt:null},history:[{id:'s',version:1,status:'under_review',submittedAt:'2026-10-17',documentId:'doc',current:true,verifications:[],reviews:[{role:'adviser',decision:'approved',remarks:'First review complete',at:'2026-10-17'}]}]}));
 assert.equal(projected.status,'Under Review');assert.equal(projected.fileName,'Own_COR.pdf');assert.equal(projected.file?.backendRole,'student');assert.equal(projected.file?.backendDocumentId,'doc');assert.equal(projected.remarks,'First review complete');
});
test('expired uncommitted reservations are renewed, but committed lost responses keep their IDs',async()=>{
 const {state,actions,values}=fixture();state.fail=true;
 await assert.rejects(actions.upload('pre','Registration Card/Form',file));
 const key=[...values.keys()][0],old=JSON.parse(values.get(key)!);
 values.set(key,JSON.stringify({...old,expiresAt:'2000-01-01T00:00:00Z'}));state.fail=false;
 await actions.upload('pre','Registration Card/Form',file);
 assert.notEqual(state.uploads[0].commandId,state.uploads[1].commandId);
});
test('invalid file validation releases only retry metadata so a corrected file can be submitted',async()=>{
 const values=new Map<string,string>();let attempts=0,saved=0;
 const actions=createStudentRequirementActions('self','own',()=>saved++,{list:async()=>[row()],storage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>{values.set(k,v);},removeItem:k=>{values.delete(k);}},physical:async()=>{},
  upload:async()=>{if(++attempts===1)throw Object.assign(new Error('Invalid file contents'),{code:'FILE_INVALID'});}});
 await assert.rejects(actions.upload('pre','Registration Card/Form',file),/Invalid file/);assert.equal(values.size,0);assert.equal(saved,0);
 await actions.upload('pre','Registration Card/Form',file);assert.equal(saved,1);
});
