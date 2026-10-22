import {useEffect,useRef,useState} from 'react';
import {officialOjtCoordinator} from '../../data/institution';
import {toast} from 'sonner';
import {useProtectedIdentity} from '../../context/useProtectedIdentity';
import {ClassCodeEnrollment} from '../../components/forms/ClassCodeEnrollment';
import {PracticumRequirementsEditor} from '../../components/forms/PracticumRequirementsEditor';
import {AddProgramRequirement} from '../../components/forms/AddProgramRequirement';
import {readEnrollmentConfiguration,readProgramChecklist,enrollmentConfigurationCommand,fixedEvidenceReviewer,type ProgramChecklist,type EnrollmentConfiguration as Configuration,type EnrollmentStaffRole,type PolicyRequirement} from '../../lib/enrollmentConfiguration';
import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '../../components/ui/card';
import {Button} from '../../components/ui/button';
import {Input} from '../../components/ui/input';
import {Label} from '../../components/ui/label';
const selectClass='h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-[#800000]';
export function EnrollmentConfiguration({role}:{role:EnrollmentStaffRole}){
 const {result}=useProtectedIdentity(true);const identity=result.state==='loaded'&&result.identity.state==='ready'?result.identity:null;
 const [data,setData]=useState<Configuration|null>(null),[config,setConfig]=useState<ProgramChecklist|null>(null),[programId,setProgramId]=useState(''),[tab,setTab]=useState('classes');
 const [error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [requirements,setRequirements]=useState<PolicyRequirement[]>([]),[attendance,setAttendance]=useState({dailyCapMinutes:'',maxSessionMinutes:'',maxAccuracyMeters:'',maxCoordinateAgeSeconds:''}),[confirmed,setConfirmed]=useState(false);
 const inFlight=useRef(false);
 const [addedRequirementCode,setAddedRequirementCode]=useState<string>();
 const [overviewProgram,setOverviewProgram]=useState('all');
 useEffect(()=>{
  let alive=true;setLoading(true);setError('');setConfig(null);setRequirements([]);setConfirmed(false);
  if(!identity?.usableRoles.includes(role))return()=>{alive=false;};
  void (async()=>{const directory=await readEnrollmentConfiguration(role);const selected=directory.programs.some(p=>p.id===programId)?programId:directory.programs[0]?.id||'';
   const checklist=selected?await readProgramChecklist(role,selected):null;
   if(!alive)return;setData(directory);if(selected!==programId){setProgramId(selected);return;}setConfig(checklist);
   setRequirements(checklist?.requirements.map(r=>({...r,deadline:r.recurrence.kind==='once'?(r.recurrence.dueAt||'').slice(0,10):undefined}))||[]);
   setAttendance({dailyCapMinutes:String(checklist?.attendancePolicy.dailyCapMinutes||''),maxSessionMinutes:String(checklist?.attendancePolicy.maxSessionMinutes||''),maxAccuracyMeters:String(checklist?.attendancePolicy.maxAccuracyMeters||''),maxCoordinateAgeSeconds:String(checklist?.attendancePolicy.maxCoordinateAgeSeconds||'')});
  })().catch(cause=>{if(alive)setError(cause instanceof Error?cause.message:'Unable to load class settings.');}).finally(()=>{if(alive)setLoading(false);});
  return()=>{alive=false;};
 },[identity?.profile.id,role,programId,reload]);
 const save=async(action:'requirements'|'attendance')=>{
  if(!identity||!config||inFlight.current)return;inFlight.current=true;setBusy(true);
  try{
   const rows=requirements.map(({deadline,...row})=>({...row,recurrence:row.recurrence.kind==='once'?{kind:'once',dueAt:deadline?new Date(`${deadline}T23:59:59+08:00`).toISOString():null}:row.recurrence}));
   await enrollmentConfigurationCommand(identity.profile.id,role,'intrack_save_program_checklist',{programId,expectedRevision:config.revision,action,...(action==='requirements'?{requirements:rows}:{attendancePolicy:{confirmed:true,...Object.fromEntries(Object.entries(attendance).map(([key,value])=>[key,Number(value)]))}})});
   toast.success(action==='requirements'?'Program requirements saved. New classes will use this checklist.':'Attendance settings saved for new classes.');setReload(v=>v+1);
  }catch(cause){toast.error(cause instanceof Error?cause.message:'Unable to save.');}finally{setBusy(false);inFlight.current=false;}
 };
 return <div className="min-w-0 max-w-full space-y-6 font-sans">
  <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">{role==='adviser'?'My Classes':'Classes & Requirements'}</h1><p className="mt-1 text-sm text-slate-500">{role==='adviser'?'Create your class, share its code and approve students.':'Oversee classes and maintain the standard checklist for each program.'}</p><p className="mt-1 text-xs text-slate-500">Official {officialOjtCoordinator.title}: {officialOjtCoordinator.name}</p></div>
  {role==='coordinator'&&<div className="flex flex-wrap gap-2">{[['classes','Classes'],['requirements','Program Requirements'],['attendance','Attendance Settings']].map(([value,label])=><Button key={value} disabled={busy} variant={tab===value?'default':'outline'} className={tab===value?'bg-[#800000] text-white':''} onClick={()=>setTab(value)}>{label}</Button>)}</div>}
  {error&&<p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}<Button variant="outline" onClick={()=>setReload(v=>v+1)} className="ml-3">Retry</Button></p>}
  <div className="max-w-sm space-y-2"><Label htmlFor="enroll-program">Program</Label><select id="enroll-program" disabled={busy||loading} className={selectClass} value={role==='coordinator'&&tab==='classes'?overviewProgram:programId} onChange={e=>{if(role==='coordinator'&&tab==='classes')setOverviewProgram(e.target.value);else setProgramId(e.target.value);}}>{role==='coordinator'&&tab==='classes'?<option value="all">All programs</option>:!programId&&<option value="">Select program</option>}{data?.programs.map(p=><option key={p.id} value={p.id}>{p.code==='BSCPE'?'BSCpE':p.code}</option>)}</select></div>
  {loading&&<p role="status" className="text-sm text-slate-500">Loading saved class settings…</p>}
  {!loading&&!error&&data&&<>
   {(role==='adviser'||tab==='classes')&&<ClassCodeEnrollment role={role} programId={role==='coordinator'?(overviewProgram==='all'?'':overviewProgram):programId} directory={data} onCreated={()=>setReload(v=>v+1)}/>}
   {role==='coordinator'&&tab==='requirements'&&config&&<Card className="min-w-0 border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-lg font-semibold">Program Requirements</CardTitle><CardDescription>The checklist is ready to use. Save changes when needed; new classes receive an automatic copy. Existing classes keep their requirements.</CardDescription></CardHeader><CardContent><fieldset disabled={busy} className="min-w-0 space-y-6">
    <div className="flex flex-wrap items-center gap-3"><Label htmlFor="all-reviewers">Set reviewer for all items</Label><select id="all-reviewers" value="" className={selectClass+' max-w-xs'} onChange={e=>{const reviewer=e.target.value;setRequirements(rows=>rows.map(r=>({...r,reviewer:fixedEvidenceReviewer(r.evidenceType)||reviewer})));}}><option value="">Choose reviewer</option><option value="adviser">Adviser</option><option value="coordinator">Coordinator</option><option value="both">Adviser then coordinator</option></select></div>
    <AddProgramRequirement requirements={requirements} disabled={busy} onAdd={row=>{setRequirements(rows=>[...rows,row]);setAddedRequirementCode(row.code);}}/>
    <PracticumRequirementsEditor requirements={requirements} revealCode={addedRequirementCode} onChange={(index,patch)=>setRequirements(rows=>rows.map((row,i)=>i===index?{...row,...patch}:row))}/>
    <p className="text-xs leading-6 text-slate-500">A blank deadline means no fixed deadline. MOA routing uses the coordinator; system DTR and journals use the adviser. Deployment clearance is separate.</p>
    <Button className="bg-[#800000] text-white" disabled={busy} onClick={()=>void save('requirements')}>{busy?'Saving…':'Save requirements'}</Button>
   </fieldset></CardContent></Card>}
   {role==='coordinator'&&tab==='attendance'&&config&&<Card><CardHeader><CardTitle>Attendance Settings</CardTitle><CardDescription>Configure approved attendance rules separately. These settings apply to new classes; existing classes keep their saved settings. Saving does not issue deployment clearance.</CardDescription></CardHeader><CardContent><fieldset disabled={busy} className="space-y-5">
    <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{config.attendancePolicy.confirmed?'Attendance rules are configured for new classes.':'Attendance remains disabled until approved rules are supplied. Students can still join classes and submit requirements.'}</p>
    <div className="grid gap-4 sm:grid-cols-2">{[['dailyCapMinutes','Daily cap (minutes)'],['maxSessionMinutes','Maximum session (minutes)'],['maxAccuracyMeters','Maximum GPS accuracy error (meters)'],['maxCoordinateAgeSeconds','Maximum GPS age (seconds)']].map(([key,label])=><div key={key} className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} type="number" min="1" value={attendance[key as keyof typeof attendance]} onChange={e=>{setAttendance(v=>({...v,[key]:e.target.value}));setConfirmed(false);}}/></div>)}</div>
    <label className="flex items-start gap-2 text-sm leading-6"><input type="checkbox" className="mt-1 accent-[#800000]" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>I confirm these attendance values are approved for this program.</label><Button disabled={!confirmed||busy||Object.values(attendance).some(value=>!value)} className="bg-[#800000] text-white" onClick={()=>void save('attendance')}>Save attendance settings</Button>
   </fieldset></CardContent></Card>}
  </>}
 </div>;
}
