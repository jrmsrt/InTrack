import {createRequirementChecklist} from '../domain/requirementChecklist.ts';
import type {StudentOJTProfile} from '../context/OJTContext';
import type {EnrollmentProjection} from './backendGateway';
export type StudentPortalProfile={id:string;name:string;studentNumber:string|null;email:string;section:string;programs:{id:string;code:string}[];policies:{programId:string;component:number;requiredMinutes:number;yearLevel:number}[];advisers:{id:string;name:string}[];placements:{enrollmentId:string;companyId:string;companyName:string}[]};
/** An account without an enrollment is shown as awaiting deployment, never cleared. */
export function studentAccountProjection(profile:StudentPortalProfile,enrollment?:EnrollmentProjection):StudentOJTProfile{
 const program=profile.programs.find(p=>p.id===enrollment?.programId)||profile.programs[0];
 const year=Number(profile.section.split('-')[0]);
 const policies=profile.policies.filter(p=>p.programId===program?.id);
 const curriculum=policies.find(p=>p.yearLevel===year)||policies.find(p=>p.component===1);
 const placement=profile.placements.find(p=>p.enrollmentId===enrollment?.id);
 const stage={pre_ojt:'Stage 1: Pre-OJT',during_ojt:'Stage 2: During OJT',post_ojt:'Stage 3: Post-OJT',portfolio:'Stage 4: Portfolio Completion',completed:'Stage 4: Portfolio Completion'} as const;
 return {studentId:profile.id,studentNumber:profile.studentNumber||'',name:profile.name,email:profile.email,program:program?.code||'',section:profile.section,
  adviserId:enrollment?.adviserId||'',adviserName:profile.advisers.find(a=>a.id===enrollment?.adviserId)?.name||'Not assigned',companyId:placement?.companyId||'',companyName:placement?.companyName||'Not assigned',stage:enrollment?stage[enrollment.lifecycle as keyof typeof stage]||stage.pre_ojt:stage.pre_ojt,
  requiredHours:(enrollment?.requiredMinutes??curriculum?.requiredMinutes??0)/60,totalHoursRendered:(enrollment?.creditedMinutes||0)/60,
  preOJTRequirements:createRequirementChecklist('pre'),duringOJTRequirements:createRequirementChecklist('during'),postOJTRequirements:createRequirementChecklist('post'),moaState:{status:(enrollment?.moaStatus||'NO MOA') as StudentOJTProfile['moaState']['status'],fileName:null,remarks:'',timeline:[]},attendanceHistory:[],dtrHistory:[],dailyTasks:[],weeklyJournals:[],midtermEvaluation:null,finalEvaluation:null,portfolioApproved:false,portfolioSubmitted:false,portfolioRemarks:''};
}
