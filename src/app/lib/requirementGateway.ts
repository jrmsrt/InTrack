import { getSupabaseClient } from './supabaseClient.ts';
import type { IdentityRole } from './protectedIdentity';

export interface LiveRequirement {
  stage?:'pre'|'during'|'post';instanceKey?:string;
  id:string;requirementRevision:number;title:string;description?:string;code:string;reviewer:'adviser'|'coordinator'|'both';evidenceType:string;
  allowedStages:string[];dueAt:string|null;waived:boolean;enrollmentId:string;enrollmentRevision:number;
  lifecycle:string;outcome:string;studentName:string;programCode:string;
  submission:null|{id:string;version:number;revision:number;status:string;submittedAt:string;documentId:string|null;documentName?:string|null;mimeType?:string|null;reviewStartedAt:string|null};
  history:{id:string;version:number;status:string;submittedAt:string;documentId:string|null;current:boolean;
    verifications:{note:string;verifiedAt:string;verifiedBy:string}[];
    reviews:{role:string;decision:string;remarks:string;at:string}[]}[];
}
type Payload=Record<string,unknown>;
export interface PendingRequirementUpload {
  commandId:string;reservationCommandId:string;payload:Payload;
  name:string;bytes:number;mimeType:string;documentId?:string;path?:string;uploadAttempted?:boolean;
  expiresAt?:string;
}
export function requirementPayload(row:LiveRequirement):Payload {
  return {enrollmentId:row.enrollmentId,requirementId:row.id,expectedEnrollmentRevision:row.enrollmentRevision,
    expectedSubmissionRevision:row.submission?.revision??null,submissionId:row.submission?.id??null};
}
export function newRequirementUpload(row:LiveRequirement,file:File):PendingRequirementUpload {
  if(!['application/pdf','image/jpeg','image/png'].includes(file.type)||file.size<=0||file.size>10485760) {
    throw new Error('Choose a PDF, JPEG or PNG between 1 byte and 10 MB.');
  }
  return {commandId:crypto.randomUUID(),reservationCommandId:crypto.randomUUID(),payload:requirementPayload(row),name:file.name,bytes:file.size,mimeType:file.type};
}
export async function listLiveRequirements(role:IdentityRole):Promise<LiveRequirement[]> {
  const {data,error}=await getSupabaseClient().rpc('intrack_list_requirements',{actor_role:role});
  if(error)throw new Error(error.message);
  if(!Array.isArray(data))throw new Error('Invalid requirements response.');
  return data;
}
export async function requirementCommand(action:string,payload:Payload,commandId:string):Promise<unknown> {
  const {data,error}=await getSupabaseClient().rpc('intrack_requirement_command',{command_id:commandId,action,payload});
  if(error)throw Object.assign(new Error(error.message),{code:error.code});return data;
}
async function fileOperation(body:Payload):Promise<any> {
  const {data,error}=await getSupabaseClient().functions.invoke('requirement-files',{body});
  if(error){
    let message='File service failed. Keep the pending operation and retry.';
    let code:string|undefined;
    const response=(error as {context?:Response}).context;
    if(response){try{const body=await response.json();message=body.error||message;code=body.code;}catch{ /* No credential diagnostics. */ }}
    throw Object.assign(new Error(message),{code});
  }
  return data;
}
/** Save operation IDs before network calls so a lost response replays safely. */
export interface RequirementUploadTransport {
  reserve:(payload:Payload,commandId:string)=>Promise<{documentId:string;path:string;expiresAt?:string}>;
  upload:(path:string,file:File,mimeType:string)=>Promise<void>;
  finalize:(body:Payload)=>Promise<unknown>;
}
const uploadTransport:RequirementUploadTransport={
  reserve:async(payload,commandId)=>await requirementCommand('reserve_upload',payload,commandId) as {documentId:string;path:string},
  upload:async(path,file,mimeType)=>{
    const {error}=await getSupabaseClient().storage.from('ojt-documents').upload(path,file,{contentType:mimeType,upsert:false});
    if(error && String(error.statusCode)!=='409' && ('error' in error?error.error:undefined)!=='Duplicate')throw new Error('Upload failed. Reselect the original file and retry.');
  },
  finalize:fileOperation,
};
export async function uploadLiveRequirement(operation:PendingRequirementUpload,file:File|undefined,
  save:(next:PendingRequirementUpload)=>void,transport:RequirementUploadTransport=uploadTransport):Promise<void> {
  let current=operation;
  if(!current.documentId){
    const result=await transport.reserve({...current.payload,name:current.name,bytes:current.bytes,mimeType:current.mimeType},current.reservationCommandId);
    current={...current,...result};save(current);
  }
  const finalize=()=>transport.finalize({action:'finalize',role:'student',documentId:current.documentId,commandId:current.commandId,
    payload:{...current.payload,documentId:current.documentId}});
  // After a lost response, the object may already be validated or submitted.
  // Resolve that operation first; its upload policy correctly rejects reuploads.
  if(current.uploadAttempted || !file){
    try{await finalize();return;}catch(error){
      if(!file||(error as {code?:string}).code!=='UPLOAD_MISSING')throw error;
    }
  }
  if(file){
    if(file.name!==current.name||file.size!==current.bytes||file.type!==current.mimeType)throw new Error('Reselect the original file, or discard this pending operation and start a new upload.');
    current={...current,uploadAttempted:true};save(current);
    // A lost upload response can leave the immutable object present. Finalization
    // validates the existing bytes; never overwrite it or ignore other failures.
    await transport.upload(current.path!,file,current.mimeType);
  }
  await finalize();
}
export async function requirementDownload(documentId:string,role:IdentityRole):Promise<string> {
  const result=await fileOperation({action:'download',documentId,role});
  if(typeof result?.url!=='string')throw new Error('Download unavailable.');return result.url;
}
