import {Card,CardHeader,CardTitle,CardDescription,CardContent} from '../ui/card';
import {termLabel,type EnrollmentConfiguration} from '../../lib/enrollmentConfiguration';
const stages=[['pre','Pre-OJT'],['during','During OJT'],['post','Post-OJT'],['portfolio','Portfolio']] as const;
const reviewers:Record<string,string>={adviser:'Adviser',coordinator:'Coordinator',both:'Adviser then coordinator'};
export function PublishedPracticums({policies}:{policies:EnrollmentConfiguration['policies']}){
 const published=policies.filter(p=>p.published);
 return <Card className="min-w-0 border-slate-200 shadow-sm"><CardHeader><CardTitle className="text-lg font-semibold text-slate-900">Published practicums</CardTitle><CardDescription className="leading-6">Required hours and year/semester mappings come from the saved program curriculum. Each enrollment keeps its published version.</CardDescription></CardHeader><CardContent className="min-w-0 space-y-3">
  {published.map(p=><details key={p.id} className="group min-w-0 rounded-xl border border-slate-200">
   <summary className="cursor-pointer rounded-xl px-4 py-4 text-sm marker:text-[#800000] sm:px-5"><span className="ml-1 font-semibold text-slate-900">Component {p.component}</span><span className="ml-3 inline-block rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-[#800000]">Version {p.version}</span><span className="mt-2 block pl-4 leading-6 text-slate-500">Year {p.yearLevel} · {termLabel(p.semester)} · {p.requiredMinutes/60} hours</span></summary>
   <div className="space-y-5 border-t border-slate-100 p-4 sm:p-5"><p className="rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">{p.attendanceConfirmed?'Attendance settings configured; deployment still needs clearance.':'Document intake only. Attendance and deployment remain locked.'}</p>
    {stages.map(([stage,label])=>{const rows=p.requirements.filter(r=>r.stage===stage);return rows.length>0&&<section key={stage} aria-label={`${label} published requirements`}><h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#800000]">{label} <span className="ml-1 text-slate-400">({rows.length})</span></h4><div className="divide-y divide-slate-100">{rows.map(r=><div key={r.code} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-5"><p className="min-w-0 text-sm leading-6 text-slate-800 break-words">{r.title}</p><div className="flex shrink-0 flex-wrap gap-2 text-xs"><span className="rounded-md bg-slate-100 px-2 py-1 text-slate-600">{reviewers[r.reviewer]||r.reviewer}</span><span className={r.mandatory?'rounded-md bg-red-50 px-2 py-1 text-[#800000]':'rounded-md bg-slate-100 px-2 py-1 text-slate-500'}>{r.mandatory?'Required':'Optional'}</span></div></div>)}</div></section>;})}
   </div>
  </details>)}
  {!published.length&&<p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">No published practicum for the selected program.</p>}
 </CardContent></Card>;
}
