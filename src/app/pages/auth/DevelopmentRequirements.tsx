import { useEffect, useRef, useState } from 'react';
import { useProtectedIdentity } from '../../context/useProtectedIdentity';
import { getSupabaseClient } from '../../lib/supabaseClient';
import { backendRpc,listEnrollments,type EnrollmentProjection } from '../../lib/backendGateway';
import { moaStatuses } from '../../domain/contracts';
import type { IdentityRole } from '../../lib/protectedIdentity';
import { listLiveRequirements, newRequirementUpload, requirementCommand, requirementDownload, requirementPayload,
  uploadLiveRequirement, type LiveRequirement, type PendingRequirementUpload } from '../../lib/requirementGateway';

/** Real local workflow, isolated from mock AuthContext/OJTContext. */
export function DevelopmentRequirements({portal=false,moaOnly=false}:{portal?:boolean;moaOnly?:boolean}={}){
  const local=(()=>{try{const url=new URL(import.meta.env.VITE_SUPABASE_URL||'');return url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.port==='54321';}catch{return false;}})();
  const {result,refresh}=useProtectedIdentity(portal||local);
  const identity=result.state==='loaded'?result.identity:null;
  const ready=identity?.state==='ready'?identity:null;
  const [role,setRole]=useState<IdentityRole>('student');
  const [rows,setRows]=useState<LiveRequirement[]>([]);
  const [enrollments,setEnrollments]=useState<EnrollmentProjection[]>([]);
  const [moaTargets,setMoaTargets]=useState<Record<string,string>>({});
  const [moaEvidence,setMoaEvidence]=useState<Record<string,string>>({});
  const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
  const [files,setFiles]=useState<Record<string,File>>({});
  const [remarks,setRemarks]=useState<Record<string,string>>({});
  const [downloads,setDownloads]=useState<Record<string,string>>({});
  const generation=useRef(0);
  const reviewRetry=useRef<{key:string;id:string;payload:Record<string,unknown>}|null>(null);
  const [reload,setReload]=useState(0);
  const selectedRole=portal?(ready?.usableRoles.includes('coordinator')?'coordinator':undefined):ready?.usableRoles.includes(role)?role:ready?.usableRoles[0];
  useEffect(()=>{
    const request=++generation.current;let alive=true;
    setRows([]);setEnrollments([]);setMoaTargets({});setMoaEvidence({});setFiles({});setDownloads({});setRemarks({});reviewRetry.current=null;
    if(!ready||!selectedRole)return;
    setBusy(true);setMessage('Loading saved requirements…');
    Promise.all([listLiveRequirements(selectedRole),listEnrollments(selectedRole)]).then(([data,records])=>{if(alive&&request===generation.current){setRows(data);setEnrollments(records);setMessage(data.length?'Loaded from Supabase.':'No published requirements are assigned to this account.');}})
      .catch(error=>{if(alive&&request===generation.current)setMessage(error instanceof Error?error.message:'Requirements unavailable.');})
      .finally(()=>{if(alive&&request===generation.current)setBusy(false);});
    return()=>{alive=false;};
  },[ready,selectedRole,reload]);
  const run=async(action:()=>Promise<void>)=>{
    const request=generation.current;setBusy(true);
    try{await action();if(request===generation.current){setMessage('Saved to Supabase.');setReload(v=>v+1);}}
    catch(error){if(request===generation.current)setMessage(error instanceof Error?error.message:'Operation failed. Retry.');}
    finally{if(request===generation.current)setBusy(false);}
  };
  if(!portal&&!local)return <main className="p-8">This workspace requires local Supabase on port 54321.</main>;
  const keyFor=(id:string)=>`intrack-local-upload:${ready?.profile.id}:${id}`;
  const readPending=(id:string):PendingRequirementUpload|null=>{try{return JSON.parse(localStorage.getItem(keyFor(id))||'null');}catch{return null;}};
  const specialized=async(name:string,payload:Record<string,unknown>)=>{const key=JSON.stringify({name,payload});
    if(reviewRetry.current?.key!==key)reviewRetry.current={key,id:crypto.randomUUID(),payload};
    await backendRpc(name,{command_id:reviewRetry.current.id,payload});reviewRetry.current=null;};
  return <main className="mx-auto max-w-5xl space-y-5 p-6">
    <h1 className="text-3xl font-bold">{moaOnly?'MOA Management':'Requirements Review'}</h1>
    {!portal&&<><p>Uploads and decisions here are saved to your local database and private storage. Use synthetic accounts and sample files for this development test.</p>
    <div className="flex flex-wrap gap-4"><a className="underline" href="/?authSetup=1">Sign in / account setup / staff MFA</a>
      <a className="underline" href="/">Demo system</a>
      <button className="underline" onClick={()=>void refresh()}>Check account access</button>
      <button className="underline" onClick={()=>void getSupabaseClient().auth.signOut().then(()=>refresh())}>Sign out</button></div></>}
    <p role="status" aria-live="polite">{message||`Account: ${identity?.state||result.state}`}</p>
    {!ready && <p>Sign in and complete account setup. Advisers and coordinators must also verify MFA before opening requirements.</p>}
    {ready&&selectedRole&&<>
      <p>Signed in as {ready.profile.displayName}.</p>
      {!portal&&<label>Use role <select className="ml-2 rounded border p-2" disabled={busy} value={selectedRole} onChange={e=>setRole(e.target.value as IdentityRole)}>
        {ready.usableRoles.map(r=><option key={r} value={r}>{r}</option>)}</select></label>}
      <button className="ml-4 rounded border p-2" disabled={busy} onClick={()=>setReload(v=>v+1)}>Refresh saved records</button>
      <fieldset disabled={busy} className="space-y-5">
      {rows.filter(row=>!moaOnly||row.evidenceType==='moa').map(row=>{
        const pending=selectedRole==='student'?readPending(row.id):null;
        const canUpload=['file','moa'].includes(row.evidenceType)&&!row.waived&&row.outcome==='active'&&row.allowedStages.includes(row.lifecycle)
          &&(!row.submission||['needs_revision','rejected','withdrawn'].includes(row.submission.status)||(row.evidenceType==='moa'&&row.submission.status==='approved'));
        const canReview=selectedRole!=='student'&&['file','staff_verification'].includes(row.evidenceType)&&row.outcome==='active'&&row.submission&&['submitted','under_review'].includes(row.submission.status);
        return <section key={row.id} className="space-y-3 rounded-xl border bg-white p-5">
          <h2 className="text-xl font-bold">{row.title}</h2>
          <p>{row.studentName} · {row.programCode} · Reviewer: {row.reviewer}</p>
          <p>Status: <strong>{row.submission?.status||'Not submitted'}</strong>{row.submission&&` · Version ${row.submission.version} · ${new Date(row.submission.submittedAt).toLocaleString()}`}</p>
          {!['file','moa','staff_verification'].includes(row.evidenceType)&&<p>This requirement uses a specialized workflow and cannot be submitted here.</p>}
          {row.evidenceType==='moa'&&<p>Coordinator-recorded MOA status: {enrollments.find(e=>e.id===row.enrollmentId)?.moaStatus||'Unavailable'}. Uploading a new copy preserves the recorded status of the previous copy.</p>}
          {row.evidenceType==='staff_verification'&&selectedRole==='student'&&row.outcome==='active'&&(!row.submission||['needs_revision','rejected','withdrawn'].includes(row.submission.status))&&<div>
            <label className="block">Physical evidence request<textarea className="block w-full border p-2" maxLength={4000} value={remarks[row.id]||''} onChange={e=>setRemarks(v=>({...v,[row.id]:e.target.value}))}/></label>
            <button className="rounded border p-2" disabled={!remarks[row.id]?.trim()} onClick={()=>void run(async()=>{await specialized('intrack_submit_physical_requirement',{...requirementPayload(row),note:remarks[row.id]});})}>Request staff verification</button>
          </div>}
          {selectedRole==='student'&&(canUpload||pending)&&<div className="space-y-2">
            {pending&&<p>Pending upload: {pending.name}. Retry preserves the same operation IDs. If already uploaded, you can retry submission without reselecting it.</p>}
            <label className="block">Evidence file (PDF, JPEG or PNG, maximum 10 MB)
              <input className="block" type="file" accept="application/pdf,image/jpeg,image/png" onChange={e=>{
                const file=e.target.files?.[0];setFiles(current=>{const next={...current};if(file)next[row.id]=file;else delete next[row.id];return next;});
              }}/></label>
            <button className="rounded border p-2" disabled={!pending&&!files[row.id]} onClick={()=>void run(async()=>{
              const operation=pending||newRequirementUpload(row,files[row.id]);
              const save=(next:PendingRequirementUpload)=>localStorage.setItem(keyFor(row.id),JSON.stringify(next));
              save(operation);await uploadLiveRequirement(operation,files[row.id],save);localStorage.removeItem(keyFor(row.id));
            })}>{pending?'Retry upload / submission':'Upload and submit'}</button>
            {pending&&<button className="ml-3 rounded border p-2" onClick={()=>{localStorage.removeItem(keyFor(row.id));setReload(v=>v+1);}}>Discard pending operation</button>}
          </div>}
          {selectedRole==='student'&&row.submission?.status==='submitted'&&!row.submission.reviewStartedAt&&
            <button className="rounded border p-2" onClick={()=>void run(async()=>{await requirementCommand('withdraw',requirementPayload(row),crypto.randomUUID());})}>Withdraw before review</button>}
          {canReview&&<div className="space-y-2">
            <label className="block">Remarks (required for revisions and rejection)<textarea className="block w-full rounded border p-2" maxLength={4000} value={remarks[row.id]||''} onChange={e=>setRemarks(v=>({...v,[row.id]:e.target.value}))}/></label>
            <div className="flex flex-wrap gap-2">{[['start_review','Start review'],['approve','Approve'],['request_revision','Request revision'],['reject','Reject']].map(([action,label])=>
              <button key={action} className="rounded border p-2" onClick={()=>void run(async()=>{
                const payload={...requirementPayload(row),role:selectedRole,remarks:remarks[row.id]||''};
                const key=JSON.stringify({action,payload});
                if(reviewRetry.current?.key!==key)reviewRetry.current={key,id:crypto.randomUUID(),payload};
                await requirementCommand(action,reviewRetry.current.payload,reviewRetry.current.id);reviewRetry.current=null;
              })}>{label}</button>)}</div>
            <p className="text-sm">The server enforces reviewer order and prevents reviewing your own records.</p>
            {row.evidenceType==='staff_verification'&&<button className="rounded border p-2" disabled={!remarks[row.id]?.trim()} onClick={()=>void run(async()=>{await specialized('intrack_verify_physical_requirement',{...requirementPayload(row),role:selectedRole,note:remarks[row.id]});})}>Record actual physical verification</button>}
          </div>}
          {row.evidenceType==='moa'&&selectedRole==='coordinator'&&row.outcome==='active'&&<div className="space-y-2">
            <label>MOA routing status<select className="ml-3 border p-2" value={moaTargets[row.id]||'NO MOA'} onChange={e=>setMoaTargets(v=>({...v,[row.id]:e.target.value}))}>{moaStatuses.map(status=><option key={status}>{status}</option>)}</select></label>
            <label className="block">Routing reason<textarea className="block w-full border p-2" maxLength={1000} value={remarks[row.id]||''} onChange={e=>setRemarks(v=>({...v,[row.id]:e.target.value}))}/></label>
            <label className="block">Factual notarization or SAS submission evidence<textarea className="block w-full border p-2" maxLength={4000} value={moaEvidence[row.id]||''} onChange={e=>setMoaEvidence(v=>({...v,[row.id]:e.target.value}))}/></label>
            <button className="rounded border p-2" disabled={!remarks[row.id]?.trim()} onClick={()=>void run(async()=>{const status=moaTargets[row.id]||'NO MOA';await specialized('intrack_route_moa',{...requirementPayload(row),submissionId:status==='NO MOA'?null:row.submission?.id,status,reason:remarks[row.id],evidenceNote:moaEvidence[row.id]||''});})}>Save coordinator MOA status</button>
          </div>}
          {selectedRole==='coordinator'&&row.outcome==='active'&&!row.waived&&<div><label className="block">Authorized waiver reason<input className="ml-3 border p-2" maxLength={1000} value={remarks[row.id]||''} onChange={e=>setRemarks(v=>({...v,[row.id]:e.target.value}))}/></label>
            <button className="rounded border p-2" disabled={!remarks[row.id]?.trim()} onClick={()=>void run(async()=>{await specialized('intrack_waive_requirement',{...requirementPayload(row),expectedRequirementRevision:row.requirementRevision,waive:true,reason:remarks[row.id]});})}>Record authorized waiver</button>
          </div>}
          <details><summary className="cursor-pointer">Submission and review history ({row.history.length})</summary>
            {row.history.map(version=><div key={version.id} className="my-3 rounded border p-3">
              <p>Version {version.version} · {version.status} · {new Date(version.submittedAt).toLocaleString()}</p>
              {version.documentId&&<button className="underline" onClick={()=>{const request=generation.current;setBusy(true);void requirementDownload(version.documentId!,selectedRole).then(url=>{
                if(request===generation.current)setDownloads(v=>({...v,[version.id]:url}));
              }).catch(error=>{if(request===generation.current)setMessage(error instanceof Error?error.message:'Download failed.');}).finally(()=>{if(request===generation.current)setBusy(false);});}}>Get download link</button>}
              {downloads[version.id]&&<a className="ml-3 underline" href={downloads[version.id]} target="_blank" rel="noopener noreferrer">Download (link valid for 60 seconds)</a>}
              {version.reviews.map((review,i)=><p key={i}>{review.role}: {review.decision} · {new Date(review.at).toLocaleString()} {review.remarks&&`— ${review.remarks}`}</p>)}
              {version.verifications?.map((v,i)=><p key={`verification-${i}`}>Physical verification: {new Date(v.verifiedAt).toLocaleString()} — {v.note}</p>)}
            </div>)}
          </details>
        </section>;
      })}
      </fieldset>
    </>}
  </main>;
}
