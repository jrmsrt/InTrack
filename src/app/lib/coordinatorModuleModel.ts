import type {AdministrationDirectory,EnrollmentProjection} from './backendGateway.ts';
import type {LiveRequirement} from './requirementGateway.ts';
import {liveRequirementTitle,liveRequirementStage} from './studentRequirementActions.ts';
import type {Announcement,StudentOJTProfile,RequirementItem,Template} from '../context/OJTContext';
import type {MoaStatus} from '../domain/contracts';
type Notification={id:string;read_at:string|null;created_at:string;content:{kind:string}};
type SavedPortfolio={id:string;is_current:boolean;status:string;revision:number;adviser_approved_at:string|null;coordinator_approved_at:string|null;submitted_at?:string};
export type CoordinatorModuleSnapshot={enrollments:EnrollmentProjection[];requirements:LiveRequirement[];directory:AdministrationDirectory;portfolios:Record<string,SavedPortfolio[]>;notifications:Notification[];announcements:Announcement[];templates:Template[]};
const statusNames:Record<string,RequirementItem['status']>={submitted:'Submitted',under_review:'Under Review',approved:'Approved',needs_revision:'Needs Revision',rejected:'Rejected'};
const stageNames={pre_ojt:'Stage 1: Pre-OJT',during_ojt:'Stage 2: During OJT',post_ojt:'Stage 3: Post-OJT',portfolio:'Stage 4: Portfolio Completion',completed:'Stage 4: Portfolio Completion'} as const;
export function projectCoordinatorStudents(snapshot:CoordinatorModuleSnapshot):StudentOJTProfile[]{
 return snapshot.enrollments.map(e=>{
  const eligible=snapshot.directory.eligibleStudents.find(s=>s.profileId===e.studentId);
  const adviser=snapshot.directory.memberships.find(m=>m.profileId===e.adviserId);
  const requirements=snapshot.requirements.filter(r=>r.enrollmentId===e.id);
  const item=(r:LiveRequirement):RequirementItem=>{const history=r.history.find(h=>h.id===r.submission?.id);const reviews=history?.reviews||[];const adviserReview=reviews.filter(v=>v.role==='adviser').at(-1),coordinatorReview=reviews.filter(v=>v.role==='coordinator').at(-1);
   return {name:liveRequirementTitle(r),description:r.description,status:adviserReview?.decision==='approved'?'Approved':statusNames[r.submission?.status||'']||'Not Submitted',fileName:r.submission?.documentId?(r.submission.documentName||r.title):null,file:r.submission?.documentId?{url:'intrack-private-document:'+r.submission.documentId,name:r.submission.documentName||r.title,type:r.submission.mimeType||undefined,backendDocumentId:r.submission.documentId}:null,remarks:adviserReview?.remarks||'',submittedAt:r.submission?.submittedAt,coordinatorStatus:coordinatorReview?.decision==='approved'?'Verified':coordinatorReview?.decision==='needs_revision'||coordinatorReview?.decision==='rejected'?'Needs Attention':'Pending',coordinatorRemarks:coordinatorReview?.remarks||'',coordinatorReviewedAt:coordinatorReview?.at,reviewHistory:reviews.map(v=>({role:v.role==='coordinator'?'Coordinator':'Adviser',action:v.decision,remarks:v.remarks,timestamp:v.at}))};};
  const forStage=(stage:string)=>requirements.filter(r=>r.evidenceType!=='moa'&&liveRequirementStage(r)===({pre_ojt:'pre',during_ojt:'during',post_ojt:'post'} as Record<string,string>)[stage]).map(item);
  const moa=requirements.find(r=>r.evidenceType==='moa'),moaItem=moa?item(moa):null;
  const portfolio=snapshot.portfolios[e.id]?.find(p=>p.is_current);
  return {studentId:e.id,studentNumber:eligible?.studentNumber||'',name:e.studentName,email:eligible?.email||'',program:e.programCode,section:eligible?.section||'',adviserId:e.adviserId||'',adviserName:adviser?.name||'',companyId:'',companyName:'',stage:stageNames[e.lifecycle as keyof typeof stageNames],totalHoursRendered:e.creditedMinutes/60,requiredHours:e.requiredMinutes/60,
   preOJTRequirements:forStage('pre_ojt'),duringOJTRequirements:forStage('during_ojt'),postOJTRequirements:forStage('post_ojt'),moaState:{status:e.moaStatus as MoaStatus,fileName:moaItem?.fileName||null,file:moaItem?.file||null,remarks:'',timeline:[],submittedAt:moaItem?.submittedAt},attendanceHistory:[],dtrHistory:[],dailyTasks:[],weeklyJournals:[],midtermEvaluation:null,finalEvaluation:null,portfolioApproved:!!portfolio?.adviser_approved_at,portfolioSubmitted:!!portfolio&&portfolio.status!=='draft',portfolioRemarks:'',portfolioSubmittedAt:portfolio?.submitted_at,portfolioAdviserReviewedAt:portfolio?.adviser_approved_at||undefined,coordinatorPortfolioStatus:portfolio?.coordinator_approved_at?'Approved':portfolio?.status==='needs_revision'?'Needs Revision':'Pending',coordinatorPortfolioReviewedAt:portfolio?.coordinator_approved_at||undefined};
 });
}
