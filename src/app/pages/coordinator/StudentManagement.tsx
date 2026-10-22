import {Link} from 'react-router-dom';
import React, { useEffect, useState } from 'react';
import { useCoordinatorRoster } from '../../context/useCoordinatorRoster';
import { coordinatorCommand, importAndWhitelist, whitelistRosterStudent, type CoordinatorRosterRow } from '../../lib/coordinatorGateway';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { MasterlistImportDialog, MasterlistStudent } from '../../components/forms/MasterlistImportDialog';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { 
  Plus, 
  UserCheck, 
  Search, 
  Mail, 
  BookOpen, 
  UserPlus, 
  FileSpreadsheet,
  Filter,
  RotateCcw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';

type PortalStudent = CoordinatorRosterRow & {studentId:string;program:string;section:string;stage:string;adviserName:string};
const stageNames:Record<string,string>={pre_ojt:'Stage 1: Pre-OJT',during_ojt:'Stage 2: During OJT',post_ojt:'Stage 3: Post-OJT',portfolio:'Stage 4: Portfolio Completion',completed:'Completed'};
export function StudentManagement() {
  const [searchTerm,setSearchTerm]=useState(''),[programFilter,setProgramFilter]=useState('all'),[sectionFilter,setSectionFilter]=useState('all'),[stageFilter,setStageFilter]=useState('all'),[accessFilter,setAccessFilter]=useState('all'),[activationFilter,setActivationFilter]=useState('all'),[page,setPage]=useState(0);
  const {identity,data,loading,error,busy,reload,run}=useCoordinatorRoster('student',{search:searchTerm.trim(),program:programFilter,section:sectionFilter,stage:Object.keys(stageNames).find(key=>stageNames[key]===stageFilter)||stageFilter,access:accessFilter,activation:activationFilter,page});
  useEffect(()=>setPage(0),[searchTerm,programFilter,sectionFilter,stageFilter,accessFilter,activationFilter]);
  const [addDialogOpen,setAddDialogOpen]=useState(false),[importDialogOpen,setImportDialogOpen]=useState(false);
  const [name,setName]=useState(''),[studentNumber,setStudentNumber]=useState(''),[email,setEmail]=useState(''),[program,setProgram]=useState(''),[section,setSection]=useState(''),[adviserName,setAdviserName]=useState('');
  const [accessTarget,setAccessTarget]=useState<PortalStudent|null>(null),[accessReason,setAccessReason]=useState('');
  const students:PortalStudent[]=(data?.items||[]).map(row=>({...row,studentId:row.id,program:row.programCode,section:row.section||'',stage:row.stage?stageNames[row.stage]||row.stage:'Not enrolled',adviserName:row.adviserName||'Not assigned'}));
  const filteredStudents=students;
  const programOptions=(data?.programs||[]).map(item=>item.code);
  const programFilterOptions=Array.from(new Set(['BSIT','BSCPE','BSHM','BSOA',...programOptions]));
  const programLabel=(code:string)=>code.toUpperCase()==='BSCPE'?'BSCpE':code;
  const sectionOptions=Array.from(new Set(['2-1','2-2','3-1','3-2','4-1','4-2',...(data?.sections||[])])).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const getComparableSection=(value:string)=>value;
  const getAuthorizedRecord=(number:string)=>{const row=students.find(item=>item.studentNumber===number);return row?{accountStatus:row.accessEnabled?'ENABLED':'DISABLED',activated:row.activated}:null;};
  const resetFilters=()=>{setSearchTerm('');setProgramFilter('all');setSectionFilter('all');setStageFilter('all');setAccessFilter('all');setActivationFilter('all');setPage(0);};
  const clearForm=()=>{setName('');setStudentNumber('');setEmail('');setProgram('');setSection('');setAdviserName('');};
  const handleAddSubmit=async(event:React.FormEvent)=>{event.preventDefault();try{
    await run(()=>importAndWhitelist(identity.profile.id,[{studentNumber,name,email,program,section}]));
    toast.success('Student whitelisted. The account remains pending until OTP and password decision.');setAddDialogOpen(false);clearForm();
  }catch(cause){toast.error(cause instanceof Error?cause.message:'Unable to whitelist this student.');}};
  const handleImportRoster=async(records:MasterlistStudent[])=>{
    // Fresh imports must not remain hidden by a previous search, page or status filter.
    try{return await run(()=>importAndWhitelist(identity.profile.id,records));}
    finally{resetFilters();}
  };
  const handleToggleStudentAccess=(number:string)=>{setAccessTarget(students.find(item=>item.studentNumber===number)||null);setAccessReason('');};
  const saveAccess=async()=>{if(!accessTarget?.membershipId)return;try{await run(()=>coordinatorCommand(identity.profile.id,'intrack_set_membership',{membership_id:accessTarget.membershipId,expected_revision:accessTarget.membershipRevision,make_active:!accessTarget.membershipActive,reason:accessReason}));setAccessTarget(null);toast.success('Student access updated.');}catch(cause){toast.error(cause instanceof Error?cause.message:'Unable to update access.');}};
  const retryWhitelist=async(row:PortalStudent)=>{try{await run(()=>whitelistRosterStudent(identity.profile.id,row));toast.success('Student whitelist confirmed.');}catch(cause){toast.error(cause instanceof Error?cause.message:'Unable to finish whitelisting.');}};
  return (
    <div className="space-y-6 font-sans">
      {loading&&<p role="status" className="text-sm text-slate-500">Loading saved students…</p>}
      {error&&<div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}<Button variant="outline" onClick={()=>void reload()} className="ml-3">Retry</Button></div>}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Student Management</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-light">Import students into the authorized masterlist, manage activation, and monitor adviser assignments established through class enrollment.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="text-xs h-9"><Link to="/coordinator/enrollment">Classes & Requirements</Link></Button>
          <Button 
            variant="outline" 
            disabled={busy||loading} onClick={() => setImportDialogOpen(true)}
            className="text-xs h-9 border-slate-250 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer font-bold"
          >
            <FileSpreadsheet className="h-4 w-4" /> Import Masterlist CSV
          </Button>

          <Dialog open={addDialogOpen} onOpenChange={(open) => {
            setAddDialogOpen(open);
            clearForm();
          }}>
            <DialogTrigger asChild>
              <Button disabled={busy||loading} className="bg-[#800000] hover:bg-[#6b0000] text-white text-xs h-9 flex items-center gap-1.5 cursor-pointer">
                <UserPlus className="h-4 w-4" /> Add Student
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md font-sans">
              <form onSubmit={handleAddSubmit}><fieldset disabled={busy||loading}>
                <DialogHeader>
                  <DialogTitle>Register Intern Profile</DialogTitle>
                  <DialogDescription>Input new student details to establish tracking.</DialogDescription>
                </DialogHeader>
                <div className="py-4 space-y-3.5 text-xs">
                  <div className="space-y-1">
                    <Label htmlFor="sName">Full Name</Label>
                    <Input id="sName" placeholder="e.g. Francisco, Juan S." value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sNum">Student Number</Label>
                    <Input id="sNum" placeholder="YYYY-XXXXX-PQ-0" value={studentNumber} onChange={(e) => setStudentNumber(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sMail">Email Address</Label>
                    <Input id="sMail" type="email" placeholder="student@university.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="sProg">Academic Program</Label>
                    <select
                      id="sProg"
                      required
                      value={program}
                      onChange={(e) => setProgram(e.target.value)}
                      className="w-full bg-white border border-slate-205 rounded p-2 text-xs"
                    >
                      <option value="">Select program</option>{programFilterOptions.map(code=><option key={code} value={code}>{programLabel(code)}</option>)}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label htmlFor="sSec">Section</Label>
                      <select id="sSec" value={section} onChange={event=>setSection(event.target.value)} className="w-full bg-white border border-slate-205 rounded p-2 text-xs" required><option value="">Select section</option>{sectionOptions.map(option=><option key={option} value={option}>{option}</option>)}</select>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="sAdv">Assigned Adviser</Label>
                      <select id="sAdv" disabled className="w-full bg-slate-50 border rounded p-2 text-xs"><option>Assigned when adviser approves class enrollment</option></select>
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                  <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] text-white">Whitelist Student</Button>
                </DialogFooter></fieldset>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <MasterlistImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onImport={handleImportRoster} />

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-end">
          <div className="flex-1 space-y-1.5"><Label htmlFor="student-search" className="text-xs">Search students</Label><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input id="student-search" type="search" placeholder="Name, student number, email, or adviser..." className="bg-slate-50 pl-10 text-xs" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} /></div></div>
          <div className="w-full space-y-1.5 xl:w-32"><Label className="text-xs">Program</Label><select value={programFilter} onChange={(event) => setProgramFilter(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"><option value="all">All programs</option>{programFilterOptions.map(programOption => <option key={programOption} value={programOption}>{programLabel(programOption)}</option>)}</select></div>
          <div className="w-full space-y-1.5 xl:w-28"><Label className="text-xs">Section</Label><select value={sectionFilter} onChange={(event) => setSectionFilter(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"><option value="all">All sections</option>{sectionOptions.map(sectionOption => <option key={sectionOption} value={sectionOption}>{sectionOption}</option>)}</select></div>
          <div className="w-full space-y-1.5 xl:w-36"><Label className="text-xs">OJT stage</Label><select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"><option value="all">All stages</option><option value="Stage 1: Pre-OJT">Pre-OJT</option><option value="Stage 2: During OJT">During OJT</option><option value="Stage 3: Post-OJT">Post-OJT</option><option value="Stage 4: Portfolio Completion">Portfolio</option></select></div>
          <div className="w-full space-y-1.5 xl:w-28"><Label className="text-xs">Access</Label><select value={accessFilter} onChange={(event) => setAccessFilter(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"><option value="all">All</option><option value="enabled">Enabled</option><option value="disabled">Disabled</option></select></div>
          <div className="w-full space-y-1.5 xl:w-28"><Label className="text-xs">Activation</Label><select value={activationFilter} onChange={(event) => setActivationFilter(event.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs"><option value="all">All</option><option value="activated">Activated</option><option value="pending">Pending</option></select></div>
          <Button variant="outline" onClick={resetFilters} className="h-9 gap-1.5 text-xs font-bold"><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
        </CardContent>
      </Card>

      {/* Grid of students */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Master Roster</CardTitle>
            <CardDescription>Roster record of registered interns.</CardDescription>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <Filter className="h-4 w-4 text-[#800000]" />
            {data?.total||0} matching students
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Quick search..."
              className="pl-10 text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#800000]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Intern</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Program</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Section</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Assigned Adviser</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">OJT Status Stage</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Account Access</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Activation</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center w-48">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((s) => {
                const authRecord = getAuthorizedRecord(s.studentNumber);
                const isEnabled = s.accessEnabled;
                const isActivated = Boolean(authRecord?.activated);

                return (
                <TableRow key={s.studentId} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="py-3.5 px-4 font-sans">
                    <span className="font-bold text-slate-800 text-xs block">{s.name}</span>
                    <span className="text-[10px] text-slate-455 font-normal">{s.studentNumber} | {s.email}</span>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-xs text-slate-500 font-light truncate max-w-[150px]">
                    {programLabel(s.program.split('—')[0])}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-650">
                    {s.section}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-700">
                    {s.adviserName}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 font-semibold text-xs">
                    <Badge variant="outline" className="text-[10px] font-semibold text-slate-700">{s.stage.split(':')[1] || s.stage}</Badge>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 font-semibold text-xs">
                    <Badge className={isEnabled ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-red-100 text-red-800 hover:bg-red-100'}>
                      {isEnabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 font-semibold text-xs">
                    <Badge className={isActivated ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
                      {isActivated ? 'Activated' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-center">
                    <div className="flex justify-center gap-2">
                      <Button asChild size="sm" variant="outline" className="text-[10px] h-7"><Link to="/coordinator/enrollment">Enrollment</Link></Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy||!s.membershipId} onClick={() => handleToggleStudentAccess(s.studentNumber||'')}
                        className={`text-[10px] h-7 cursor-pointer font-bold ${isEnabled ? 'border-red-200 text-red-700 hover:bg-red-50' : 'border-green-200 text-green-700 hover:bg-green-50'}`}
                      >
                        {s.membershipActive ? 'Disable' : 'Enable'}
                      </Button>
                      {!s.accessEnabled&&(!s.profileId||s.provisioningPending)&&<Button size="sm" variant="outline" disabled={busy||(s.provisioningPending&&!s.ownedReservation)} onClick={()=>void retryWhitelist(s)} className="text-[10px] h-7">Whitelist / Retry</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!loading&&!error&&!students.length&&<p className="text-sm text-slate-500">No saved students match these filters.</p>}
      <div className="flex items-center justify-end gap-3 text-xs"><Button variant="outline" disabled={loading||busy||page===0} onClick={()=>setPage(value=>value-1)}>Previous</Button><span>Page {page+1}</span><Button variant="outline" disabled={loading||busy||!data?.hasMore} onClick={()=>setPage(value=>value+1)}>Next</Button></div>
      <Dialog open={Boolean(accessTarget)} onOpenChange={open=>{if(!open&&!busy)setAccessTarget(null);}}><DialogContent><DialogHeader><DialogTitle>{accessTarget?.membershipActive?'Disable':'Enable'} student access</DialogTitle><DialogDescription>Update the student's program membership. Activation and other account checks still apply.</DialogDescription></DialogHeader><Label>Reason<Input maxLength={1000} value={accessReason} onChange={event=>setAccessReason(event.target.value)} disabled={busy}/></Label><DialogFooter><Button variant="outline" disabled={busy} onClick={()=>setAccessTarget(null)}>Cancel</Button><Button disabled={busy||!accessReason.trim()} onClick={()=>void saveAccess()} className="bg-[#800000] text-white">Save access</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
