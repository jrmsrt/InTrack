import {test} from 'node:test';
import assert from 'node:assert/strict';
import {importAndWhitelist,masterlistRows,type CoordinatorWorkflowDependencies} from '../src/app/lib/coordinatorGateway.ts';
const records=[{studentNumber:' TEST-1 ',name:' Mary Ann De La Cruz ',email:'ONE@example.test',program:'BSIT — IT',section:'3-1'},{studentNumber:'TEST-2',name:'Second Student',email:'two@example.test',program:'BSIT',section:'3-1'}];
function memory(){const data=new Map<string,string>();Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)||null,setItem:(key:string,value:string)=>data.set(key,value),removeItem:(key:string)=>data.delete(key)}});return data;}
const eligible=(profile=false)=>records.map((row,index)=>({id:`eligible-${index}`,studentNumber:row.studentNumber.trim(),email:row.email.toLowerCase(),programId:'program',profileId:profile?'existing-profile':null}));
const directory=(profile=false)=>({programs:[{id:'program',code:'BSIT'}],eligibleStudents:eligible(profile)});
test('portal imports preserve complete names, normalize identities and bound batch size',()=>{
 assert.deepEqual(masterlistRows(records)[0],{studentNumber:'TEST-1',name:'Mary Ann De La Cruz',email:'one@example.test',programCode:'BSIT',section:'3-1'});
 assert.throws(()=>masterlistRows([]));assert.throws(()=>masterlistRows(Array(501).fill(records[0])));
});
test('a failed validation never commits or starts provisioning',async()=>{
 const storage=memory();let writes=0;
 const dependencies={assertActor:async()=>{},rpc:async(name:string)=>{if(name!=='intrack_preview_masterlist')writes++;return {issues:[{row:1,message:'Approved domain required'}]};},invite:async()=>{writes++;}} as unknown as CoordinatorWorkflowDependencies;
 await assert.rejects(importAndWhitelist('actor',records,dependencies),/Row 1/);assert.equal(writes,0);assert.equal(storage.size,0);
});
test('lost commit response retains the same receipt and preview for an exact retry',async()=>{
 memory();let previews=0,commits:string[]=[],attempt=0,invites=0;
 const dependencies={assertActor:async()=>{},rpc:async(name:string,args:any)=>{if(name==='intrack_preview_masterlist'){previews++;return {validationToken:'token',issues:[]};}commits.push(args.command_id);if(attempt++===0)throw new Error('Connection lost');return {};},directory:async()=>directory(),invite:async()=>{invites++;}} as unknown as CoordinatorWorkflowDependencies;
 await assert.rejects(importAndWhitelist('actor',records,dependencies),/Connection lost/);
 assert.deepEqual(await importAndWhitelist('actor',records,dependencies),{imported:2,skipped:0});assert.equal(previews,1);assert.equal(commits[0],commits[1]);assert.equal(invites,2);
});
test('partly provisioned batches report the confirmed count and retry existing accounts without recreating them',async()=>{
 memory();let failed=false;const created=new Set<string>();let firstInvites=0;
 const dependencies={assertActor:async()=>{},rpc:async(name:string)=>name==='intrack_preview_masterlist'?{validationToken:'token',issues:[]}:{},directory:async()=>({programs:[{id:'program',code:'BSIT'}],eligibleStudents:eligible().map(row=>({...row,profileId:created.has(row.id)?'saved':null}))}),roster:async(_role:string,filters:any)=>({items:eligible().filter(row=>row.studentNumber===filters.search).map(row=>({eligibleId:row.id,whitelisted:created.has(row.id),accessEnabled:created.has(row.id),membershipActive:true}))}),invite:async(_actor:string,payload:any)=>{if(payload.eligibleStudentId==='eligible-0')firstInvites++;if(payload.eligibleStudentId==='eligible-1'&&!failed){failed=true;throw new Error('Provider unavailable');}created.add(payload.eligibleStudentId);}} as unknown as CoordinatorWorkflowDependencies;
 await assert.rejects(importAndWhitelist('actor',records,dependencies),/1 of 2 accounts confirmed/);
 assert.deepEqual(await importAndWhitelist('actor',records,dependencies),{imported:2,skipped:0});assert.equal(firstInvites,1);assert.equal(created.size,2);
});
