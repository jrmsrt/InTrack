import {backendRpc,listEnrollments,type AdministrationDirectory} from './backendGateway.ts';
import {listLiveRequirements} from './requirementGateway.ts';
import {projectCoordinatorStudents} from './coordinatorModuleModel.ts';
import type {StudentOJTProfile} from '../context/OJTContext';
type Person={id:string;displayName:string};
const defaults={rpc:backendRpc,enrollments:()=>listEnrollments('adviser'),requirements:()=>listLiveRequirements('adviser')};
export async function loadAdviserPortalData(person:Person,path:string,deps=defaults){
 const [allEnrollments,allRequirements,administration,notices]=await Promise.all([deps.enrollments(),deps.requirements(),deps.rpc<any>('intrack_class_join_administration',{actor_role:'adviser'}),deps.rpc<any>('intrack_list_notifications',{actor_role:'adviser'})]);
 const enrollments=allEnrollments.filter(e=>e.adviserId===person.id),ids=new Set(enrollments.map(e=>e.id));
 const requirements=allRequirements.filter(r=>ids.has(r.enrollmentId));
 const classes=(administration.classes||[]).filter((c:any)=>c.adviserId===person.id);
 const rosters=(await Promise.all(classes.map((c:any)=>deps.rpc<any[]>('intrack_class_roster',{actor_role:'adviser',class_id:c.id})))).flat();
 const directory={programs:[],policies:[],terms:[],eligibleStudents:rosters.map(r=>({profileId:r.studentId,name:r.name,studentNumber:r.studentNumber||'',email:r.email||'',section:r.section})),memberships:[{profileId:person.id,name:person.displayName}]} as unknown as AdministrationDirectory;
 const academics:Record<string,any>={},dtrs:Record<string,any>={},attendance:Record<string,any>={},portfolios:Record<string,any>={};
 // Keep requests bounded, and load detailed artifacts only for relevant modules.
 for(let start=0;start<enrollments.length;start+=4)await Promise.all(enrollments.slice(start,start+4).map(async e=>{
  const academic=['/adviser/dashboard','/adviser/journals'].includes(path),attend=path==='/adviser/attendance',dtr=attend||path==='/adviser/review-requirements',assess=path==='/adviser/portfolio'||path==='/adviser/dashboard';
  const args={enrollment_id:e.id,actor_role:'adviser'};
  const [a,t,h,p]=await Promise.all([academic?deps.rpc<any>('intrack_list_academics',args):null,dtr?deps.rpc<any>('intrack_list_dtrs',args):null,attend?deps.rpc<any>('intrack_list_attendance',args):null,assess?deps.rpc<any>('intrack_list_assessments',args):null]);
  academics[e.id]=a;dtrs[e.id]=t;attendance[e.id]=h;portfolios[e.id]=p?.portfolios||[];
 }));
 const status:Record<string,string>={draft:'Draft',submitted:'Submitted',under_review:'Under Review',needs_revision:'Needs Revision',rejected:'Needs Revision',approved:'Approved'};
 const students=projectCoordinatorStudents({enrollments,requirements,directory,portfolios,notifications:[],announcements:[],templates:[]});
 for(const s of students){
  for(const item of [...s.preOJTRequirements,...s.duringOJTRequirements,...s.postOJTRequirements,s.moaState])if(item.file)item.file.backendRole='adviser';
  const a=academics[s.studentId];
  s.dailyTasks=(a?.tasks||[]).filter((t:any)=>t.is_current).map((t:any)=>({id:t.id,date:t.task_date,...t.content,status:status[t.status]||'Draft'}));
  s.weeklyJournals=(a?.journals||[]).filter((j:any)=>j.is_current).map((j:any,i:number)=>({id:j.id,weekNumber:j.content.weekNumber||i+1,startDate:j.starts_on,endDate:j.ends_on,tasks:s.dailyTasks.filter(t=>t.date>=j.starts_on&&t.date<=j.ends_on),reflection:j.content.reflection||'',problems:j.content.problems||'',totalHours:0,status:status[j.status]||'Draft',submittedAt:j.submitted_at,remarks:j.content.remarks||''}));
  s.attendanceHistory=(attendance[s.studentId]?.sessions||[]).filter((h:any)=>h.status!=='void').map((h:any)=>({id:h.id,studentId:s.studentId,date:h.attendance_date,timeIn:h.clock_in_at,timeOut:h.clock_out_at,totalHours:(h.net_minutes||0)/60,locationStatus:'Recorded',gpsCoordinates:null,remarks:h.status,deviceInfo:'',attendanceStatus:h.clock_out_at?'Present':'Incomplete Time Out'}));
  s.dtrHistory=(dtrs[s.studentId]?.dtrs||[]).filter((d:any)=>d.status!=='superseded').map((d:any)=>({id:d.id,month:d.period_key,startDate:d.starts_on,endDate:d.ends_on,status:status[d.status]||'Draft',remarks:d.remarks,version:d.version,generatedAt:d.generated_at,submittedAt:d.submitted_at,reviewedAt:d.reviewed_at,totalHours:(d.printable_snapshot.sessions||[]).reduce((sum:number,h:any)=>sum+(h.net_minutes||0)/60,0),logs:(d.printable_snapshot.sessions||[]).map((h:any)=>({date:h.attendance_date,timeIn:h.clock_in_at,timeOut:h.clock_out_at,totalHours:(h.net_minutes||0)/60,locationStatus:'Recorded',gpsCoordinates:null}))}));
 }
 return {profileId:person.id,students:students as StudentOJTProfile[],enrollments,requirements,academics,dtrs,portfolios,classes,notifications:(notices.items||[]).map((n:any)=>({id:n.id,title:n.content.title||n.content.kind||'Account update',body:n.content.body||'',createdAt:n.created_at,unread:!n.read_at}))};
}
