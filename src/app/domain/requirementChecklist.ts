import type {RequirementItem,RequirementStage} from '../context/OJTContext';
import {addedPreOJTRequirements,addedPostOJTRequirements,portfolioContents} from './portfolioContents.ts';

/** Original module contents are a display catalog, separate from submissions and approvals. */
export const requirementChecklistNames:Record<RequirementStage,readonly string[]>={
 pre:[
  'Certificate of Registration (COR)','Resume','Notarize Memorandum of Agreement (MOA)',
  'Endorsement/Recommendation Letter','Notarized Waiver/Consent Form','Notarized Internship Agreement',
  'Student Practicum Plan','Medical Certificate','Good Moral Certificate','Certificate of Insurance',
  'Certificate (Sexual Harassment and Work Ethics)','SIS grades (1st year to 3rd year)',
  'Practicum kit (expanded envelope)','Attendance OJT Orientation',...addedPreOJTRequirements,
 ],
 during:['Daily Time Record','Self-Reflection',...Array.from({length:12},(_,i)=>`Weekly Journal (Week ${i+1})`),...Array.from({length:12},(_,i)=>`Pictures / Documentation (Week ${i+1})`)],
 post:['Student Performance Evaluation','HTE Supervisor’s Evaluation','HTE Evaluation','Certificate of Completion',...addedPostOJTRequirements],
};
export function createRequirementChecklist(stage:RequirementStage):RequirementItem[]{
 return requirementChecklistNames[stage].map(name=>({name,status:'Not Submitted',fileName:null,remarks:''}));
}
const normalized=(value:string)=>value.normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
export function requirementChecklistKey(name:string):string {
 const value=normalized(name);
 const catalog=portfolioContents.find(item=>normalized(item.title)===value||normalized(item.existingRequirement||'')===value);
 return normalized(catalog?.existingRequirement||name);
}
/** Keep all original rows and additional saved requirements, without fabricating progress. */
export function mergeRequirementChecklist(stage:RequirementStage,saved:readonly RequirementItem[]):RequirementItem[]{
 const used=new Set<number>();
 const rows=createRequirementChecklist(stage).map(original=>{
  let index=saved.findIndex((item,i)=>!used.has(i)&&normalized(item.name)===normalized(original.name));
  if(index<0)index=saved.findIndex((item,i)=>!used.has(i)&&requirementChecklistKey(item.name)===requirementChecklistKey(original.name));
  if(index<0)return original;
  used.add(index);return {...saved[index],name:original.name};
 });
 return [...rows,...saved.filter((_,index)=>!used.has(index)).map(item=>({...item}))];
}
