import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import React, { useMemo, useState } from 'react';
import { AlertTriangle, Archive, Check, Clock, ExternalLink, Search, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

import { openNativeDocument } from '../../components/forms/requirementFiles';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table';

const formatDateTime = (value?: string) => {
  if (!value) return 'Not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  }).format(parsed);
};

export function PortfolioManagement() {
  const { students, reviewCoordinatorPortfolio } = useCoordinatorModuleData();
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);
  const [remarks, setRemarks] = useState('');

  const sections = useMemo(() => Array.from(new Set(students.map(student => student.section))).sort(), [students]);
  const filteredStudents = students.filter(student => {
    const term = searchTerm.trim().toLowerCase();
    return (!term || student.name.toLowerCase().includes(term) || student.studentNumber.toLowerCase().includes(term) || student.adviserName.toLowerCase().includes(term)) &&
      (sectionFilter === 'all' || student.section === sectionFilter);
  });
  const student = students.find(item => item.studentId === selectedStudentId);
  const portfolioFiles = student
    ? [...student.preOJTRequirements, ...student.duringOJTRequirements, ...student.postOJTRequirements, student.moaState].flatMap(item => item.file ? [item.file] : [])
    : [];

  const openReview = (studentId: string) => {
    const selected = students.find(item => item.studentId === studentId);
    if (!selected) return;
    setSelectedStudentId(studentId);
    setSelectedAttachmentIndex(0);
    setRemarks(selected.coordinatorPortfolioRemarks || '');
  };

  const decide = async (status: 'Approved' | 'Needs Revision') => {
    try {
    if (!student || !student.portfolioApproved) return;
    await reviewCoordinatorPortfolio(student.studentId, status, remarks.trim());
    toast.success(status === 'Approved' ? 'Portfolio received final coordinator approval.' : 'Portfolio returned for revision.');
    setSelectedStudentId(null);
    setRemarks('');
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  const adviserStatus = (approved: boolean, submitted: boolean) => approved
    ? <Badge className="border-0 bg-emerald-100 text-emerald-800">Endorsed</Badge>
    : submitted
      ? <Badge className="border-0 bg-blue-100 text-blue-800">Awaiting Adviser</Badge>
      : <Badge className="border-0 bg-slate-100 text-slate-600">Not Submitted</Badge>;

  const coordinatorStatus = (status?: 'Pending' | 'Approved' | 'Needs Revision') => {
    if (status === 'Approved') return <Badge className="border-0 bg-emerald-100 text-emerald-800"><ShieldCheck className="mr-1 h-3.5 w-3.5" />Final Approved</Badge>;
    if (status === 'Needs Revision') return <Badge className="border-0 bg-amber-100 text-amber-800"><AlertTriangle className="mr-1 h-3.5 w-3.5" />Revision Requested</Badge>;
    return <Badge className="border-0 bg-slate-100 text-slate-600"><Clock className="mr-1 h-3.5 w-3.5" />Pending</Badge>;
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Portfolio Review Board</h1>
        <p className="mt-0.5 text-sm text-slate-500">Give final coordinator approval after the assigned adviser endorses the student portfolio.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="gap-4 border-b border-slate-100 sm:flex-row sm:items-end sm:justify-between">
          <div><CardTitle className="text-base text-slate-800">Portfolio submissions</CardTitle><CardDescription>Adviser endorsement and coordinator approval are tracked independently.</CardDescription></div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={searchTerm} onChange={event => setSearchTerm(event.target.value)} placeholder="Search student or adviser..." className="bg-slate-50 pl-10 text-xs" /></div>
            <select value={sectionFilter} onChange={event => setSectionFilter(event.target.value)} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs"><option value="all">All sections</option>{sections.map(section => <option key={section} value={section}>{section}</option>)}</select>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow className="bg-slate-50/50"><TableHead className="px-4 py-3 text-xs uppercase">Student</TableHead><TableHead className="px-4 py-3 text-xs uppercase">Submitted</TableHead><TableHead className="px-4 py-3 text-xs uppercase">Adviser review</TableHead><TableHead className="px-4 py-3 text-xs uppercase">Coordinator review</TableHead><TableHead className="px-4 py-3 text-center text-xs uppercase">Action</TableHead></TableRow></TableHeader>
            <TableBody>{filteredStudents.map(item => <TableRow key={item.studentId}>
              <TableCell className="px-4 py-3"><span className="block text-xs font-bold text-slate-800">{item.name}</span><span className="text-[10px] text-slate-500">{item.studentNumber} | {item.section}</span></TableCell>
              <TableCell className="px-4 py-3 text-xs text-slate-600">{item.portfolioSubmittedAt ? formatDateTime(item.portfolioSubmittedAt) : 'Not submitted'}</TableCell>
              <TableCell className="px-4 py-3">{adviserStatus(item.portfolioApproved, item.portfolioSubmitted)}<span className="mt-1 block text-[10px] text-slate-500">{item.adviserName}</span></TableCell>
              <TableCell className="px-4 py-3">{coordinatorStatus(item.coordinatorPortfolioStatus)}</TableCell>
              <TableCell className="px-4 py-3 text-center"><div className="flex justify-center gap-2"><Button size="sm" variant="outline" disabled={!item.portfolioSubmitted && !item.portfolioReviewHistory?.length} onClick={() => openReview(item.studentId)} className="h-7 text-[10px]">Review</Button><Button size="sm" variant="outline" disabled={item.coordinatorPortfolioStatus !== 'Approved'} onClick={() => toast.success(`Portfolio for ${item.name} archived in student records.`)} className="h-7 text-[10px]"><Archive className="mr-1 h-3.5 w-3.5" />Archive</Button></div></TableCell>
            </TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!student} onOpenChange={open => { if (!open) setSelectedStudentId(null); }}>
        <DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Final Portfolio Review</DialogTitle><DialogDescription>Review the adviser endorsement before making the coordinator's final decision.</DialogDescription></DialogHeader>
          {student && <div className="space-y-4">
            <section className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Submission details</h3>{coordinatorStatus(student.coordinatorPortfolioStatus)}</div>
              <p><span className="font-semibold text-slate-800">Student:</span> {student.name} ({student.studentNumber})</p>
              <p><span className="font-semibold text-slate-800">Program and section:</span> {student.program} / {student.section}</p>
              <p><span className="font-semibold text-slate-800">Company:</span> {student.companyName}</p>
              <p><span className="font-semibold text-slate-800">Submitted:</span> {formatDateTime(student.portfolioSubmittedAt)}</p>
              <p><span className="font-semibold text-slate-800">Uploaded documents:</span> {portfolioFiles.length}</p>
            </section>

            <section className="space-y-2 rounded-md border border-slate-200 p-4 text-sm text-slate-600">
              <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Adviser endorsement</h3>{adviserStatus(student.portfolioApproved, student.portfolioSubmitted)}</div>
              <p><span className="font-semibold text-slate-800">Adviser:</span> {student.adviserName}</p>
              <p><span className="font-semibold text-slate-800">Reviewed:</span> {formatDateTime(student.portfolioAdviserReviewedAt)}</p>
              <p className="whitespace-pre-wrap"><span className="font-semibold text-slate-800">Remarks:</span> {student.portfolioRemarks || 'No adviser remarks.'}</p>
            </section>

            {portfolioFiles.length > 0 ? <div className="space-y-2"><Label htmlFor="coordinatorPortfolioDocument">Portfolio document</Label><select id="coordinatorPortfolioDocument" value={Math.min(selectedAttachmentIndex, portfolioFiles.length - 1)} onChange={event => setSelectedAttachmentIndex(Number(event.target.value))} className="w-full rounded-md border border-slate-200 bg-white p-2 text-sm">{portfolioFiles.map((file, index) => <option key={`${file.name}-${index}`} value={index}>{file.name}</option>)}</select><Button variant="outline" className="w-full border-[#800000]/30 text-[#800000] hover:bg-red-50 hover:text-[#600000]" onClick={() => openNativeDocument(portfolioFiles[selectedAttachmentIndex])}><ExternalLink className="mr-2 h-4 w-4" />View Document</Button></div> : <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No uploaded portfolio document is available.</p>}

            {!student.portfolioApproved && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Final coordinator approval is available only after adviser endorsement.</p>}
            <div className="space-y-2"><Label htmlFor="coordinatorPortfolioRemarks">Coordinator remarks</Label><textarea id="coordinatorPortfolioRemarks" value={remarks} onChange={event => setRemarks(event.target.value)} placeholder="Add final approval notes or explain the required revision." className="min-h-28 w-full rounded-md border border-slate-200 p-3 text-sm" /></div>
          </div>}
          <DialogFooter className="gap-2"><Button variant="outline" onClick={() => setSelectedStudentId(null)}>Close</Button><Button variant="outline" disabled={!student?.portfolioApproved} onClick={() => decide('Needs Revision')} className="border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900"><AlertTriangle className="mr-1 h-4 w-4" />Request Revision</Button><Button disabled={!student?.portfolioApproved} onClick={() => decide('Approved')} className="bg-green-600 hover:bg-green-700"><Check className="mr-1 h-4 w-4" />Final Approve</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
