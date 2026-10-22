import {useEffect,useRef,useState} from 'react';
import {backendRpc,type EnrollmentProjection} from '../../lib/backendGateway';
import type {IdentityRole} from '../../lib/protectedIdentity';
import {csvCell} from '../../lib/masterlistCsv';
type Report={items:EnrollmentProjection[];total:number;nextOffset:number|null};
const columns=['studentName','programCode','component','lifecycle','outcome','requiredMinutes','creditedMinutes','remainingMinutes','clearance','moaStatus'] as const;
/** No demo state; export authority and the frozen snapshot come from the server. */
export function EnrollmentReports({role,profileId}:{role:IdentityRole;profileId:string}){
 const [search,setSearch]=useState(''),[query,setQuery]=useState(''),[offset,setOffset]=useState(0),[report,setReport]=useState<Report|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const generation=useRef(0),retry=useRef<{key:string;id:string}|null>(null);
 useEffect(()=>{setSearch('');setQuery('');setOffset(0);retry.current=null;},[role,profileId]);
 useEffect(()=>{const n=++generation.current;let alive=true;setReport(null);setBusy(true);
  backendRpc<Report>('intrack_enrollment_report',{actor_role:role,search_text:query,page_offset:offset,page_size:100})
   .then(data=>{if(alive&&n===generation.current){setReport(data);setMessage('');}})
   .catch(error=>{if(alive&&n===generation.current)setMessage(error.message);})
   .finally(()=>{if(alive&&n===generation.current)setBusy(false);});return()=>{alive=false;};
 },[role,profileId,query,offset]);
 const download=async()=>{const n=generation.current;setBusy(true);const key=JSON.stringify({role,profileId,query,offset});
  if(retry.current?.key!==key)retry.current={key,id:crypto.randomUUID()};
  try{const data=await backendRpc<{items:Record<string,unknown>[]}>('intrack_export_enrollments',{command_id:retry.current.id,actor_role:role,search_text:query,page_offset:offset});
   if(n!==generation.current)return;retry.current=null;
   const csv='\uFEFF'+[columns.map(csvCell).join(','),...data.items.map(row=>columns.map(c=>csvCell(row[c])).join(','))].join('\r\n');
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download='intrack-enrollment-page.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
   setMessage('Exported this page. Hours are recorded as integer minutes in the CSV.');
  }catch(error){if(n===generation.current)setMessage(error instanceof Error?error.message:'Export unavailable');}finally{if(n===generation.current)setBusy(false);}
 };
 return <section className="space-y-3 rounded border p-4"><h2 className="text-xl font-bold">Enrollment reports</h2>
  <form onSubmit={e=>{e.preventDefault();retry.current=null;setOffset(0);setQuery(search.trim());}} className="flex flex-wrap gap-3">
   <label>Student or program <input className="ml-2 border p-2" maxLength={200} value={search} onChange={e=>setSearch(e.target.value)}/></label><button disabled={busy} className="border p-2">Search</button>
  </form><p role="status" aria-live="polite">{busy?'Loading…':message}</p>
  {report&&<><p>{report.total} accessible records. Page {Math.floor(offset/100)+1}.</p><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th scope="col">Student</th><th scope="col">Program</th><th scope="col">Stage</th><th scope="col">Approved hours</th><th scope="col">Remaining hours</th><th scope="col">Clearance</th></tr></thead>
   <tbody>{report.items.map(row=><tr key={row.id}><td>{row.studentName}</td><td>{row.programCode}</td><td>{row.lifecycle}</td><td>{(row.creditedMinutes/60).toFixed(2)}</td><td>{(row.remainingMinutes/60).toFixed(2)}</td><td>{row.clearance}</td></tr>)}</tbody></table></div>
   <div className="flex gap-3"><button className="border p-2" disabled={busy||offset===0} onClick={()=>setOffset(Math.max(0,offset-100))}>Previous</button><button className="border p-2" disabled={busy||report.nextOffset==null} onClick={()=>setOffset(report.nextOffset!)}>Next</button>
    {role!=='student'&&<button className="border p-2" disabled={busy} onClick={()=>void download()}>Export this page</button>}</div></>}
 </section>;
}
