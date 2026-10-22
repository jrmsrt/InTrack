import {backendRpc,administrationDirectory,inviteAccount,assertCoordinatorActor} from './backendGateway.ts';
import type {MasterlistStudent} from '../components/forms/MasterlistImportDialog';
export interface RosterProgram {id:string;code:string;studentDomains:string[];staffDomains:string[]}
export interface CoordinatorRosterRow {
 id:string;eligibleId:string|null;profileId:string|null;membershipId:string|null;programId:string;programCode:string;
 name:string;studentNumber:string|null;email:string|null;section:string|null;phone:string;sections:string[];detailsRevision:number;
 profileStatus:string|null;activated:boolean;accessEnabled:boolean;membershipActive:boolean;membershipRevision:number|null;
 whitelisted:boolean;enrollmentId:string|null;enrollmentRevision:number|null;stage:string|null;adviserId:string|null;adviserName:string|null;workload:number;
 pending:{commandId:string;payload:Record<string,unknown>}|null;provisioningPending:boolean;ownedReservation:boolean;invitationState:string|null;
}
export interface CoordinatorRoster {items:CoordinatorRosterRow[];programs:RosterProgram[];sections:string[];advisers:{id:string;name:string;programId:string}[];page:number;total:number;hasMore:boolean}
export const getCoordinatorRoster=(role:'student'|'adviser',filters:Record<string,unknown>={})=>backendRpc<CoordinatorRoster>('intrack_coordinator_roster',{account_role:role,filters});
export interface CoordinatorWorkflowDependencies {
 assertActor:typeof assertCoordinatorActor;rpc:typeof backendRpc;directory:typeof administrationDirectory;roster:typeof getCoordinatorRoster;invite:typeof inviteAccount;
}
const workflowDependencies:CoordinatorWorkflowDependencies={assertActor:assertCoordinatorActor,rpc:backendRpc,directory:administrationDirectory,roster:getCoordinatorRoster,invite:inviteAccount};
export function masterlistRows(records:MasterlistStudent[]) {
 if(!records.length||records.length>500)throw new Error('Import between 1 and 500 students at a time.');
 return records.map(record=>({studentNumber:record.studentNumber.trim().toUpperCase(),name:record.name.trim(),email:record.email.trim().toLowerCase(),programCode:record.program.split('—')[0].trim().toUpperCase(),section:record.section.trim()}));
}
async function operationKey(actor:string,operation:string,args:unknown){
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(args)));
 return `intrack-coordinator-command:${actor}:${operation}:${Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')}`;
}
/** No secret or actor identity is sent as authority; the server derives its caller. */
export async function coordinatorCommand(actor:string,name:string,args:Record<string,unknown>){
 await assertCoordinatorActor(actor);
 const key=await operationKey(actor,name,args);let id=localStorage.getItem(key);
 if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
 const result=await backendRpc(name,{command_id:id,...args});localStorage.removeItem(key);return result;
}
export async function whitelistRosterStudent(actor:string,row:CoordinatorRosterRow,invite=inviteAccount){
 if(!row.eligibleId)throw new Error('An approved masterlist record is required.');
 if(row.provisioningPending&&!row.ownedReservation)throw new Error('The original coordinator must reconcile the pending whitelist.');
 await invite(actor,row.pending?.payload||{role:'student',eligibleStudentId:row.eligibleId},row.pending||undefined);
}
export async function importAndWhitelist(actor:string,records:MasterlistStudent[],dependencies=workflowDependencies){
 await dependencies.assertActor(actor);
 const rows=masterlistRows(records),key=await operationKey(actor,'masterlist',rows);
 let pending:{commandId:string;token:string}|null=null;
 try{pending=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 if(!pending){
  const preview=await dependencies.rpc<{validationToken?:string;issues:{row:number;message:string}[]}>('intrack_preview_masterlist',{rows});
  if(!preview.validationToken||preview.issues?.length)throw new Error(preview.issues?.slice(0,3).map(issue=>`Row ${issue.row}: ${issue.message}`).join('; ')||'The masterlist could not be validated.');
  pending={commandId:crypto.randomUUID(),token:preview.validationToken};localStorage.setItem(key,JSON.stringify(pending));
 }
 try{await dependencies.rpc('intrack_commit_masterlist',{command_id:pending.commandId,validation_token:pending.token});}
 catch(error){if(error instanceof Error&&/Preview expired or consumed/.test(error.message))localStorage.removeItem(key);throw error;}
 localStorage.removeItem(key);
 const directory=await dependencies.directory();let imported=0;
 for(const row of rows){
  const eligible=directory.eligibleStudents.find(item=>item.studentNumber===row.studentNumber&&item.email===row.email&&directory.programs.some(p=>p.id===item.programId&&p.code===row.programCode));
  if(!eligible)throw new Error(`Masterlist saved, but only ${imported} of ${rows.length} accounts confirmed. Refresh the roster and retry pending users.`);
  try{
   if(eligible.profileId){
    const roster=await dependencies.roster('student',{search:row.studentNumber,program:row.programCode});
    const saved=roster.items.find(item=>item.eligibleId===eligible.id);
    if(!saved)throw new Error('Refresh and check the saved student record.');
    if(saved.whitelisted&&saved.accessEnabled){imported++;continue;}
    if(saved.membershipId&&!saved.membershipActive)throw new Error('Restore the existing disabled membership explicitly.');
    await whitelistRosterStudent(actor,saved,dependencies.invite);
   }else await dependencies.invite(actor,{role:'student',eligibleStudentId:eligible.id});
   imported++;
  }
  catch(error){throw new Error(`Masterlist saved; ${imported} of ${rows.length} accounts confirmed. ${error instanceof Error?error.message:'Refresh the roster and retry pending users.'}`);}
 }
 return {imported,skipped:0};
}
export async function saveAdviser(actor:string,input:{name:string;email:string;programId:string;phone:string;section:string}){
 const sections=Array.from(new Set(input.section.split(',').map(value=>value.trim()).filter(Boolean)));
 const email=input.email.trim().toLowerCase();
 let matches=await getCoordinatorRoster('adviser',{search:email});
 let row=matches.items.find(item=>item.email?.toLowerCase()===email&&item.programId===input.programId);
 if(row&&row.name!==input.name.trim())throw new Error('This email belongs to a saved adviser with a different name. Correct the existing identity explicitly.');
 if(row?.membershipId&&!row.membershipActive)throw new Error('Restore the existing disabled adviser membership explicitly.');
 if(!row?.whitelisted||!row.accessEnabled){
  if(row?.provisioningPending&&!row.ownedReservation)throw new Error('The original coordinator must reconcile the pending whitelist.');
  await inviteAccount(actor,row?.pending?.payload||{role:'adviser',name:input.name.trim(),email,programId:input.programId},row?.pending||undefined);
  matches=await getCoordinatorRoster('adviser',{search:email});
  row=matches.items.find(item=>item.email?.toLowerCase()===email&&item.programId===input.programId);
 }
 if(!row?.membershipId)throw new Error('Account whitelisted, but adviser details are pending. Refresh and retry the same email.');
 if(row.phone===input.phone.trim()&&JSON.stringify(row.sections)===JSON.stringify(sections))return;
 await coordinatorCommand(actor,'intrack_save_adviser_roster_details',{membership_id:row.membershipId,expected_revision:row.detailsRevision,phone:input.phone.trim(),sections});
}
