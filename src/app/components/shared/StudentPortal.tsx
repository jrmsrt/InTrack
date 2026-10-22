import {mergeRequirementChecklist} from '../../domain/requirementChecklist';
import {useEffect,useState,useMemo} from 'react';
import {Link,Navigate,useNavigate,useLocation} from 'react-router-dom';
import {toast} from 'sonner';
import {useProtectedIdentity} from '../../context/useProtectedIdentity';
import {ProtectedAuthProvider,type AuthContextType} from '../../context/AuthContext';
import {ProtectedOJTProvider,type OJTContextType} from '../../context/OJTContext';
import {Layout} from './Layout';
import {Toaster} from '../ui/sonner';
import {Button} from '../ui/button';
import {backendRpc,listEnrollments} from '../../lib/backendGateway';
import {listLiveRequirements} from '../../lib/requirementGateway';
import {createStudentRequirementActions,studentRequirementItem,liveRequirementStage} from '../../lib/studentRequirementActions';
import {projectCoordinatorStudents} from '../../lib/coordinatorModuleModel';
import {studentAccountProjection,type StudentPortalProfile} from '../../lib/studentPortalModel';
import {getSupabaseClient} from '../../lib/supabaseClient';
import {clearBackendDrafts} from '../../lib/backendDrafts';
import {clearLoginChallenge} from '../../lib/loginChallenge';
import {studentRouteNeedsEnrollment} from '../../lib/studentEnrollmentAccess';

