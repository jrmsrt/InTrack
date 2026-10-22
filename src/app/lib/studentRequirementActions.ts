import {requirementChecklistKey} from '../domain/requirementChecklist.ts';
import type {RequirementStage,RequirementItem} from '../context/OJTContext';
import {listLiveRequirements,newRequirementUpload,uploadLiveRequirement,requirementPayload,type LiveRequirement,type PendingRequirementUpload} from './requirementGateway.ts';
import {backendRpc} from './backendGateway.ts';

export function liveRequirementTitle(row:LiveRequirement):string {
 // Recurring occurrences are explicit policy keys, never derived from row order.
 const week=row.instanceKey?.match(/^(?:week[-_ ]?)?(\d+)$/i)?.[1];
 if(week&&/^(Weekly Journal|Pictures per week|Pictures \/ Documentation)$/i.test(row.title)) {
  const title=/^pictures/i.test(row.title)?'Pictures / Documentation':'Weekly Journal';
  return `${title} (Week ${Number(week)})`;
 }
 return row.title;
}
export function liveRequirementStage(row:LiveRequirement):RequirementStage {
 return row.stage||({pre_ojt:'pre',during_ojt:'during',post_ojt:'post'} as const)[row.allowedStages[0] as 'pre_ojt']||'pre';
}
/** Student status reflects the final server decision, not an intermediate staff approval. */
export function studentRequirementItem(row:LiveRequirement):RequirementItem {
 const name=row.submission?.documentName||row.title;
 const reviews=row.history.find(h=>h.id===row.submission?.id)?.reviews||[];
 const status:Record<string,RequirementItem['status']>={submitted:'Submitted',under_review:'Under Review',approved:'Approved',needs_revision:'Needs Revision',rejected:'Rejected'};
 return {name:liveRequirementTitle(row),description:row.description,status:status[row.submission?.status||'']||'Not Submitted',
  fileName:row.submission?.documentId?name:null,
  file:row.submission?.documentId?{url:`intrack-private-document:${row.submission.documentId}`,name,type:row.submission.mimeType||undefined,backendDocumentId:row.submission.documentId,backendRole:'student'}:null,
  remarks:reviews.at(-1)?.remarks||'',submittedAt:row.submission?.submittedAt};
}
export function resolveStudentRequirement(rows:LiveRequirement[],enrollmentId:string|undefined,stage:RequirementStage,name:string):LiveRequirement {
 if(!enrollmentId)throw new Error('Join your adviser’s class from the dashboard and wait for enrollment approval before submitting requirements.');
 const matches=rows.filter(r=>r.enrollmentId===enrollmentId&&liveRequirementStage(r)===stage&&requirementChecklistKey(liveRequirementTitle(r))===requirementChecklistKey(name));
 if(matches.length!==1)throw new Error(matches.length?'Multiple assigned requirements match this item. Ask your coordinator to check the requirement configuration.':'This checklist item has not been assigned to your enrollment. Ask your coordinator to configure it before uploading.');
 return matches[0];
}
function assertSubmissionAvailable(row:LiveRequirement,physical:boolean) {
 if(row.outcome!=='active'||row.waived||!row.allowedStages.includes(row.lifecycle))throw new Error('This requirement is not open for submission in your current OJT stage.');
 if(physical?row.evidenceType!=='staff_verification':!['file','moa'].includes(row.evidenceType))throw new Error(physical?'This item is not configured for physical verification.':`This item uses the ${row.evidenceType} workflow. Submit it through its dedicated module.`);
 if(row.submission&&!['needs_revision','rejected','withdrawn'].includes(row.submission.status)&&!(row.evidenceType==='moa'&&row.submission.status==='approved'))throw new Error('This submission is already awaiting review or approved. A revision request is required before replacing it.');
}
type ActionDependencies={
 list:()=>Promise<LiveRequirement[]>;
 upload:typeof uploadLiveRequirement;
 physical:(id:string,payload:Record<string,unknown>)=>Promise<unknown>;
 storage:Pick<Storage,'getItem'|'setItem'|'removeItem'>;
};
export function createStudentRequirementActions(profileId:string,enrollmentId:string|undefined,onSaved:()=>void,
 dependencies?:ActionDependencies) {
 const deps=dependencies||{list:()=>listLiveRequirements('student'),upload:uploadLiveRequirement,
  physical:(command_id:string,payload:Record<string,unknown>)=>backendRpc('intrack_submit_physical_requirement',{command_id,payload}),storage:localStorage};
 let busy=false;
 const run=async(action:()=>Promise<void>)=>{
  if(busy)throw new Error('An upload is already in progress. Please wait.');busy=true;
  try{await action();onSaved();}finally{busy=false;}
 };
 return {
  upload:async(stage:RequirementStage,name:string,file:File)=>run(async()=>{
   const row=resolveStudentRequirement(await deps.list(),enrollmentId,stage,name);
   const key=`intrack-local-upload:${profileId}:${row.id}`;
   let pending:PendingRequirementUpload|null=null;
   try{pending=JSON.parse(deps.storage.getItem(key)||'null');}catch{/* Recreate only malformed local metadata. */}
   // Preserve the original operation on a retry, including a lost commit response.
   if(pending&&(pending.payload?.requirementId!==row.id||pending.payload?.enrollmentId!==row.enrollmentId))throw new Error('Pending upload does not match your enrollment. Sign out and sign in again.');
   if(pending?.expiresAt&&Date.parse(pending.expiresAt)<=Date.now()&&row.submission?.documentId!==pending.documentId)pending=null;
   if(!pending||pending.name!==file.name||pending.bytes!==file.size||pending.mimeType!==file.type){
    assertSubmissionAvailable(row,false);pending=newRequirementUpload(row,file);
   }
   const save=(next:PendingRequirementUpload)=>deps.storage.setItem(key,JSON.stringify(next));
   save(pending);
   try { await deps.upload(pending,file,save); }
   catch(error) {
    // These definitive failures cannot have committed this submission. Keep
    // operation IDs for transport/unknown failures so retries remain idempotent.
    if(['40001','FILE_INVALID'].includes((error as {code?:string}).code||''))deps.storage.removeItem(key);
    throw error;
   }
   deps.storage.removeItem(key);
  }),
  physical:async(stage:RequirementStage,name:string,note:string)=>run(async()=>{
   const row=resolveStudentRequirement(await deps.list(),enrollmentId,stage,name);
   const key=`intrack-local-upload:${profileId}:${row.id}:physical`;
   let pending:{commandId:string;payload:Record<string,unknown>}|null=null;
   try{pending=JSON.parse(deps.storage.getItem(key)||'null');}catch{}
   if(!pending||pending.payload.note!==note){assertSubmissionAvailable(row,true);pending={commandId:crypto.randomUUID(),payload:{...requirementPayload(row),note}};}
   if(pending.payload.requirementId!==row.id||pending.payload.enrollmentId!==row.enrollmentId)throw new Error('Pending confirmation does not match your enrollment.');
   deps.storage.setItem(key,JSON.stringify(pending));
   await deps.physical(pending.commandId,pending.payload);deps.storage.removeItem(key);
  }),
 };
}
