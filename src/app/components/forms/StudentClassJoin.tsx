import {useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {backendRpc} from '../../lib/backendGateway';
import {readMyProtectedIdentity} from '../../lib/protectedIdentity';
import {termLabel} from '../../lib/enrollmentConfiguration';
import {useOJT} from '../../context/OJTContext';
import {Card,CardHeader,CardContent,CardTitle,CardDescription} from '../ui/card';
import {Button} from '../ui/button';
import {Input} from '../ui/input';
import {Label} from '../ui/label';
type JoinRequest={id:string;status:string;section:string;programCode:string;academicYear:string;semester:string;adviserName:string;reason:string};
export function StudentClassJoin(){
 const {refreshStudentRecords}=useOJT();
 const [code,setCode]=useState(''),[requests,setRequests]=useState<JoinRequest[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reload,setReload]=useState(0);
 const saving=useRef(false),approved=useRef(new Set<string>());
 useEffect(()=>{const check=()=>setReload(v=>v+1);window.addEventListener('focus',check);const timer=window.setInterval(check,20000);return()=>{window.removeEventListener('focus',check);clearInterval(timer);};},[]);
 useEffect(()=>{let alive=true;
  backendRpc<JoinRequest[]>('intrack_my_class_join_requests').then(rows=>{if(!alive)return;setRequests(rows);setError('');for(const row of rows)if(row.status==='approved'&&!approved.current.has(row.id)){approved.current.add(row.id);refreshStudentRecords?.();}}).catch(()=>{if(alive)setError('Unable to check your join requests. Please retry.');});return()=>{alive=false;};
 },[reload]);
 const submit=async()=>{
  if(saving.current)return;saving.current=true;setBusy(true);setError('');
  try{
   const identity=await readMyProtectedIdentity();if(identity.state!=='ready'||!identity.usableRoles.includes('student'))throw new Error('Your student session changed. Sign in again.');
   const normalized=code.trim().toUpperCase();if(!/^[A-F0-9]{10}$/.test(normalized))throw new Error('Enter the 10-character class code shared by your adviser.');
   const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(normalized));
   const key=`intrack-class-join-command:${identity.profile.id}:${Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('')}`;
   let commandId=localStorage.getItem(key);if(!commandId){commandId=crypto.randomUUID();localStorage.setItem(key,commandId);}
   const result=await backendRpc<{accepted:boolean;message:string}>('intrack_request_class_join',{command_id:commandId,payload:{code:normalized}});
   localStorage.removeItem(key);
   if(!result.accepted)throw new Error(result.message);
   toast.success(result.message);setCode('');setReload(v=>v+1);
  }catch(cause){setError(cause instanceof Error?cause.message:'Unable to send your request. Please retry.');}
  finally{saving.current=false;setBusy(false);}
 };
 return <Card className="border-slate-200 shadow-sm"><CardHeader><CardTitle>Join your OJT class</CardTitle><CardDescription>Ask your adviser for the class code. Your account must match the class program and section, and your adviser must approve your request.</CardDescription></CardHeader><CardContent className="space-y-4">
  <form onSubmit={e=>{e.preventDefault();void submit();}} className="flex flex-wrap items-end gap-3"><div className="w-full max-w-xs space-y-2"><Label htmlFor="student-class-code">Class code</Label><Input id="student-class-code" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={10} placeholder="Enter class code" value={code} disabled={busy} onChange={e=>setCode(e.target.value.toUpperCase())}/></div><Button type="submit" className="bg-[#800000] text-white" disabled={busy||code.trim().length!==10}>{busy?'Sending…':'Request to join'}</Button></form>
  {error&&<p role="alert" className="text-sm text-red-800">{error}<Button variant="outline" className="ml-3" disabled={busy} onClick={()=>setReload(v=>v+1)}>Refresh status</Button></p>}
  {requests.map(request=><div key={request.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm"><p className="font-semibold text-slate-800">{request.programCode} · {request.section} · {request.academicYear} · {termLabel(request.semester)}</p><p className="mt-1 text-slate-600">Adviser: {request.adviserName}</p><p className="mt-1 text-[#800000]">{request.status==='pending'?'Pending adviser approval — your OJT features remain locked.':request.status==='approved'?'Approved — updating your enrollment…':'Request declined. Contact your adviser.'}</p>{request.reason&&<p className="mt-1 text-slate-600">{request.reason}</p>}</div>)}
 </CardContent></Card>;
}
