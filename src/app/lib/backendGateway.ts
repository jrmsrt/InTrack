import {getSupabaseClient} from './supabaseClient.ts';
import type {IdentityRole} from './protectedIdentity';
import {readMyProtectedIdentity} from './protectedIdentity.ts';
export async function assertCoordinatorActor(profileId:string){
 const identity=await readMyProtectedIdentity();
 if(identity.state!=='ready'||identity.profile.id!==profileId||!identity.usableRoles.includes('coordinator'))throw new Error('Your coordinator session changed. Sign in again before saving.');
}
export interface EnrollmentProjection {
  id:string;studentId:string;studentName:string;programId:string;programCode:string;policyVersionId:string;
  component:number;termId:string;lifecycle:string;outcome:string;revision:number;requiredMinutes:number;creditedMinutes:number;remainingMinutes:number;
  adviserId:string|null;clearance:string;moaStatus:string;moaVersionId:string|null;openSessions:number;
}
export interface AdministrationDirectory {
  programs:{id:string;code:string;studentDomains:string[];staffDomains:string[]}[];
  policies:{id:string;programId:string;component:number;version:number;requiredMinutes:number;yearLevel:number;semester:string;published:boolean}[];
  terms:{id:string;academic_year:string;semester:string;starts_on:string;ends_on:string}[];
  memberships:{id:string;profileId:string;name:string;programId:string;role:IdentityRole;active:boolean;revision:number}[];
  eligibleStudents:{id:string;name:string;studentNumber:string;email:string;programId:string;section:string;profileId:string|null}[];
}
export async function backendRpc<T=unknown>(name:string,args:Record<string,unknown>={}):Promise<T>{
  const {data,error}=await getSupabaseClient().rpc(name,args);if(error)throw new Error(error.message);return data as T;
}
export const listEnrollments=(role:IdentityRole)=>backendRpc<EnrollmentProjection[]>('intrack_list_enrollments',{actor_role:role});
export const administrationDirectory=()=>backendRpc<AdministrationDirectory>('intrack_administration_directory');
export async function inviteAccount(profileId:string,payload:Record<string,unknown>,original?:{commandId:string;payload:Record<string,unknown>}):Promise<void>{
  await assertCoordinatorActor(profileId);
  const target=payload.role==='student'?payload.eligibleStudentId:String(payload.email||'').trim().toLowerCase();
  const key=`intrack-local-invitation:${profileId}:${payload.role}:${target}`;
  let operation:{commandId:string;payload:Record<string,unknown>}|null=null;
  try{operation=JSON.parse(localStorage.getItem(key)||'null');}catch{}
  if(operation&&JSON.stringify(operation.payload)!==JSON.stringify(payload))throw new Error('Pending invitation parameters changed. Reconcile the original operation before starting another.');
  if(!operation)operation=original||{commandId:crypto.randomUUID(),payload};
  localStorage.setItem(key,JSON.stringify(operation));
  // Persist identity/retry data only. Never cache the temporary password.
  const {error}=await getSupabaseClient().functions.invoke('account-invitations',{body:{...operation,mode:'whitelist'}});
  if(error){let message='Invitation unavailable. Pending operation is preserved.';const response=(error as {context?:Response}).context;
    if(response){try{message=(await response.json()).error||message;}catch{}}throw new Error(message);}
  localStorage.removeItem(key);
}