function useStudentRecords(profileId:string){
 const [saved,setSaved]=useState<any>(null),[error,setError]=useState(''),[reload,setReload]=useState(0);
 useEffect(()=>{const check=()=>setReload(value=>value+1);window.addEventListener('focus',check);const timer=window.setInterval(check,60000);return()=>{window.removeEventListener('focus',check);clearInterval(timer);};},[]);
 useEffect(()=>{let alive=true;setError('');
  void (async()=>{
   const [profile,enrollments]=await Promise.all([backendRpc<StudentPortalProfile>('intrack_student_portal_profile'),listEnrollments('student')]);
   if(profile.id!==profileId)throw new Error('Student identity changed.');
   const enrollment=enrollments.find(e=>e.outcome==='active')||enrollments[0];let student=studentAccountProjection(profile,enrollment);
   const [requirements,ann,notifications]=enrollment?await Promise.all([listLiveRequirements('student'),backendRpc<any>('intrack_list_announcements',{actor_role:'student'}),backendRpc<any>('intrack_list_notifications',{actor_role:'student'})]):[[],{items:[]},{items:[]}];
   if(enrollment){
    const [attendance,academic,assessments,dtrs]=await Promise.all([backendRpc<any>('intrack_list_attendance',{enrollment_id:enrollment.id,actor_role:'student'}),backendRpc<any>('intrack_list_academics',{enrollment_id:enrollment.id,actor_role:'student'}),backendRpc<any>('intrack_list_assessments',{enrollment_id:enrollment.id,actor_role:'student'}),backendRpc<any>('intrack_list_dtrs',{enrollment_id:enrollment.id,actor_role:'student'})]);
    const directory:any={programs:profile.programs,policies:[],terms:[],eligibleStudents:[{profileId,name:profile.name,email:profile.email,studentNumber:profile.studentNumber,section:profile.section}],memberships:profile.advisers.map(a=>({profileId:a.id,name:a.name}))};
    const mapped=projectCoordinatorStudents({enrollments:[enrollment],requirements,directory,portfolios:{[enrollment.id]:assessments.portfolios},notifications:[],announcements:[],templates:[]})[0];
    const moa=requirements.find(r=>r.enrollmentId===enrollment.id&&r.evidenceType==='moa');
    const ownRequirements=requirements.filter(r=>r.enrollmentId===enrollment.id);
    student={...mapped,...student,
     preOJTRequirements:mergeRequirementChecklist('pre',ownRequirements.filter(r=>liveRequirementStage(r)==='pre').map(studentRequirementItem)),
     duringOJTRequirements:mergeRequirementChecklist('during',ownRequirements.filter(r=>liveRequirementStage(r)==='during').map(studentRequirementItem)),
     postOJTRequirements:mergeRequirementChecklist('post',ownRequirements.filter(r=>liveRequirementStage(r)==='post').map(studentRequirementItem)),
     moaState:{...mapped.moaState,...(moa?{fileName:studentRequirementItem(moa).fileName,file:studentRequirementItem(moa).file}: {})},
     portfolioApproved:mapped.portfolioApproved,portfolioSubmitted:mapped.portfolioSubmitted,portfolioRemarks:mapped.portfolioRemarks};
    student.attendanceHistory=attendance.sessions.filter((a:any)=>a.status!=='void').map((a:any)=>({id:a.id,studentId:profile.id,date:a.attendance_date,timeIn:new Date(a.clock_in_at).toLocaleTimeString('en-GB',{hour12:false}),timeOut:a.clock_out_at?new Date(a.clock_out_at).toLocaleTimeString('en-GB',{hour12:false}):null,totalHours:(a.net_minutes||0)/60,locationStatus:'Attendance Recorded',gpsCoordinates:null,remarks:a.status,deviceInfo:'',attendanceStatus:a.clock_out_at?'Present':'Incomplete Time Out'}));
    for(const item of [...student.preOJTRequirements,...student.duringOJTRequirements,...student.postOJTRequirements])if(item.file)item.file.backendRole='student';
    if(student.moaState.file)student.moaState.file.backendRole='student';
    student.dtrHistory=dtrs.dtrs.filter((d:any)=>d.status!=='superseded').map((d:any)=>({id:d.id,month:d.period_key,startDate:d.starts_on,endDate:d.ends_on,status:({draft:'Draft',submitted:'Submitted',under_review:'Under Review',needs_revision:'Needs Revision',approved:'Approved'} as any)[d.status],remarks:d.remarks,version:d.version,generatedAt:d.generated_at,submittedAt:d.submitted_at,reviewedAt:d.reviewed_at,totalHours:(d.printable_snapshot.sessions||[]).reduce((sum:number,a:any)=>sum+(a.net_minutes||0)/60,0),logs:(d.printable_snapshot.sessions||[]).map((a:any)=>({date:a.attendance_date,timeIn:a.clock_in_at,timeOut:a.clock_out_at,totalHours:(a.net_minutes||0)/60,locationStatus:'Attendance Recorded',gpsCoordinates:null}))}));
    const status:Record<string,string>={draft:'Draft',submitted:'Submitted',under_review:'Submitted',needs_revision:'Needs Revision',rejected:'Needs Revision',approved:'Approved'};
    student.dailyTasks=academic.tasks.filter((t:any)=>t.is_current).map((t:any)=>({id:t.id,date:t.task_date,timeStarted:t.content.timeStarted||'',timeEnded:t.content.timeEnded||'',title:t.content.title||'',description:t.content.description||'',output:t.content.output||'',skillsApplied:t.content.skillsApplied||'',problemsEncountered:t.content.problemsEncountered||'',attachmentName:null,status:status[t.status]||'Draft'}));
    student.weeklyJournals=academic.journals.filter((j:any)=>j.is_current).map((j:any,i:number)=>({id:j.id,weekNumber:j.content.weekNumber||i+1,startDate:j.starts_on,endDate:j.ends_on,tasks:student.dailyTasks.filter(t=>t.date>=j.starts_on&&t.date<=j.ends_on),reflection:j.content.reflection||'',problems:j.content.problems||'',totalHours:0,status:status[j.status]||'Draft',submittedAt:j.submitted_at}));
   }
   if(alive)setSaved({profile,student,enrollmentId:enrollment?.id,notifications:notifications.items.map((n:any)=>({id:n.id,title:n.content.title||n.content.kind||'Account update',body:n.content.body||n.content.message||'',createdAt:n.created_at,unread:!n.read_at})),announcements:ann.items.map((a:any)=>({id:a.id,title:a.title,message:a.body,priority:'Info',targetRole:a.audience_role||'all',author:'',publishDate:new Date(a.published_at).toLocaleDateString()}))});
  })().catch(()=>{if(alive)setError('Unable to load your saved student records. Please retry.');});
  return()=>{alive=false;};
 },[profileId,reload]);
 return {saved,error,retry:()=>setReload(v=>v+1)};
}
function StudentModules({profileId,children}:{profileId:string;children:React.ReactNode}){
 const {saved,error,retry}=useStudentRecords(profileId);const navigate=useNavigate();const location=useLocation();
 const requirementActions=useMemo(()=>createStudentRequirementActions(profileId,saved?.enrollmentId,retry),[profileId,saved?.enrollmentId]);
 if(error)return <main className="p-8"><p role="alert">{error}</p><Button onClick={retry}>Retry</Button></main>;
 if(!saved||saved.profile.id!==profileId)return <main className="p-8" role="status">Loading your student portal…</main>;
 if(studentRouteNeedsEnrollment(location.pathname,!!saved.enrollmentId))return <Navigate to="/dashboard" replace/>;
 const {profile,student}=saved;
 const unsupported=()=>{const message='This action is not connected to saved student records yet. No changes were saved.';toast.error(message);throw new Error(message);};
 const failedAttendance=()=>({success:false,message:'Attendance requires an approved enrollment, deployment policy and connected attendance controls. No attendance was saved.'});
 const authValue=new Proxy({user:{id:profile.id,name:profile.name,email:profile.email,role:'student',studentId:profile.studentNumber,studentNumber:profile.studentNumber,program:student.program,section:student.section,company:student.companyName,accountStatus:'Verified',emailVerified:true},isAuthenticated:true,
  async logout(){const {error}=await getSupabaseClient().auth.signOut({scope:'local'});if(error)throw new Error('Unable to sign out. Please retry.');clearBackendDrafts();clearLoginChallenge();navigate('/login',{replace:true});},
  login:()=>({success:false,error:'Use the verified sign-in page.'})
 },{get:(target,key)=>key in target?target[key as keyof typeof target]:unsupported}) as unknown as AuthContextType;
 const ojtValue=new Proxy({isBackendConnected:true,refreshStudentRecords:retry,studentEnrollmentStatus:saved.enrollmentId?'enrolled':'not_enrolled',uploadRequirementFile:requirementActions.upload,submitPhysicalRequirement:requirementActions.physical,savedNotifications:saved.notifications,students:[student],companies:[],htePartners:[],templates:[],messages:[],announcements:saved.announcements,evaluationFormConfigs:[],systemSettings:{academicYear:'',semester:'',requiredHours:student.requiredHours,defaultRadius:0},mockLocation:{lat:0,lng:0,accuracy:0},timeIn:failedAttendance,timeOut:failedAttendance,requestAttendanceCorrection:failedAttendance},
 {get:(target,key)=>key in target?target[key as keyof typeof target]:unsupported}) as unknown as OJTContextType;
 return <ProtectedAuthProvider value={authValue}><ProtectedOJTProvider value={ojtValue}><Layout>{children}</Layout><Toaster/></ProtectedOJTProvider></ProtectedAuthProvider>;
}
export function StudentPortal({children}:{children:React.ReactNode}){
 const {result,refresh}=useProtectedIdentity(true);
 useEffect(()=>{const check=()=>void refresh({background:true});window.addEventListener('focus',check);const timer=window.setInterval(check,60000);return()=>{window.removeEventListener('focus',check);clearInterval(timer);};},[refresh]);
 if(result.state==='signed_out')return <Navigate to="/login" replace/>;
 if(result.state==='loading')return <main className="p-8" role="status">Checking student access…</main>;
 if(result.state==='unavailable')return <main className="p-8"><p role="alert">Unable to check student access.</p><Button onClick={()=>void refresh()}>Retry</Button><Link to="/account-access">Account access</Link></main>;
 const identity=result.identity;
 if(identity.state!=='ready'||!identity.usableRoles.includes('student'))return <Navigate to="/account-access" replace/>;
 return <StudentModules profileId={identity.profile.id}>{children}</StudentModules>;
}
