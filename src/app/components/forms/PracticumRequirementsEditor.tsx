import {useEffect,useId,useState} from 'react';
import {Input} from '../ui/input';
import {Textarea} from '../ui/textarea';
import {Label} from '../ui/label';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '../ui/tabs';
import type {PolicyRequirement} from '../../lib/enrollmentConfiguration';

const stages=[['pre','Pre-OJT'],['during','During OJT'],['post','Post-OJT']] as const;
const windows=[['pre_ojt','Pre-OJT'],['during_ojt','During OJT'],['post_ojt','Post-OJT'],['portfolio','Portfolio']] as const;
const selectClass='h-10 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-[#800000]';

export function PracticumRequirementsEditor({requirements,onChange,revealCode}:{requirements:PolicyRequirement[];onChange:(index:number,patch:Partial<PolicyRequirement>)=>void;revealCode?:string}){
 const [stage,setStage]=useState('pre');const prefix=useId();
 useEffect(()=>{const added=requirements.find(r=>r.code===revealCode);if(added)setStage(added.stage==='portfolio'?'post':added.stage);},[revealCode]);
 const rows=requirements.map((requirement,index)=>({requirement,index})).filter(({requirement})=>requirement.stage===stage);
 return <section className="min-w-0 space-y-4" aria-label="Practicum requirement settings">
  <div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold text-slate-900">Requirements checklist</h3><p className="mt-1 text-sm text-slate-500">Review each stage before publishing. Changes are kept when switching stages.</p></div><span className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">{requirements.length} requirements</span></div>
  <Tabs value={stage} onValueChange={setStage} className="min-w-0">
   <TabsList className="grid h-auto w-full grid-cols-3 gap-1 p-1" aria-label="Requirement stage">
    {stages.map(([value,label])=><TabsTrigger key={value} value={value} className="flex flex-wrap gap-x-2 gap-y-1 px-2 py-2 text-xs sm:text-sm data-[state=active]:text-[#800000]">{label}<span className="rounded-full bg-slate-100 px-2 text-xs">{requirements.filter(r=>r.stage===value).length}</span></TabsTrigger>)}
   </TabsList>
   <TabsContent value={stage} className="mt-4 space-y-3">
    {rows.map(({requirement:r,index})=>{
     const id=`${prefix}-${index}`;
     return <article key={r.code} className="min-w-0 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-start gap-3 border-b border-slate-100 bg-slate-50/60 px-4 py-3 sm:px-5"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold text-[#800000] ring-1 ring-slate-200">{index+1}</span><h4 className="min-w-0 pt-0.5 text-sm font-semibold leading-6 text-slate-900 break-words">{r.title}</h4></div>
      <div className="space-y-4 p-4 sm:p-5">
       <div className="space-y-2"><Label htmlFor={`${id}-description`}>Description</Label><Textarea id={`${id}-description`} aria-label={`Description for ${r.title}`} rows={2} maxLength={2000} value={r.description||''} onChange={e=>onChange(index,{description:e.target.value})} placeholder="Instructions for students"/></div>
       <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_1fr_0.9fr_auto]">
        <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-evidence`}>Evidence</Label><select id={`${id}-evidence`} aria-label={`Evidence for ${r.title}`} className={selectClass} value={r.evidenceType} onChange={e=>onChange(index,{evidenceType:e.target.value})}>{[['file','File upload'],['staff_verification','Physical verification'],['moa','MOA document'],['dtr','System DTR'],['journal','System journal'],['portfolio','System portfolio']].map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
        <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-reviewer`}>Reviewer</Label><select id={`${id}-reviewer`} aria-label={`Reviewer for ${r.title}`} className={selectClass} value={r.reviewer} onChange={e=>onChange(index,{reviewer:e.target.value})}><option value="">Select reviewer</option><option value="adviser">Adviser</option><option value="coordinator">Coordinator</option><option value="both">Both, in order</option></select></div>
        <div className="min-w-0 space-y-2"><Label htmlFor={`${id}-deadline`}>Deadline <span className="font-normal text-slate-400">(optional)</span></Label><Input id={`${id}-deadline`} className="min-w-0 w-full" type="date" aria-label={`Deadline for ${r.title}`} value={r.deadline||''} onChange={e=>onChange(index,{deadline:e.target.value})}/></div>
        <div className="space-y-2"><span className="block text-sm font-medium text-slate-700">Requirement</span><label className="flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#800000]" aria-label={`Mandatory ${r.title}`} checked={r.mandatory} onChange={e=>onChange(index,{mandatory:e.target.checked})}/>Required</label></div>
       </div>
       <fieldset className="flex min-w-0 flex-wrap gap-x-5 gap-y-3 border-t border-slate-100 pt-3"><legend className="px-0 text-xs font-medium text-slate-500">Submit during</legend>{windows.map(([value,label])=><label key={value} className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-600"><input type="checkbox" className="h-4 w-4 accent-[#800000]" aria-label={`${label} submission for ${r.title}`} checked={r.allowedStages.includes(value)} onChange={e=>onChange(index,{allowedStages:e.target.checked?[...r.allowedStages,value]:r.allowedStages.filter(s=>s!==value)})}/>{label}</label>)}</fieldset>
      </div>
     </article>;
    })}
    {!rows.length&&<p className="rounded-lg border border-dashed border-slate-200 p-5 text-sm text-slate-500">No requirements in this stage.</p>}
   </TabsContent>
  </Tabs>
 </section>;
}
