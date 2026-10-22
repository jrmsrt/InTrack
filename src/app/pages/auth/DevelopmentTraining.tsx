import {useEffect,useRef,useState} from 'react';
import {useProtectedIdentity} from '../../context/useProtectedIdentity';
import {backendRpc,listEnrollments,type EnrollmentProjection} from '../../lib/backendGateway';
import type {IdentityRole} from '../../lib/protectedIdentity';

const commands=['intrack_attendance_exception','intrack_attendance_correction','intrack_reconstruction_command','intrack_dtr_command','intrack_academic_command','intrack_bind_specialized_requirement','intrack_evaluation_command','intrack_portfolio_command','intrack_finalization_command','intrack_publish_rubric','intrack_revoke_approval'] as const;
const readGps=()=>new Promise<{latitude:number;longitude:number;accuracyMeters:number;capturedAt:string}>((resolve,reject)=>{
 if(!navigator.geolocation){reject(new Error('Location is unavailable.'));return;}
 navigator.geolocation.getCurrentPosition(p=>resolve({latitude:p.coords.latitude,longitude:p.coords.longitude,accuracyMeters:p.coords.accuracy,capturedAt:new Date(p.timestamp).toISOString()}),()=>reject(new Error('Location permission or a fresh GPS reading is unavailable. Request an authorized exception if needed.')),{enableHighAccuracy:true,maximumAge:0,timeout:15000});
});

