import {useEffect,useRef,useState} from 'react';
import {useProtectedIdentity} from '../../context/useProtectedIdentity';
import type {IdentityRole} from '../../lib/protectedIdentity';
import {getSupabaseClient} from '../../lib/supabaseClient';
import {backendRpc,listEnrollments,administrationDirectory,inviteAccount,type AdministrationDirectory,type EnrollmentProjection} from '../../lib/backendGateway';
import {parseMasterlistCsv} from '../../lib/masterlistCsv';
import {EnrollmentReports} from '../../components/backend/EnrollmentReports';

export function DevelopmentBackend(){
  const local=(()=>{try{const u=new URL(import.meta.env.VITE_SUPABASE_URL||'');return u.protocol==='http:'&&['localhost','127.0.0.1'].includes(u.hostname)&&u.port==='54321';}catch{return false;}})();
  const {result,refresh}=useProtectedIdentity(local);const ready=result.state==='loaded'&&result.identity.state==='ready'?result.identity:null;
  const [role,setRole]=useState<IdentityRole>('student');const current=ready?.usableRoles.includes(role)?role:ready?.usableRoles[0];
  const [enrollments,setEnrollments]=useState<EnrollmentProjection[]>([]),[directory,setDirectory]=useState<AdministrationDirectory|null>(null);
  const [notices,setNotices]=useState<{items:any[];unreadCount:number}>({items:[],unreadCount:0});const [announcements,setAnnouncements]=useState<any[]>([]);
  const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[reload,setReload]=useState(0);
  const [csv,setCsv]=useState('studentNumber,email,name,programCode,section\n');const [preview,setPreview]=useState<any>(null);
  const [policy,setPolicy]=useState(''),[student,setStudent]=useState(''),[term,setTerm]=useState(''),[adviser,setAdviser]=useState('');
  const [policyJson,setPolicyJson]=useState(''),[reason,setReason]=useState('');
  const [placementJson,setPlacementJson]=useState('');
  const [adviserEmail,setAdviserEmail]=useState(''),[adviserName,setAdviserName]=useState(''),[adviserProgram,setAdviserProgram]=useState('');
  const [invitations,setInvitations]=useState<any[]>([]);
  const [recipient,setRecipient]=useState(''),[body,setBody]=useState(''),[selectedEnrollment,setSelectedEnrollment]=useState(''),[messages,setMessages]=useState<any[]>([]);
  const generation=useRef(0),retry=useRef<{key:string;id:string}|null>(null);
  useEffect(()=>{let alive=true;const request=++generation.current;
    setEnrollments([]);setDirectory(null);setNotices({items:[],unreadCount:0});setAnnouncements([]);setMessages([]);setPreview(null);
    setCsv('studentNumber,email,name,programCode,section\n');setPolicyJson('');setBody('');setRecipient('');setReason('');retry.current=null;
    setPolicy('');setStudent('');setTerm('');setAdviser('');setSelectedEnrollment('');setPlacementJson('');
    setAdviserEmail('');setAdviserName('');setAdviserProgram('');
    setInvitations([]);
    if(!ready||!current)return;setBusy(true);setMessage('Loading protected records…');
    Promise.all([listEnrollments(current),backendRpc<any>('intrack_list_notifications',{actor_role:current}),backendRpc<any>('intrack_list_announcements',{actor_role:current}),current==='coordinator'?administrationDirectory():Promise.resolve(null),current==='coordinator'?backendRpc<any[]>('intrack_list_account_invitations'):Promise.resolve([])])
      .then(([e,n,a,d,i])=>{if(alive&&request===generation.current){setEnrollments(e);setNotices(n);setAnnouncements(a.items);setDirectory(d);setInvitations(i);setMessage('Loaded from local Supabase.');}})
      .catch(error=>{if(alive&&request===generation.current)setMessage(error instanceof Error?error.message:'Backend unavailable.');})
      .finally(()=>{if(alive&&request===generation.current)setBusy(false);});return()=>{alive=false;};
  },[ready,current,reload]);
  const run=async(action:(isCurrent:()=>boolean)=>Promise<void>,refetch=true)=>{const request=generation.current;setBusy(true);
    try{await action(()=>request===generation.current);if(request===generation.current){setMessage('Operation confirmed.');if(refetch)setReload(v=>v+1);}}
    catch(error){if(request===generation.current)setMessage(error instanceof Error?error.message:'Operation unavailable; retry.');}
    finally{if(request===generation.current)setBusy(false);}};
  const mutate=async(name:string,args:Record<string,unknown>)=>{const key=JSON.stringify({name,args});if(retry.current?.key!==key)retry.current={key,id:crypto.randomUUID()};
    const data=await backendRpc(name,{...args,command_id:retry.current.id});retry.current=null;return data;};
  if(!local)return <main className="p-8">This development workspace requires local Supabase.</main>;
  return <main className="mx-auto max-w-6xl space-y-5 p-6">
    <h1 className="text-3xl font-bold">Local backend workspace</h1>
    <p>Real protected database records. University settings remain unset until approved values are supplied.</p>
    <nav className="flex flex-wrap gap-4"><a className="underline" href="/?authSetup=1">Account setup / MFA</a><a className="underline" href="/?requirementsTest=1">Requirements</a><a className="underline" href="/?trainingTest=1">Attendance / academics</a><a className="underline" href="/?templatesTest=1">Private templates</a><a className="underline" href="/">Demo</a>
      <button className="underline" onClick={()=>void getSupabaseClient().auth.signOut().then(()=>refresh())}>Sign out</button></nav>
    <p role="status" aria-live="polite">{message||result.state}</p>
    {!ready&&<p>Complete protected account setup and staff MFA to access these records.</p>}
    {ready&&current&&<><label>Role <select disabled={busy} className="rounded border p-2" value={current} onChange={e=>setRole(e.target.value as IdentityRole)}>{ready.usableRoles.map(r=><option key={r}>{r}</option>)}</select></label>
      <button disabled={busy} className="ml-3 rounded border p-2" onClick={()=>setReload(v=>v+1)}>Refresh saved records</button>
      <fieldset disabled={busy} className="space-y-5">
        <EnrollmentReports key={`${ready.profile.id}:${current}`} role={current} profileId={ready.profile.id}/>
        <section className="rounded border p-4"><h2 className="text-xl font-bold">Enrollments</h2>
          {!enrollments.length&&<p>No accessible enrollments.</p>}{enrollments.map(e=><article className="my-3 border-t pt-3" key={e.id}>
            <h3 className="font-bold">{e.studentName} · {e.programCode} · Component {e.component}</h3>
            <p>Stage: {e.lifecycle} · Outcome: {e.outcome} · Clearance: {e.clearance} · MOA: {e.moaStatus}</p>
            <p>Approved hours: {e.creditedMinutes/60} / {e.requiredMinutes/60} · Remaining: {e.remainingMinutes/60} · Open sessions: {e.openSessions}</p>
            {current==='coordinator'&&<button className="underline" disabled={!adviser||!reason.trim()} onClick={()=>void run(async()=>{await mutate('intrack_assign_adviser',{enrollment_id:e.id,expected_revision:e.revision,adviser_id:adviser,reason});})}>Assign selected adviser</button>}
            {current==='coordinator'&&e.outcome==='active'&&e.studentId!==ready.profile.id&&<div className="my-3 flex flex-wrap gap-2">
              {['issue_clearance','resume_clearance','suspend_clearance','revoke_clearance','enter_post_ojt','enter_portfolio','return_to_training','withdraw'].map(action=>
                <button className="rounded border p-2" disabled={!reason.trim()} key={action} onClick={()=>void run(async()=>{await mutate('intrack_lifecycle_command',{payload:{enrollmentId:e.id,expectedEnrollmentRevision:e.revision,action,reason}});})}>{action.replaceAll('_',' ')}</button>)}
              <p className="w-full text-sm">Actions require the administration reason below. The server rejects unavailable transitions and missing policy/evidence.</p>
            </div>}
          </article>)}</section>
        {directory&&<section className="space-y-4 rounded border p-4"><h2 className="text-xl font-bold">Coordinator administration</h2>
          {directory.programs.map(p=><p key={p.id}>{p.code}: student domains {p.studentDomains.join(', ')||'not configured'}; staff domains {p.staffDomains.join(', ')||'not configured'}</p>)}
          <details><summary>Masterlist dry run and import</summary>
            <label className="block">Approved masterlist CSV<textarea className="block h-40 w-full border p-2" value={csv} onChange={e=>{setCsv(e.target.value);setPreview(null);}}/></label>
            <button className="rounded border p-2" onClick={()=>void run(async isCurrent=>{const data=await backendRpc<any>('intrack_preview_masterlist',{rows:parseMasterlistCsv(csv)});if(isCurrent())setPreview(data);},false)}>Validate without importing</button>
            {preview&&<><p>New: {preview.newCount??0}; unchanged: {preview.existingCount??0}</p>{preview.issues?.map((issue:any,i:number)=><p key={i}>Row {issue.row}: {issue.message}</p>)}
              {preview.validationToken&&<button className="rounded border p-2" onClick={()=>void run(async()=>{await mutate('intrack_commit_masterlist',{validation_token:preview.validationToken});setPreview(null);})}>Commit validated import</button>}</>}
          </details>
          <details><summary>Publish approved policy</summary><p>Paste the approved publication payload. No proposed defaults are prefilled.</p>
            <textarea aria-label="Approved policy payload" className="block h-40 w-full border p-2" value={policyJson} onChange={e=>setPolicyJson(e.target.value)}/>
            <button className="rounded border p-2" disabled={!policyJson.trim()} onClick={()=>void run(async()=>{await mutate('intrack_publish_policy',{payload:JSON.parse(policyJson)});})}>Publish new policy version</button>
          </details>
          <details><summary>Whitelist approved accounts</summary>
            <p className="text-sm">New accounts use the shared default configured privately on the server. Supply it to whitelisted users through your approved channel. It is never shown or stored in this page.</p>
            {directory.eligibleStudents.map(s=><div className="my-2" key={s.id}>{s.name} · {s.studentNumber} · {s.email}
              <button className="ml-3 underline" onClick={()=>void run(async()=>{const original=invitations.find(i=>i.profileId===s.profileId);await inviteAccount(ready.profile.id,original?.payload||{role:'student',eligibleStudentId:s.id},original);})}>{s.profileId?'Resume whitelist setup':'Whitelist student'}</button></div>)}
            {invitations.map(i=><div className="my-2" key={i.id}>Invitation: {i.state}{i.expired?' (expired; trusted resend required)':''}
              {!i.expired&&i.state==='reserved'&&<button className="ml-3 underline" onClick={()=>void run(async()=>{await inviteAccount(ready.profile.id,i.payload,i);})}>Resume whitelist setup</button>}</div>)}
            <label className="block">Adviser name<input className="ml-3 border p-2" maxLength={240} value={adviserName} onChange={e=>setAdviserName(e.target.value)}/></label>
            <label className="block">Approved staff email<input className="ml-3 border p-2" type="email" value={adviserEmail} onChange={e=>setAdviserEmail(e.target.value)}/></label>
            <label className="block">Program<select className="ml-3 border p-2" value={adviserProgram} onChange={e=>setAdviserProgram(e.target.value)}><option value="">Select</option>{directory.programs.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select></label>
            <button className="rounded border p-2" disabled={!adviserProgram||!adviserName.trim()||!adviserEmail.trim()} onClick={()=>void run(async()=>{await inviteAccount(ready.profile.id,{role:'adviser',programId:adviserProgram,name:adviserName.trim(),email:adviserEmail.trim().toLowerCase()});})}>Whitelist adviser</button>
            <p>Whitelisting creates a pending account with the provided password. The user signs in, verifies their emailed OTP, then completes the password decision to activate. Existing active identities receive only an authorized membership; their passwords are preserved.</p>
          </details>
          <div className="flex flex-wrap gap-3">
            <label>Student<select className="block border p-2" value={student} onChange={e=>setStudent(e.target.value)}><option value="">Select</option>{directory.memberships.filter(m=>m.role==='student'&&m.active).map(m=><option key={m.id} value={m.profileId}>{m.name}</option>)}</select></label>
            <label>Published policy<select className="block border p-2" value={policy} onChange={e=>setPolicy(e.target.value)}><option value="">Select</option>{directory.policies.filter(p=>p.published).map(p=><option key={p.id} value={p.id}>Component {p.component}, version {p.version}, {p.requiredMinutes/60} hours</option>)}</select></label>
            <label>Academic term<select className="block border p-2" value={term} onChange={e=>setTerm(e.target.value)}><option value="">Select</option>{directory.terms.map(t=><option key={t.id} value={t.id}>{t.academic_year} / {t.semester}</option>)}</select></label>
            <button className="rounded border p-2" disabled={!student||!policy||!term} onClick={()=>void run(async()=>{await mutate('intrack_enroll_student',{payload:{studentId:student,policyId:policy,termId:term}});})}>Create enrollment</button>
          </div>
          <label className="block">Adviser for assignment<select className="ml-3 border p-2" value={adviser} onChange={e=>setAdviser(e.target.value)}><option value="">Select</option>{directory.memberships.filter(m=>m.role==='adviser'&&m.active).map(m=><option key={m.id} value={m.profileId}>{m.name}</option>)}</select></label>
          <label className="block">Administration reason<input className="ml-3 border p-2" maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label>
          <details><summary>Configure an approved placement</summary><p>Paste the placement payload with enrollment ID, expected revision, company, dates, geofence, explicit schedule/breaks and approval reference.</p>
            <textarea aria-label="Approved placement payload" className="block h-40 w-full border p-2" maxLength={524288} value={placementJson} onChange={e=>setPlacementJson(e.target.value)}/>
            <button className="rounded border p-2" disabled={!placementJson.trim()} onClick={()=>void run(async()=>{await mutate('intrack_configure_placement',{payload:JSON.parse(placementJson)});})}>Save approved placement</button>
          </details>
          <details><summary>Protected memberships</summary>{directory.memberships.map(m=><div className="my-2" key={m.id}>{m.name} · {m.role} · {m.active?'active':'revoked'}
            {m.profileId!==ready.profile.id&&m.role!=='coordinator'&&<button className="ml-3 underline" disabled={!reason.trim()} onClick={()=>void run(async()=>{await mutate('intrack_set_membership',{membership_id:m.id,expected_revision:m.revision,make_active:!m.active,reason});})}>{m.active?'Revoke membership':'Restore membership'}</button>}</div>)}</details>
        </section>}
        <section className="rounded border p-4"><h2 className="text-xl font-bold">Notifications ({notices.unreadCount} unread)</h2>
          {notices.items.map(n=><div className="my-2" key={n.id}>{n.content.kind} · {new Date(n.created_at).toLocaleString()}
            {!n.read_at&&<button className="ml-3 underline" onClick={()=>void run(async()=>{await mutate('intrack_read_notification',{notification_id:n.id,actor_role:current});})}>Mark read</button>}</div>)}
        </section>
        <section className="space-y-3 rounded border p-4"><h2 className="text-xl font-bold">Messages</h2>
          <label>Enrollment<select className="ml-3 border p-2" value={selectedEnrollment} onChange={e=>{setSelectedEnrollment(e.target.value);setMessages([]);}}><option value="">Select</option>{enrollments.map(e=><option key={e.id} value={e.id}>{e.studentName} · {e.programCode}</option>)}</select></label>
          <button className="ml-3 underline" disabled={!selectedEnrollment} onClick={()=>void run(async isCurrent=>{const data=await backendRpc<any>('intrack_list_messages',{enrollment_id:selectedEnrollment,actor_role:current});if(isCurrent())setMessages(data.items);},false)}>Load my conversation</button>
          {messages.map(m=><p key={m.id}>{new Date(m.created_at).toLocaleString()} — {m.body}</p>)}
          <label className="block">Recipient profile ID<input className="ml-3 border p-2" value={recipient} onChange={e=>setRecipient(e.target.value)}/></label>
          <label className="block">Message<textarea className="block w-full border p-2" maxLength={4000} value={body} onChange={e=>setBody(e.target.value)}/></label>
          <button className="rounded border p-2" disabled={!selectedEnrollment||!recipient||!body.trim()} onClick={()=>void run(async()=>{await mutate('intrack_send_message',{enrollment_id:selectedEnrollment,actor_role:current,recipient_id:recipient,body});})}>Send message</button>
        </section>
        <section className="rounded border p-4"><h2 className="text-xl font-bold">Announcements</h2>{announcements.map(a=><article key={a.id}><h3 className="font-bold">{a.title}</h3><p>{a.body}</p></article>)}</section>
      </fieldset>
    </>}
  </main>;
}

