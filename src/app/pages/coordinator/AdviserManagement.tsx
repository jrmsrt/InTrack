import React, { useEffect, useState } from 'react';
import { useCoordinatorRoster } from '../../context/useCoordinatorRoster';
import { coordinatorCommand, saveAdviser, type CoordinatorRosterRow } from '../../lib/coordinatorGateway';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Plus, Users, UserPlus, Mail, Phone, BookOpen } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';


export function AdviserManagement() {
  const [search,setSearch]=useState(''),[programFilter,setProgramFilter]=useState('all'),[sectionFilter,setSectionFilter]=useState('all'),[page,setPage]=useState(0);
  const {identity,data,loading,error,busy,reload,run}=useCoordinatorRoster('adviser',{search,program:programFilter,section:sectionFilter,page});
  const [addDialogOpen,setAddDialogOpen]=useState(false),[name,setName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState(''),[section,setSection]=useState(''),[programId,setProgramId]=useState('');
  const [accessTarget,setAccessTarget]=useState<CoordinatorRosterRow|null>(null),[reason,setReason]=useState('');
  useEffect(()=>setPage(0),[search,programFilter,sectionFilter]);
  useEffect(()=>{if(!programId&&data?.programs.length)setProgramId(data.programs[0].id);},[data,programId]);
  const advisers=data?.items||[];
  const programOptions=Array.from(new Set(['BSIT','BSCPE','BSHM','BSOA',...(data?.programs||[]).map(p=>p.code)]));
  const programLabel=(code:string)=>code.toUpperCase()==='BSCPE'?'BSCpE':code;
  const selectedSections=section.split(',').map(value=>value.trim()).filter(Boolean);
  const sectionOptions=Array.from(new Set(['2-1','2-2','3-1','3-2','4-1','4-2',...(data?.sections||[]),...advisers.flatMap(a=>a.sections),...selectedSections])).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const handleAddAdviser=async(event:React.FormEvent)=>{event.preventDefault();try{
    const selectedProgram=data?.programs.find(p=>p.id===programId||p.code===programId);
    if(!selectedProgram)throw new Error('This program is outside your assigned coordinator scope. Contact the system operator for an authorized assignment.');
    await run(()=>saveAdviser(identity.profile.id,{name,email,phone,section,programId:selectedProgram.id}));
    toast.success('Adviser whitelist and contact details saved.');setAddDialogOpen(false);setName('');setEmail('');setPhone('');setSection('');
  }catch(cause){toast.error(cause instanceof Error?cause.message:'Unable to whitelist this adviser.');}};
  const resume=(row:CoordinatorRosterRow)=>{setName(row.name);setEmail(row.email||'');setPhone(row.phone);setSection(row.sections.join(', '));setProgramId(row.programId);setAddDialogOpen(true);};
  const saveAccess=async()=>{if(!accessTarget?.membershipId)return;try{await run(()=>coordinatorCommand(identity.profile.id,'intrack_set_membership',{membership_id:accessTarget.membershipId,expected_revision:accessTarget.membershipRevision,make_active:!accessTarget.membershipActive,reason}));setAccessTarget(null);toast.success('Adviser access updated.');}catch(cause){toast.error(cause instanceof Error?cause.message:'Unable to update access.');}};
  return (
    <div className="space-y-6 font-sans">
      {loading&&<p role="status" className="text-sm text-slate-500">Loading saved advisers…</p>}
      {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<Button variant="outline" className="ml-3" onClick={()=>void reload()}>Retry</Button></div>}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Adviser Management</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-light">Manage academic section advisers and audit cohort capacities.</p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={open=>{if(!busy)setAddDialogOpen(open);}}>
          <DialogTrigger asChild>
            <Button disabled={busy||loading} className="bg-[#800000] hover:bg-[#6b0000] text-white text-xs h-9 flex items-center gap-1.5 cursor-pointer">
              <UserPlus className="h-4 w-4" /> Add Adviser
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md font-sans max-h-[calc(100dvh-2rem)] overflow-y-auto">
            <form onSubmit={handleAddAdviser}><fieldset disabled={busy}>
              <DialogHeader>
                <DialogTitle>Register Faculty Adviser</DialogTitle>
                <DialogDescription>Input section adviser details to configure student monitoring allocations.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3.5 text-xs"><div className="space-y-1"><Label htmlFor="advProgram">Academic Program</Label><select id="advProgram" value={programId} onChange={event=>setProgramId(event.target.value)} required className="w-full bg-white border rounded p-2 text-xs"><option value="">Select program</option>{programOptions.map(code=><option key={code} value={data?.programs.find(p=>p.code===code)?.id||code}>{programLabel(code)}</option>)}</select></div>
                <div className="space-y-1">
                  <Label htmlFor="advName">Full Name</Label>
                  <Input id="advName" placeholder="e.g. Francisco, Jose P." value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="advMail">Email Address</Label>
                  <Input id="advMail" type="email" placeholder="adviser@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="advPhone">Contact Number</Label>
                  <Input id="advPhone" placeholder="e.g. 0917 555 0000" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="advSec">Section</Label>
                  <select
                    id="advSec"
                    value=""
                    onChange={event=>{const value=event.target.value;if(value)setSection(current=>Array.from(new Set([...current.split(',').map(item=>item.trim()).filter(Boolean),value])).join(', '));}}
                    className="w-full bg-white border rounded p-2 text-xs"
                  >
                    <option value="">{section||'Select section'}</option>
                    {sectionOptions.map(option=><option key={option} value={option}>{option}</option>)}
                  </select>
                  {selectedSections.length>0&&<div className="flex flex-wrap gap-1 pt-1">
                    {selectedSections.map(option=><button key={option} type="button" aria-label={`Remove section ${option}`} onClick={()=>setSection(current=>current.split(',').map(item=>item.trim()).filter(item=>item&&item!==option).join(', '))} className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs">{option} ×</button>)}
                  </div>}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] text-white">Whitelist Adviser</Button>
              </DialogFooter></fieldset>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-slate-200 shadow-sm"><CardContent className="flex flex-wrap gap-3 p-4"><Input type="search" aria-label="Search advisers" placeholder="Name or email..." value={search} onChange={event=>setSearch(event.target.value)} className="max-w-sm bg-slate-50"/><select aria-label="Program filter" value={programFilter} onChange={event=>setProgramFilter(event.target.value)} className="rounded-lg border bg-slate-50 px-3 text-xs"><option value="all">All programs</option>{programOptions.map(code=><option key={code} value={code}>{programLabel(code)}</option>)}</select><select aria-label="Section filter" value={sectionFilter} onChange={event=>setSectionFilter(event.target.value)} className="rounded-lg border bg-slate-50 px-3 text-xs"><option value="all">All sections</option>{sectionOptions.map(option=><option key={option} value={option}>{option}</option>)}</select></CardContent></Card>
      {/* Grid Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800">Faculty Adviser Workload Registry</CardTitle>
          <CardDescription>Track allocated student capacities per OJT section adviser.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Faculty Adviser</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Contact Email</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Program</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Section</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center">Workload (Interns)</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Workload status</TableHead><TableHead className="py-3 px-4 text-xs">Activation / Access</TableHead><TableHead className="py-3 px-4 text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {advisers.map((adv) => {
                const workloadCount = adv.workload;

                return (
                  <TableRow key={adv.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-3.5 px-4 font-sans font-bold text-slate-800 text-xs">
                      {adv.name}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-normal text-slate-500">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {adv.email}
                      </span><span className="block text-[10px] font-normal">{adv.phone||'No contact number'}</span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs text-slate-500 font-normal">{programLabel(adv.programCode)}</TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                      <div className="flex gap-1">
                        {adv.sections.map((sec, i) => (
                          <Badge key={i} variant="outline" className="text-[10px]">{sec}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-center text-xs font-extrabold text-slate-850">
                      {workloadCount} interns
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      {workloadCount > 0 ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">Active Load</Badge>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-500 border-slate-200">Empty Load</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs"><Badge className={adv.activated?'bg-blue-100 text-blue-800':'bg-amber-100 text-amber-800'}>{adv.activated?'Activated':'Pending'}</Badge><p className="mt-1 text-slate-500">{adv.accessEnabled?'Enabled':'Disabled / pending'}</p></TableCell>
                    <TableCell className="py-3.5 px-4"><div className="flex gap-2"><Button size="sm" variant="outline" disabled={busy} onClick={()=>resume(adv)}>{adv.provisioningPending?'Resume whitelist':'Edit details'}</Button><Button size="sm" variant="outline" disabled={busy||!adv.membershipId} onClick={()=>{setAccessTarget(adv);setReason('');}}>{adv.membershipActive?'Disable':'Enable'}</Button></div></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {!loading&&!error&&!advisers.length&&<p className="text-sm text-slate-500">No saved advisers match these filters.</p>}
      <div className="flex items-center justify-end gap-3 text-xs"><span>{data?.total||0} matching advisers</span><Button variant="outline" disabled={loading||busy||page===0} onClick={()=>setPage(value=>value-1)}>Previous</Button><span>Page {page+1}</span><Button variant="outline" disabled={loading||busy||!data?.hasMore} onClick={()=>setPage(value=>value+1)}>Next</Button></div>
      <Dialog open={Boolean(accessTarget)} onOpenChange={open=>{if(!open&&!busy)setAccessTarget(null);}}><DialogContent><DialogHeader><DialogTitle>{accessTarget?.membershipActive?'Disable':'Enable'} adviser access</DialogTitle><DialogDescription>Update this program membership. Other account checks remain required.</DialogDescription></DialogHeader><Label>Reason<Input value={reason} maxLength={1000} disabled={busy} onChange={event=>setReason(event.target.value)}/></Label><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setAccessTarget(null)}>Cancel</Button><Button disabled={busy||!reason.trim()} onClick={()=>void saveAccess()} className="bg-[#800000] text-white">Save access</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
