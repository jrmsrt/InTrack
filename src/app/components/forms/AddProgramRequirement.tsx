import {useState} from 'react';
import {Plus} from 'lucide-react';
import {toast} from 'sonner';
import {Button} from '../ui/button';
import {Input} from '../ui/input';
import {Textarea} from '../ui/textarea';
import {Label} from '../ui/label';
import {Dialog,DialogTrigger,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '../ui/dialog';
import type {PolicyRequirement} from '../../lib/enrollmentConfiguration';
const stages=[['pre','Pre-OJT'],['during','During OJT'],['post','Post-OJT']] as const;
const submissionStages=[['pre_ojt','Pre-OJT'],['during_ojt','During OJT'],['post_ojt','Post-OJT'],['portfolio','Portfolio']] as const;
const selectClass='h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm focus:outline-[#800000]';
const normalize=(text:string)=>text.normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
export function AddProgramRequirement({requirements,onAdd,disabled}:{requirements:PolicyRequirement[];onAdd:(requirement:PolicyRequirement)=>void;disabled?:boolean}){
 const [open,setOpen]=useState(false),[name,setName]=useState(''),[stage,setStage]=useState('pre'),[evidence,setEvidence]=useState('file'),[reviewer,setReviewer]=useState('adviser'),[mandatory,setMandatory]=useState(true),[deadline,setDeadline]=useState(''),[allowed,setAllowed]=useState<string[]>(['pre_ojt']);
 const [description,setDescription]=useState('');
 const reset=()=>{setName('');setDescription('');setStage('pre');setEvidence('file');setReviewer('adviser');setMandatory(true);setDeadline('');setAllowed(['pre_ojt']);};
 return <Dialog open={open} onOpenChange={value=>{if(!value)reset();setOpen(value);}}>
  <DialogTrigger asChild><Button type="button" disabled={disabled||requirements.length>=100} className="gap-2 bg-[#800000] text-white"><Plus className="h-4 w-4"/>Add Requirement</Button></DialogTrigger>
  <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg"><form className="space-y-5" onSubmit={e=>{
   e.preventDefault();if(disabled)return;
   if(!name.trim()||!description.trim()||!allowed.length){toast.error('Enter a requirement name, description and at least one submission stage.');return;}
   if(requirements.length>=100){toast.error('A program checklist supports up to 100 requirements.');return;}
   if(requirements.some(r=>r.stage===stage&&normalize(r.title)===normalize(name))){toast.error('This requirement already exists in the selected stage.');return;}
   onAdd({code:`CUSTOM-${crypto.randomUUID()}`,title:name.trim().replace(/\s+/g,' '),description:description.trim(),stage,evidenceType:evidence,reviewer,mandatory,allowedStages:allowed,recurrence:{kind:'once',dueAt:null},deadline});
   setOpen(false);reset();toast.info('Requirement added to the checklist. Select Save requirements to save your changes.');
  }}>
   <DialogHeader><DialogTitle>Add Program Requirement</DialogTitle><DialogDescription>Add an item for the selected program. It will apply to new classes after you save the checklist.</DialogDescription></DialogHeader>
   <div className="space-y-2"><Label htmlFor="new-requirement-name">Requirement name</Label><Input id="new-requirement-name" required maxLength={240} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Internship acceptance letter"/></div>
   <div className="space-y-2"><Label htmlFor="new-requirement-description">Requirement description</Label><Textarea id="new-requirement-description" required maxLength={2000} rows={3} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Explain what students must submit and any instructions."/></div>
   <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="new-requirement-stage">Stage</Label><select id="new-requirement-stage" className={selectClass} value={stage} onChange={e=>{const value=e.target.value;setStage(value);setAllowed([{pre:'pre_ojt',during:'during_ojt',post:'post_ojt'}[value]!]);}}>{stages.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
    <div className="space-y-2"><Label htmlFor="new-requirement-evidence">Evidence</Label><select id="new-requirement-evidence" className={selectClass} value={evidence} onChange={e=>setEvidence(e.target.value)}><option value="file">File upload</option><option value="staff_verification">Physical verification</option></select></div>
    <div className="space-y-2"><Label htmlFor="new-requirement-reviewer">Reviewer</Label><select id="new-requirement-reviewer" className={selectClass} value={reviewer} onChange={e=>setReviewer(e.target.value)}><option value="adviser">Adviser</option><option value="coordinator">Coordinator</option><option value="both">Adviser then coordinator</option></select></div>
    <div className="space-y-2"><Label htmlFor="new-requirement-deadline">Deadline (optional)</Label><Input id="new-requirement-deadline" type="date" value={deadline} onChange={e=>setDeadline(e.target.value)}/></div>
   </div>
   <label className="flex items-center gap-2 text-sm"><input className="h-4 w-4 accent-[#800000]" type="checkbox" checked={mandatory} onChange={e=>setMandatory(e.target.checked)}/>Required item</label>
   <fieldset className="space-y-3"><legend className="mb-2 text-sm font-medium">Submit during</legend><div className="flex flex-wrap gap-4">{submissionStages.map(([value,label])=><label key={value} className="flex items-center gap-2 text-sm"><input className="h-4 w-4 accent-[#800000]" type="checkbox" checked={allowed.includes(value)} onChange={e=>setAllowed(rows=>e.target.checked?[...rows,value]:rows.filter(row=>row!==value))}/>{label}</label>)}</div></fieldset>
   <DialogFooter><Button type="button" variant="outline" onClick={()=>{setOpen(false);reset();}}>Cancel</Button><Button type="submit" disabled={disabled} className="bg-[#800000] text-white">Add to checklist</Button></DialogFooter>
  </form></DialogContent>
 </Dialog>;
}