export function DevelopmentTraining({portal=false}:{portal?:boolean}={}){
 const local=(()=>{try{const u=new URL(import.meta.env.VITE_SUPABASE_URL||'');return u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)&&u.port==='54321';}catch{return false;}})();
 const {result}=useProtectedIdentity(portal||local);const ready=result.state==='loaded'&&result.identity.state==='ready'?result.identity:null;
 const [role,setRole]=useState<IdentityRole>('student');const current=portal?(ready?.usableRoles.includes('coordinator')?'coordinator':undefined):ready?.usableRoles.includes(role)?role:ready?.usableRoles[0];
 const [enrollments,setEnrollments]=useState<EnrollmentProjection[]>([]),[selected,setSelected]=useState('');
 const [attendance,setAttendance]=useState<any>(null),[dtrs,setDtrs]=useState<any>(null),[academics,setAcademics]=useState<any>(null);
 const [assessments,setAssessments]=useState<any>(null);
 const [busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[reload,setReload]=useState(0);
 const [taskDate,setTaskDate]=useState(''),[description,setDescription]=useState(''),[reason,setReason]=useState('');
 const [command,setCommand]=useState<typeof commands[number]>(commands[0]),[json,setJson]=useState('');
 const generation=useRef(0);const operation=useRef<{name:string;payload:string;id:string}|null>(null);
 const enrollment=enrollments.find(e=>e.id===selected);
 useEffect(()=>{const token=++generation.current;setEnrollments([]);setAttendance(null);setDtrs(null);setAcademics(null);setAssessments(null);setSelected('');setJson('');setDescription('');setTaskDate('');setReason('');setNotice('');operation.current=null;setBusy(false);
  if(!ready||!current)return;setBusy(true);listEnrollments(current).then(rows=>{if(token===generation.current)setEnrollments(rows);}).catch(error=>{if(token===generation.current)setNotice(error.message);}).finally(()=>{if(token===generation.current)setBusy(false);});
  return()=>{generation.current++;};
 },[ready,current,reload]);
 const run=async(work:(token:number)=>Promise<void>)=>{const token=generation.current;setBusy(true);setNotice('Working…');try{await work(token);}catch(error){if(token===generation.current)setNotice(error instanceof Error?error.message:'Operation unavailable.');}finally{if(token===generation.current)setBusy(false);}};
 const load=async(token:number)=>{if(!enrollment||!current)return;
  const [a,d,j,v]=await Promise.all([backendRpc('intrack_list_attendance',{enrollment_id:enrollment.id,actor_role:current}),backendRpc('intrack_list_dtrs',{enrollment_id:enrollment.id,actor_role:current}),backendRpc('intrack_list_academics',{enrollment_id:enrollment.id,actor_role:current}),backendRpc('intrack_list_assessments',{enrollment_id:enrollment.id,actor_role:current})]);
  if(token===generation.current){setAttendance(a);setDtrs(d);setAcademics(j);setAssessments(v);setNotice('Saved records loaded.');}
 };
 const mutate=async(name:string,payload:Record<string,unknown>,extra:Record<string,unknown>={})=>{
  if(!enrollment)throw new Error('Select an enrollment.');
  const body={...payload,enrollmentId:enrollment.id,expectedEnrollmentRevision:enrollment.revision};const encoded=JSON.stringify({body,extra});
  if(operation.current?.name!==name||operation.current.payload!==encoded)operation.current={name,payload:encoded,id:crypto.randomUUID()};
  const response=await backendRpc<any>(name,{command_id:operation.current.id,...extra,payload:body});operation.current=null;return response;
 };
 const confirm=async(token:number,name:string,payload:Record<string,unknown>,extra:Record<string,unknown>={})=>{
  const response=await mutate(name,payload,extra);if(token!==generation.current)return;
  const rows=await listEnrollments(current!);if(token!==generation.current)return;setEnrollments(rows);setAttendance(null);setDtrs(null);setAcademics(null);setAssessments(null);setNotice(response.accepted===false?`Attendance denied: ${response.reason}. No session was created.`:'Saved. Reload records to see current revisions.');
 };
 if(!portal&&!local)return <main className="p-8">This development workspace requires local Supabase.</main>;
 return <main className="mx-auto max-w-6xl p-6 space-y-5">
  <h1 className="text-3xl font-bold">{portal?'Portfolio Review Board':'Local attendance and academic workspace'}</h1>
  {!portal&&<nav className="flex gap-4"><a className="underline" href="/?authSetup=1">Account setup</a><a className="underline" href="/?backendTest=1">Administration</a><a className="underline" href="/?requirementsTest=1">Evidence</a></nav>}
  <p>These actions use protected Supabase records. Approved schedules, attendance settings and journal occurrence rules are required.</p><p role="status" aria-live="polite">{notice||result.state}</p>
  {ready&&current?<fieldset disabled={busy} className="space-y-4">
   {!portal&&<label>Role <select className="border p-2" value={current} onChange={e=>setRole(e.target.value as IdentityRole)}>{ready.usableRoles.map(r=><option key={r}>{r}</option>)}</select></label>}
   <label className="block">Enrollment <select className="border p-2" value={selected} onChange={e=>{generation.current++;setSelected(e.target.value);setAttendance(null);setDtrs(null);setAcademics(null);setAssessments(null);setJson('');setDescription('');setReason('');operation.current=null;}}><option value="">Select</option>{enrollments.map(e=><option value={e.id} key={e.id}>{e.studentName} · {e.programCode} · {e.lifecycle}</option>)}</select></label>
   {enrollment&&<><p>Revision {enrollment.revision} · Clearance {enrollment.clearance} · Approved {enrollment.creditedMinutes/60} / {enrollment.requiredMinutes/60} hours</p>
    <button className="border p-2" onClick={()=>void run(load)}>Load saved records</button>
    {current==='student'&&<section className="space-y-3 rounded border p-4"><h2 className="text-xl font-bold">Attendance</h2>
     <button className="border p-2" onClick={()=>void run(async token=>{const gps=await readGps();if(token===generation.current)await confirm(token,'intrack_attendance_command',{gps},{action:'clock_in'});})}>Clock in with current location</button>
     {(attendance?.sessions||[]).filter((s:any)=>!s.clock_out_at&&s.status!=='void').map((s:any)=><button key={s.id} className="ml-3 border p-2" onClick={()=>void run(async token=>{const gps=await readGps();if(token===generation.current)await confirm(token,'intrack_attendance_command',{gps,sessionId:s.id,expectedSessionRevision:s.revision},{action:'clock_out'});})}>Clock out of session {s.id.slice(0,8)}</button>)}
     <p className="text-sm">Location failures do not use demonstration coordinates. Historical sessions keep their original placement and policy basis.</p>
    </section>}
    {attendance&&<section className="rounded border p-4"><h2 className="text-xl font-bold">Sessions</h2>{attendance.sessions.map((s:any)=><p key={s.id}>{s.id} · {s.clock_in_at} → {s.clock_out_at||'Open'} · {s.status} · revision {s.revision}</p>)}</section>}
    {dtrs&&<section className="rounded border p-4"><h2 className="text-xl font-bold">DTRs and configured periods</h2>{dtrs.periods.map((p:any)=><div className="my-2" key={p.id}>{p.period_key} · {p.starts_on} to {p.ends_on}{current==='student'&&<button className="ml-3 underline" onClick={()=>void run(token=>confirm(token,'intrack_dtr_command',{action:'generate',periodId:p.id}))}>Generate period snapshot</button>}</div>)}
     <label>Decision reason <input className="border p-2" value={reason} onChange={e=>setReason(e.target.value)}/></label>
     {dtrs.dtrs.map((d:any)=><div className="my-3" key={d.id}>{d.id} · {d.period_key} · v{d.version} · {d.status} · revision {d.revision}
      {current==='student'&&d.status==='draft'&&<button className="ml-3 underline" onClick={()=>void run(token=>confirm(token,'intrack_dtr_command',{action:'submit',dtrId:d.id,expectedDtrRevision:d.revision}))}>Submit</button>}
      {current==='adviser'&&['submitted','under_review'].includes(d.status)&&['approve','request_revision'].map(action=><button key={action} className="ml-3 underline" disabled={action!=='approve'&&!reason.trim()} onClick={()=>void run(token=>confirm(token,'intrack_dtr_command',{action,dtrId:d.id,expectedDtrRevision:d.revision,reason}))}>{action.replaceAll('_',' ')}</button>)}
     </div>)}</section>}
    {current==='student'&&<section className="rounded border p-4 space-y-3"><h2 className="text-xl font-bold">Submit daily task</h2><label>Date <input type="date" className="border p-2" value={taskDate} onChange={e=>setTaskDate(e.target.value)}/></label><label className="block">Description <textarea className="block w-full border p-2" maxLength={8000} value={description} onChange={e=>setDescription(e.target.value)}/></label><button className="border p-2" disabled={!taskDate||!description.trim()} onClick={()=>void run(token=>confirm(token,'intrack_academic_command',{action:'submit',kind:'task',taskDate,content:{description}}))}>Submit task for review</button></section>}
    {academics&&<section className="rounded border p-4"><h2 className="text-xl font-bold">Academic versions</h2>{(['tasks','journals'] as const).flatMap(kind=>academics[kind].map((a:any)=><div key={a.id} className="my-3">{kind} · {a.id} · v{a.version} · {a.status} · revision {a.revision}{current==='adviser'&&a.is_current&&['submitted','under_review'].includes(a.status)&&['approve','request_revision','reject'].map(action=><button key={action} className="ml-3 underline" disabled={action!=='approve'&&!reason.trim()} onClick={()=>void run(token=>confirm(token,'intrack_academic_command',{action,kind:kind==='tasks'?'task':'journal',artifactId:a.id,expectedArtifactRevision:a.revision,reason}))}>{action.replaceAll('_',' ')}</button>)}</div>))}</section>}
    {assessments&&<details className="rounded border p-4"><summary>Saved evaluations, portfolios, rubrics and completion history</summary><pre className="whitespace-pre-wrap break-all text-sm">{JSON.stringify(assessments,null,2)}</pre></details>}
    <details className="rounded border p-4"><summary>Advanced local commands</summary><p>Use the exact contract in the local training guide. Enrollment ID and current revision are supplied by this workspace. Every command rechecks scope on the server.</p><select className="border p-2" value={command} onChange={e=>setCommand(e.target.value as typeof command)}>{commands.map(c=><option key={c}>{c}</option>)}</select><label className="block">Command fields<textarea className="h-48 w-full border p-2" value={json} onChange={e=>setJson(e.target.value)}/></label><button className="border p-2" disabled={!json.trim()} onClick={()=>void run(token=>confirm(token,command,JSON.parse(json)))}>Execute protected command</button></details>
   </>}
  </fieldset>:<p>Complete account setup and staff MFA first.</p>}
 </main>;
}
