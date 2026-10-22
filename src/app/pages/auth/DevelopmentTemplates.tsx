import {useEffect,useRef,useState} from 'react';
import {useProtectedIdentity} from '../../context/useProtectedIdentity';
import {getSupabaseClient} from '../../lib/supabaseClient';
import {backendRpc} from '../../lib/backendGateway';
import type {IdentityRole} from '../../lib/protectedIdentity';
type Template={id:string;code:string;title:string;stage:string;version:number;status:string;byte_count:number};
type Pending={profileId:string;uploadId:string;path:string;programCode:string;commandId:string;approvalReference:string};
export function DevelopmentTemplates({portal=false}:{portal?:boolean}={}){
 const local=(()=>{try{const u=new URL(import.meta.env.VITE_SUPABASE_URL||'');return u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)&&u.port==='54321';}catch{return false;}})();
 const {result,refresh}=useProtectedIdentity(portal||local);const ready=result.state==='loaded'&&result.identity.state==='ready'?result.identity:null;
 const [program,setProgram]=useState('BSIT'),[role,setRole]=useState<IdentityRole>('student');
 const [rows,setRows]=useState<Template[]>([]),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const [code,setCode]=useState(''),[title,setTitle]=useState(''),[stage,setStage]=useState('pre'),[approval,setApproval]=useState('');
 const [file,setFile]=useState<File|null>(null),[pending,setPending]=useState<Pending|null>(null),[download,setDownload]=useState<string|null>(null);
 const [archiveReasons,setArchiveReasons]=useState<Record<string,string>>({});
 const generation=useRef(0),operation=useRef<{payload:Record<string,unknown>;id:string}|null>(null);
 useEffect(()=>{if(portal&&ready){const codes=ready.memberships.filter(m=>m.role==='coordinator').map(m=>m.programCode);if(codes.length&&!codes.includes(program))setProgram(codes[0]);}},[portal,ready,program]);
 const selectedRole=portal?(ready?.usableRoles.includes('coordinator')?'coordinator':undefined):ready?.usableRoles.includes(role)?role:ready?.usableRoles[0];
 useEffect(()=>{const n=++generation.current;let alive=true;setRows([]);setDownload(null);setFile(null);setPending(null);setArchiveReasons({});operation.current=null;
  if(!ready||!selectedRole)return;
  const key=`intrack-template:${ready.profile.id}:${program}`;
  try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved?.profileId===ready.profile.id)setPending(saved);}catch{}
  setBusy(true);backendRpc<Template[]>('intrack_list_templates',{program_code:program,actor_role:selectedRole,page_offset:0})
   .then(data=>{if(alive&&n===generation.current)setRows(data);})
   .catch(error=>{if(alive&&n===generation.current)setMessage(error.message);})
   .finally(()=>{if(alive&&n===generation.current)setBusy(false);});return()=>{alive=false;};
 },[ready,selectedRole,program,reload]);
 const run=async(action:()=>Promise<void>)=>{const n=generation.current;setBusy(true);setMessage('Working…');try{await action();if(n===generation.current){setMessage('Saved.');setReload(v=>v+1);}}catch(error){if(n===generation.current)setMessage(error instanceof Error?error.message:'Operation unavailable');}finally{if(n===generation.current)setBusy(false);}};
 const invoke=async(body:unknown)=>{const {data,error}=await getSupabaseClient().functions.invoke('template-files',{body});if(error){let text='Template service unavailable. Retry the saved command.';try{text=(await error.context.json()).error||text;}catch{}throw new Error(text);}return data;};
 const publish=async()=>{
  if(!ready)throw new Error('Sign in first');const profileId=ready.profile.id,key=`intrack-template:${profileId}:${program}`,n=generation.current;
  let saved=pending;
  if(!saved){if(!file||!approval.trim())throw new Error('Select a PDF and provide an approval reference');
   const payload={programCode:program,code:code.trim().toUpperCase(),title:title.trim(),stage,name:file.name,mimeType:'application/pdf',bytes:file.size};
   if(!operation.current||JSON.stringify(operation.current.payload)!==JSON.stringify(payload))operation.current={payload,id:crypto.randomUUID()};
   const reservation=await backendRpc<{uploadId:string;path:string}>('intrack_template_command',{command_id:operation.current.id,action:'reserve',payload});
   saved={profileId,...reservation,programCode:program,commandId:crypto.randomUUID(),approvalReference:approval.trim()};
   sessionStorage.setItem(key,JSON.stringify(saved));if(n===generation.current)setPending(saved);operation.current=null;
  }
  if(n!==generation.current)throw new Error('Account or program changed. Reopen the saved upload.');
  const context=await backendRpc<{state:string}>('intrack_template_upload_context',{upload_id:saved.uploadId});
  if(context.state==='pending'){
   // A lost response may mean bytes already exist. Never overwrite: let the
   // server validate an existing object before asking for another upload.
   if(file){const {error}=await getSupabaseClient().storage.from('ojt-templates').upload(saved.path,file,{contentType:'application/pdf',upsert:false});
    if(error&&String(error.statusCode)!=='409'&&String(error.statusCode)!=='400')throw new Error(error.message);}
  }
  if(n!==generation.current)throw new Error('Account changed; publication paused');
  await invoke({action:'publish',commandId:saved.commandId,payload:{programCode:saved.programCode,uploadId:saved.uploadId,approvalReference:saved.approvalReference}});
  sessionStorage.removeItem(key);if(n===generation.current)setPending(null);
 };
 if(!portal&&!local)return <main className="p-8">This test workspace requires local Supabase.</main>;
 return <main className="mx-auto max-w-4xl space-y-5 p-6"><h1 className="text-3xl font-bold">Private templates</h1>
  <p>Real local files and saved versions. PDF support is available; Word validation and malware scanning remain release work.</p>
  {!portal&&<><a className="underline" href="/?authSetup=1">Sign in / account setup</a><button className="ml-5 underline" onClick={()=>void refresh()}>Check access</button></>}
  <p role="status" aria-live="polite">{message||`Account: ${ready?.profile.displayName||result.state}`}</p>
  {ready&&selectedRole&&<><fieldset disabled={busy} className="space-y-4">
   <label>Program <select className="border p-2" value={program} onChange={e=>setProgram(e.target.value)}>{(portal?Array.from(new Set(ready.memberships.filter(m=>m.role==='coordinator').map(m=>m.programCode))):['BSIT','BSHM','BSCPE','BSOA']).map(p=><option key={p}>{p}</option>)}</select></label>
   {!portal&&<label className="ml-4">Role <select className="border p-2" value={selectedRole} onChange={e=>setRole(e.target.value as IdentityRole)}>{ready.usableRoles.map(r=><option key={r}>{r}</option>)}</select></label>}
   {selectedRole==='coordinator'&&<section className="space-y-3 rounded border p-4"><h2 className="text-xl font-bold">Publish a new version</h2>
    {pending?<p>Saved upload {pending.uploadId}. Retry publication; select the original file only if bytes were never uploaded.</p>:<>
     <label className="block">Code <input className="border p-2" value={code} onChange={e=>setCode(e.target.value)}/></label>
     <label className="block">Title <input className="border p-2" value={title} onChange={e=>setTitle(e.target.value)}/></label>
     <label className="block">Stage <select className="border p-2" value={stage} onChange={e=>setStage(e.target.value)}>{['pre','during','post','portfolio','evaluation'].map(s=><option key={s}>{s}</option>)}</select></label>
     <label className="block">Approval reference <input className="border p-2" value={approval} onChange={e=>setApproval(e.target.value)}/></label></>}
    <label className="block">PDF <input type="file" accept="application/pdf,.pdf" onChange={e=>setFile(e.target.files?.[0]||null)}/></label>
    <button className="rounded border p-2" onClick={()=>void run(publish)}>{pending?'Retry publication':'Upload and publish'}</button></section>}
   {rows.map(t=><article className="flex flex-wrap items-center justify-between gap-3 rounded border p-4" key={t.id}><div><h2 className="font-bold">{t.title} — v{t.version}</h2><p>{t.code} · {t.stage} · {t.status}</p></div>
    {selectedRole==='coordinator'&&t.status==='published'&&<details><summary>Archive this version</summary><label>Reason <input className="border p-2" maxLength={1000} value={archiveReasons[t.id]||''} onChange={e=>setArchiveReasons(previous=>({...previous,[t.id]:e.target.value}))}/></label>
     <button className="border p-2" disabled={!archiveReasons[t.id]?.trim()} onClick={()=>void run(async()=>{const payload={programCode:program,templateId:t.id,reason:archiveReasons[t.id].trim()};
      if(!operation.current||JSON.stringify(operation.current.payload)!==JSON.stringify(payload))operation.current={payload,id:crypto.randomUUID()};
      await backendRpc('intrack_template_command',{command_id:operation.current.id,action:'archive',payload});operation.current=null;
     })}>Archive version</button></details>}
    <button className="border p-2" onClick={()=>{const n=generation.current;setDownload(null);setBusy(true);void invoke({action:'download',templateId:t.id,role:selectedRole}).then(data=>{if(n===generation.current)setDownload(data.url);}).catch(error=>{if(n===generation.current)setMessage(error.message);}).finally(()=>{if(n===generation.current)setBusy(false);});}}>Prepare download</button></article>)}
  </fieldset>{download&&<a href={download} className="underline" referrerPolicy="no-referrer">Download PDF — link expires after 60 seconds</a>}
  <p>Shows up to 100 versions. Earlier records remain stored.</p></>}
 </main>;
}
