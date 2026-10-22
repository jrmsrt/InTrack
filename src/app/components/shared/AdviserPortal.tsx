import {useEffect,useState} from 'react';
import {Navigate,useNavigate,useLocation,Link} from 'react-router-dom';
import {toast} from 'sonner';
import {loadAdviserPortalData} from '../../lib/adviserPortalData';
import {backendRpc} from '../../lib/backendGateway';
import {readMyProtectedIdentity} from '../../lib/protectedIdentity';
import {requirementPayload} from '../../lib/requirementGateway';
import {liveRequirementTitle,liveRequirementStage} from '../../lib/studentRequirementActions';
import {useProtectedIdentity} from '../../context/useProtectedIdentity';
import {ProtectedAuthProvider,type AuthContextType} from '../../context/AuthContext';
import {ProtectedOJTProvider,type OJTContextType} from '../../context/OJTContext';
import {getSupabaseClient} from '../../lib/supabaseClient';
import {clearBackendDrafts} from '../../lib/backendDrafts';
import {clearLoginChallenge} from '../../lib/loginChallenge';
import {Layout} from './Layout';
import {Toaster} from '../ui/sonner';
import {Button} from '../ui/button';

/** Protected shell for the new adviser configuration control; no demo providers. */
export function AdviserPortal({children}:{children:React.ReactNode}){
 const {result,refresh}=useProtectedIdentity(true);const navigate=useNavigate(),location=useLocation();
 const [saved,setSaved]=useState<Awaited<ReturnType<typeof loadAdviserPortalData>>|null>(null),[dataError,setDataError]=useState(''),[reload,setReload]=useState(0),[email,setEmail]=useState('');
 const ready=result.state==='loaded'&&result.identity.state==='ready'&&result.identity.usableRoles.includes('adviser')?result.identity:null;
 useEffect(()=>{let alive=true;setSaved(null);setDataError('');if(!ready)return()=>{alive=false;};
  loadAdviserPortalData(ready.profile,location.pathname).then(data=>{if(alive)setSaved(data);}).catch(()=>{if(alive)setDataError('Unable to load your saved adviser records.');});
  void getSupabaseClient().auth.getUser().then(({data})=>{if(alive)setEmail(data.user?.email||'');});return()=>{alive=false;};
 },[ready?.profile.id,location.pathname,reload]);
 useEffect(()=>{const check=()=>void refresh({background:true});window.addEventListener('focus',check);const timer=window.setInterval(check,60000);return()=>{window.removeEventListener('focus',check);clearInterval(timer);};},[refresh]);
 if(result.state==='signed_out')return <Navigate to="/login" replace/>;
 if(result.state==='loading')return <main className="p-8" role="status">Checking adviser access…</main>;
 if(result.state==='unavailable')return <main className="p-8"><p role="alert">Unable to check adviser access.</p><Button onClick={()=>void refresh()}>Retry</Button><Link to="/account-access">Account access</Link></main>;
 const identity=result.identity;
 if(identity.state!=='ready'||!identity.usableRoles.includes('adviser'))return <Navigate to="/account-access" replace/>;
 if(dataError)return <main className="space-y-3 p-8"><p role="alert">{dataError}</p><Button onClick={()=>setReload(v=>v+1)}>Retry</Button></main>;
 if(!saved||saved.profileId!==identity.profile.id)return <main className="p-8" role="status">Loading adviser records…</main>;
 const unavailable=()=>{const message='This action is not connected to saved records yet. No changes were saved.';toast.error(message);throw new Error(message);};
 const command=async(name:string,args:Record<string,unknown>)=>{const current=await readMyProtectedIdentity();if(current.state!=='ready'||current.profile.id!==identity.profile.id||!current.usableRoles.includes('adviser'))throw new Error('Your adviser session changed. Sign in again.');await backendRpc(name,{command_id:crypto.randomUUID(),...args});setReload(v=>v+1);};
 const reviewRequirement=async(studentId:string,stage:string,name:string,status:string,remarks:string)=>{const matches=saved.requirements.filter(r=>r.enrollmentId===studentId&&liveRequirementStage(r)===stage&&liveRequirementTitle(r)===name);if(matches.length!==1)throw new Error('A single assigned requirement is required.');await command('intrack_requirement_command',{action:status==='Approved'?'approve':'request_revision',payload:{...requirementPayload(matches[0]),role:'adviser',remarks}});};
 const authValue=new Proxy({user:{id:identity.profile.id,name:identity.profile.displayName,email,role:'adviser',accountStatus:'Verified',emailVerified:true},isAuthenticated:true,
  updateUser:()=>toast.info('Profile editing is not connected yet. No changes were saved.'),resendVerificationEmail:()=>toast.info('Your email is already verified.'),
  async logout(){const {error}=await getSupabaseClient().auth.signOut({scope:'local'});if(error)throw new Error('Unable to sign out.');clearBackendDrafts();clearLoginChallenge();navigate('/login',{replace:true});}
 },{get:(target,key)=>key in target?target[key as keyof typeof target]:unavailable}) as unknown as AuthContextType;
 const ojtValue=new Proxy({isBackendConnected:true,availableAdviserPaths:undefined,studentEnrollmentStatus:undefined,students:saved.students,companies:[],savedNotifications:saved.notifications,mockLocation:{lat:0,lng:0,accuracy:0},
  reviewPreOJTReq:(id:string,name:string,status:string,note:string)=>reviewRequirement(id,'pre',name,status,note),reviewDuringOJTReq:(id:string,name:string,status:string,note:string)=>reviewRequirement(id,'during',name,status,note),reviewPostOJTReq:(id:string,name:string,status:string,note:string)=>reviewRequirement(id,'post',name,status,note),
  async reviewWeeklyJournal(id:string,journalId:string,status:string,reason:string){const e=saved.enrollments.find(e=>e.id===id),j=saved.academics[id]?.journals?.find((j:any)=>j.id===journalId);if(!e||!j)throw new Error('Current journal unavailable.');await command('intrack_academic_command',{payload:{enrollmentId:id,expectedEnrollmentRevision:e.revision,artifactId:j.id,expectedArtifactRevision:j.revision,kind:'journal',action:status==='Approved'?'approve':'request_revision',reason}});},
  async updateDTRStatus(id:string,dtrId:string,status:string,reason:string){const e=saved.enrollments.find(e=>e.id===id),d=saved.dtrs[id]?.dtrs?.find((d:any)=>d.id===dtrId);if(!e||!d)throw new Error('Current DTR unavailable.');await command('intrack_dtr_command',{payload:{enrollmentId:id,expectedEnrollmentRevision:e.revision,dtrId:d.id,expectedDtrRevision:d.revision,action:status==='Approved'?'approve':'request_revision',reason}});},
  async reviewPortfolio(id:string,status:string,reason:string){if(status==='Approved')throw new Error('Portfolio approval requires item-by-item verification. No approval was saved.');const e=saved.enrollments.find(e=>e.id===id),p=saved.portfolios[id]?.find((p:any)=>p.is_current);if(!e||!p)throw new Error('Current portfolio unavailable.');await command('intrack_portfolio_command',{payload:{enrollmentId:id,expectedEnrollmentRevision:e.revision,artifactId:p.id,expectedArtifactRevision:p.revision,role:'adviser',action:'request_revision',reason}});}
 },
 {get:(target,key)=>key in target?target[key as keyof typeof target]:unavailable}) as unknown as OJTContextType;
 return <ProtectedAuthProvider value={authValue}><ProtectedOJTProvider value={ojtValue}><Layout>{children}</Layout><Toaster/></ProtectedOJTProvider></ProtectedAuthProvider>;
}
