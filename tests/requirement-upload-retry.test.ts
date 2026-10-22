import { test } from 'node:test';
import assert from 'node:assert/strict';
import { uploadLiveRequirement, type PendingRequirementUpload, type RequirementUploadTransport } from '../src/app/lib/requirementGateway.ts';

const file=new File(['%PDF-1.7\n%%EOF'],'sample.pdf',{type:'application/pdf'});
const operation=():PendingRequirementUpload=>({commandId:crypto.randomUUID(),reservationCommandId:crypto.randomUUID(),
  payload:{enrollmentId:'synthetic',expectedEnrollmentRevision:0,expectedSubmissionRevision:null},name:file.name,bytes:file.size,mimeType:file.type});

test('lost submission response replays the same command without reuploading immutable bytes',async()=>{
  let pending=operation(),uploads=0,reserves=0;const submissions:unknown[]=[];
  const transport:RequirementUploadTransport={
    reserve:async()=>{reserves++;return {documentId:'synthetic-document',path:'private/path'};},
    upload:async()=>{uploads++;},
    finalize:async body=>{submissions.push(body);if(submissions.length===1)throw new Error('Lost response after commit');return {status:'submitted'};},
  };
  await assert.rejects(uploadLiveRequirement(pending,file,next=>{pending=next;},transport));
  await uploadLiveRequirement(pending,file,next=>{pending=next;},transport);
  assert.equal(reserves,1);assert.equal(uploads,1);assert.deepEqual(submissions[0],submissions[1]);
});
test('lost upload response can resume finalization after reload without the file',async()=>{
  let pending=operation(),uploads=0;
  const transport:RequirementUploadTransport={
    reserve:async()=>({documentId:'synthetic-document',path:'private/path'}),
    upload:async()=>{uploads++;throw new Error('Lost upload response');},
    finalize:async()=>({status:'submitted'}),
  };
  await assert.rejects(uploadLiveRequirement(pending,file,next=>{pending=next;},transport));
  assert.equal(pending.uploadAttempted,true);
  await uploadLiveRequirement(JSON.parse(JSON.stringify(pending)),undefined,next=>{pending=next;},transport);
  assert.equal(uploads,1);
});
test('missing bytes allow original file retry, but access or validation failures never trigger an upload',async()=>{
  let pending={...operation(),documentId:'synthetic-document',path:'private/path',uploadAttempted:true};let uploads=0,finalizations=0;
  const transport:RequirementUploadTransport={
    reserve:async()=>{throw new Error('Unexpected reservation');},upload:async()=>{uploads++;},
    finalize:async()=>{if(++finalizations===1)throw Object.assign(new Error('Missing bytes'),{code:'UPLOAD_MISSING'});return {status:'submitted'};},
  };
  await uploadLiveRequirement(pending,file,next=>{pending=next as typeof pending;},transport);
  assert.equal(uploads,1);
  transport.finalize=async()=>{throw new Error('Account access denied');};
  await assert.rejects(uploadLiveRequirement(pending,file,()=>{},transport));assert.equal(uploads,1);
});
test('reservation retries retain their command ID when the first response is lost',async()=>{
  let pending=operation();const ids:string[]=[];
  const transport:RequirementUploadTransport={
    reserve:async(_payload,id)=>{ids.push(id);if(ids.length===1)throw new Error('Lost reservation response');return {documentId:'synthetic-document',path:'private/path'};},
    upload:async()=>{},finalize:async()=>({status:'submitted'}),
  };
  await assert.rejects(uploadLiveRequirement(pending,file,next=>{pending=next;},transport));
  await uploadLiveRequirement(pending,file,next=>{pending=next;},transport);
  assert.equal(ids[0],ids[1]);
});
