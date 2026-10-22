import {backendRpc} from './backendGateway.ts';
import {readMyProtectedIdentity} from './protectedIdentity.ts';
import {requirementChecklistNames} from '../domain/requirementChecklist.ts';
export type EnrollmentStaffRole='coordinator'|'adviser';
export type PolicyRequirement={code:string;title:string;description?:string;stage:string;evidenceType:string;reviewer:string;mandatory:boolean;allowedStages:string[];recurrence:{kind:string;dueAt?:string|null};deadline?:string};
export interface EnrollmentConfiguration {
 programs:{id:string;code:string}[];
 terms:{id:string;academic_year:string;semester:string;starts_on:string;ends_on:string}[];
 policies:{id:string;programId:string;component:number;version:number;yearLevel:number;semester:string;requiredMinutes:number;published:boolean;attendanceConfirmed:boolean;requirements:PolicyRequirement[]}[];
 classes:{id:string;programId:string;termId:string;policyId:string;section:string;adviserId:string|null;adviserName:string|null;studentCount:number}[];
 students:{id:string;name:string;studentNumber:string;section:string;status:string;enrollmentId:string|null;policyId:string|null;outcome:string|null;adviserId:string|null}[];
}
export type ProgramChecklist={programId:string;revision:number;requirements:PolicyRequirement[];attendancePolicy:{confirmed:boolean;dailyCapMinutes?:number;maxSessionMinutes?:number;maxAccuracyMeters?:number;maxCoordinateAgeSeconds?:number}};
export const readProgramChecklist=(role:EnrollmentStaffRole,programId:string)=>backendRpc<ProgramChecklist>('intrack_program_checklist',{actor_role:role,program_id:programId});
export const termLabel=(semester:string)=>({1:'First semester',2:'Second semester',summer:'Summer term'}[semester]||semester);
export const fixedEvidenceReviewer=(evidence:string):string|undefined=>({moa:'coordinator',dtr:'adviser',journal:'adviser',portfolio:'both'} as Record<string,string>)[evidence];
export function proposedPracticumRequirements():PolicyRequirement[]{
 return (['pre','during','post'] as const).flatMap(stage=>requirementChecklistNames[stage].map((title,index)=>({
  code:`${stage.toUpperCase()}-${String(index+1).padStart(2,'0')}`,title,stage,
  evidenceType:title.includes('(MOA)')?'moa':['Practicum kit (expanded envelope)','Attendance OJT Orientation'].includes(title)?'staff_verification':title==='Daily Time Record'?'dtr':title.startsWith('Weekly Journal')?'journal':'file',
  reviewer:'',mandatory:true,allowedStages:[{pre:'pre_ojt',during:'during_ojt',post:'post_ojt'}[stage]],recurrence:{kind:'once'},deadline:'',
 })));
}
export function publicationRequirements(rows:PolicyRequirement[]):PolicyRequirement[]{
 if(!rows.length||rows.some(r=>!r.title.trim()||!r.reviewer||!r.allowedStages.length))throw new Error('Choose a reviewer and submission window for every requirement.');
 if(rows.some(r=>fixedEvidenceReviewer(r.evidenceType)&&r.reviewer!==fixedEvidenceReviewer(r.evidenceType)))throw new Error('MOA documents require coordinator routing, system DTR/journals require adviser review, and system portfolios require both reviewers.');
 return rows.map(({deadline,...row})=>({...row,title:row.title.trim(),recurrence:{kind:'once',dueAt:deadline?new Date(`${deadline}T23:59:59+08:00`).toISOString():null}}));
}
export const readEnrollmentConfiguration=(role:EnrollmentStaffRole,filters:Record<string,string>={})=>backendRpc<EnrollmentConfiguration>('intrack_enrollment_configuration',{actor_role:role,filters});
/** Staff scope and MFA are checked again by PostgreSQL; no supplied actor grants authority. */
export async function enrollmentConfigurationCommand(actor:string,role:EnrollmentStaffRole,name:string,payload:Record<string,unknown>){
 const identity=await readMyProtectedIdentity();
 if(identity.state!=='ready'||identity.profile.id!==actor||!identity.usableRoles.includes(role))throw new Error('Your staff session changed. Sign in again.');
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify({name,payload,role})));
 const key=`intrack-enrollment-command:${actor}:${Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')}`;
 let id=localStorage.getItem(key);if(!id){id=crypto.randomUUID();localStorage.setItem(key,id);}
 const result=await backendRpc<any>(name,{command_id:id,...(name==='intrack_publish_practicum_policy'?{}:{actor_role:role}),payload});
 localStorage.removeItem(key);return result;
}
