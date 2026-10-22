import {createContext,useContext,useEffect,useState} from 'react';
import {useCoordinatorIdentity} from '../components/shared/CoordinatorPortal';
import {administrationDirectory,backendRpc,listEnrollments,type AdministrationDirectory,type EnrollmentProjection} from '../lib/backendGateway';
import {coordinatorCommand} from '../lib/coordinatorGateway';
import {listLiveRequirements,requirementPayload,type LiveRequirement} from '../lib/requirementGateway';
import type {Announcement,Company,HTEPartner,StudentOJTProfile,RequirementItem,RequirementStage,CoordinatorReviewStatus,Template} from './OJTContext';
import type {MoaStatus} from '../domain/contracts';

import {liveRequirementTitle,liveRequirementStage} from '../lib/studentRequirementActions';
import {projectCoordinatorStudents,type CoordinatorModuleSnapshot} from '../lib/coordinatorModuleModel';
const Context=createContext<ReturnType<typeof useData>|null>(null);
function useData(){
 const identity=useCoordinatorIdentity();const [saved,setSaved]=useState<CoordinatorModuleSnapshot|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[reload,setReload]=useState(0),[busy,setBusy]=useState(false);
 const scope=identity.memberships.filter(m=>m.role==='coordinator').map(m=>m.programId).sort().join(',');
 useEffect(()=>{let alive=true;setLoading(true);setSaved(null);setError('');
  (async()=>{const [enrollments,requirements,directory,notice,ann]=await Promise.all([listEnrollments('coordinator'),listLiveRequirements('coordinator'),administrationDirectory(),backendRpc<{items:CoordinatorModuleSnapshot['notifications']}>('intrack_list_notifications',{actor_role:'coordinator'}),backendRpc<{items:any[]}>('intrack_list_announcements',{actor_role:'coordinator'})]);
   const assessments=await Promise.all(enrollments.map(async e=>[e.id,(await backendRpc<{portfolios:CoordinatorModuleSnapshot['portfolios'][string]}>('intrack_list_assessments',{enrollment_id:e.id,actor_role:'coordinator'})).portfolios] as const));
   const [versions,links]=await Promise.all([Promise.all(directory.programs.map(async p=>(await backendRpc<any[]>('intrack_list_templates',{program_code:p.code,actor_role:'coordinator',page_offset:0})).map(t=>({...t,programId:p.id,programCode:p.code})))).then(rows=>rows.flat()),backendRpc<Template[]>('intrack_list_template_links',{actor_role:'coordinator'})]);
   const categories:Record<string,Template['category']>={pre:'Pre-OJT',during:'During-OJT',post:'Post-OJT',portfolio:'Portfolio',evaluation:'Evaluation'};
   if(alive)setSaved({enrollments,requirements,directory,portfolios:Object.fromEntries(assessments),notifications:notice.items,announcements:ann.items.map(a=>({id:a.id,title:a.title,message:a.body,priority:a.priority||'Not recorded',targetRole:a.audience_role||'all',author:directory.memberships.find(m=>m.profileId===a.author_id)?.name||'',publishDate:new Date(a.published_at).toLocaleDateString()})),templates:[...links,...versions.map(t=>({id:t.id,programId:t.programId,programCode:t.programCode,name:t.title,category:categories[t.stage],description:'',linkUrl:'',status:t.status==='published'?'Published':'Disabled',lastUpdated:'',backendTemplate:true}))]});
  })().catch(()=>{if(alive)setError('Unable to load saved module records. Please retry.');}).finally(()=>{if(alive)setLoading(false);});return()=>{alive=false;};
 },[identity.profile.id,scope,reload]);
 const unsupported=async(..._args:unknown[])=>{throw new Error('This control is not connected to the backend yet. No changes were saved.');};
 const command=async(name:string,args:Record<string,unknown>)=>{setBusy(true);try{await coordinatorCommand(identity.profile.id,name,args);setReload(v=>v+1);}finally{setBusy(false);}};
 const row=(studentId:string,name?:string,stage?:RequirementStage)=>{const matches=saved?.requirements.filter(r=>r.enrollmentId===studentId&&(!stage||liveRequirementStage(r)===stage)&&(name?liveRequirementTitle(r)===name:r.evidenceType==='moa'))||[];if(matches.length!==1)throw new Error('A single configured requirement is required for this enrollment.');return matches[0];};
 return {loading,error,busy,refresh:()=>setReload(v=>v+1),notifications:saved?.notifications||[],enrollments:saved?.enrollments||[],students:saved?projectCoordinatorStudents(saved):[],companies:[] as Company[],htePartners:[] as HTEPartner[],templates:saved?.templates||[],announcements:saved?.announcements||[],directory:saved?.directory,
  systemSettings:{academicYear:saved?.directory.terms.length===1?saved.directory.terms[0].academic_year:'',semester:saved?.directory.terms.length===1?saved.directory.terms[0].semester:'',requiredHours:'' as string|number,defaultRadius:'' as string|number},
  addCompany:unsupported,addHTEPartner:unsupported,updateHTEPartner:unsupported,async addTemplate(template:Omit<Template,'id'|'lastUpdated'>){
   if(!template.programId)throw new Error('Select a program.');
   await command('intrack_save_template_link',{payload:template});
  },async updateTemplate(id:string,updates:Partial<Template>){
   const previous=saved?.templates.find(t=>t.id===id);
   if(!previous||previous.backendTemplate)throw new Error('Private file versions use the private template workflow.');
   await command('intrack_save_template_link',{payload:{...previous,...updates,id,expectedRevision:previous.revision}});
  },updateSystemSettings:unsupported,resetAllDemoData:()=>{throw new Error('Mock reset is unavailable for real database records.');},deleteAnnouncement:unsupported,
  async addAnnouncement(announcement:Omit<Announcement,'id'|'publishDate'>){if(!saved||saved.directory.programs.length!==1)throw new Error('Select an approved program using the backend administration workspace before publishing.');if(announcement.priority!=='Info')throw new Error('Priority metadata is not connected yet. No announcement was published.');await command('intrack_publish_announcement',{payload:{programId:saved.directory.programs[0].id,title:announcement.title,body:announcement.message,role:announcement.targetRole==='all'?null:announcement.targetRole}});},
  async reviewMOA(studentId:string,status:MoaStatus,remarks:string){const r=row(studentId);await command('intrack_route_moa',{payload:{...requirementPayload(r),submissionId:status==='NO MOA'?null:r.submission?.id,status,reason:remarks,evidenceNote:remarks}});return {success:true};},
  async reviewCoordinatorRequirement(studentId:string,_stage:RequirementStage,name:string,status:CoordinatorReviewStatus,remarks:string){const r=row(studentId,name,_stage);if(r.reviewer==='adviser')throw new Error('This requirement has no configured coordinator approval step.');await command('intrack_requirement_command',{action:status==='Verified'?'approve':'request_revision',payload:{...requirementPayload(r),role:'coordinator',remarks}});},
  async reviewCoordinatorPortfolio(studentId:string,status:'Approved'|'Needs Revision',remarks:string){const e=saved?.enrollments.find(e=>e.id===studentId),p=saved?.portfolios[studentId]?.find(p=>p.is_current);if(!e||!p)throw new Error('No current portfolio is available.');if(status==='Approved')throw new Error('Final approval requires item-by-item portfolio verification in the protected review workflow. No approval was recorded.');await command('intrack_portfolio_command',{payload:{enrollmentId:e.id,expectedEnrollmentRevision:e.revision,artifactId:p.id,expectedArtifactRevision:p.revision,role:'coordinator',action:'request_revision',reason:remarks}});},
  async exportDatabase(){const data=await coordinatorCommand(identity.profile.id,'intrack_export_enrollments',{actor_role:'coordinator',search_text:'',page_offset:0}) as {items:Record<string,unknown>[]};return data.items;}
 };
}
export function CoordinatorModuleDataProvider({children}:{children:React.ReactNode}){const value=useData();return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useCoordinatorModuleData(){const value=useContext(Context);if(!value)throw new Error('Protected coordinator module data required.');return value;}
