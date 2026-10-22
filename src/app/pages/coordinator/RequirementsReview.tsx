import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, Check, ClipboardCheck, ExternalLink, Eye, FileText, Files, Search, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { CoordinatorReviewStatus, RequirementItem, RequirementStage, StudentOJTProfile } from '../../context/OJTContext';
import { openNativeDocument } from '../../components/forms/requirementFiles';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

type RequirementKey = 'preOJTRequirements' | 'duringOJTRequirements' | 'postOJTRequirements';
type ReviewTarget = { student: StudentOJTProfile; requirement: RequirementItem; stage: RequirementStage };
type CoordinatorFilter = 'ALL' | 'PENDING' | 'VERIFIED' | 'ATTENTION' | 'NOT_SUBMITTED';

const stages: Record<RequirementStage, { label: string; key: RequirementKey; icon: React.ElementType }> = {
  pre: { label: 'Pre-OJT', key: 'preOJTRequirements', icon: ClipboardCheck },
  during: { label: 'During OJT', key: 'duringOJTRequirements', icon: Files },
  post: { label: 'Post-OJT', key: 'postOJTRequirements', icon: FileText },
};

const formatDateTime = (value?: string) => {
  if (!value) return 'Date and time not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(parsed);
};

const normalizeSection = (section: string) => {
  const match = section.trim().toUpperCase().match(/\b([34])([AB])$/);
  return match ? `${match[1]}-${match[2] === 'A' ? '1' : '2'}` : section.trim();
};

const programName = (program: string) => program.split('—')[0].trim();

const formatStudentName = (name: string) => {
  if (name.includes(',')) return name.replace(/\s+/g, ' ').trim();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return name;
  const lastName = parts[parts.length - 1];
  const middleInitial = parts.length > 2 ? `${parts[parts.length - 2].replace(/\./g, '').charAt(0).toUpperCase()}.` : '';
  const firstName = parts.slice(0, parts.length > 2 ? -2 : -1).join(' ');
  return `${lastName}, ${firstName}${middleInitial ? ` ${middleInitial}` : ''}`;
};

const adviserBadge = (status: RequirementItem['status']) => {
  if (status === 'Approved') return <Badge className="border-0 bg-emerald-100 text-[10px] text-emerald-800">Approved</Badge>;
  if (status === 'Needs Revision' || status === 'Rejected') return <Badge className="border-0 bg-slate-200 text-[10px] text-slate-700">Revision requested</Badge>;
  if (status === 'Under Review') return <Badge className="border-0 bg-violet-100 text-[10px] text-violet-800">Under review</Badge>;
  if (status === 'Submitted') return <Badge className="border-0 bg-blue-100 text-[10px] text-blue-800">Submitted</Badge>;
  return <Badge className="border-0 bg-slate-100 text-[10px] text-slate-600">Not submitted</Badge>;
};

const coordinatorBadge = (status?: CoordinatorReviewStatus, submitted = true) => {
  if (!submitted) return <Badge className="border-0 bg-slate-100 text-[10px] font-semibold text-slate-600">Not submitted</Badge>;
  if (status === 'Verified') return <Badge className="border-0 bg-emerald-100 text-[10px] font-semibold text-emerald-800">Verified</Badge>;
  if (status === 'Needs Attention') return <Badge className="border-0 bg-amber-100 text-[10px] font-semibold text-amber-800">Needs attention</Badge>;
  return <Badge className="border-0 bg-blue-100 text-[10px] font-semibold text-blue-800">Not yet verified</Badge>;
};

export function CoordinatorRequirementsReview() {
  const { students, reviewCoordinatorRequirement } = useCoordinatorModuleData();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stage, setStage] = useState<RequirementStage>(searchParams.get('stage') === 'during' ? 'during' : searchParams.get('stage') === 'post' ? 'post' : 'pre');
  const [selectedRequirementName, setSelectedRequirementName] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<CoordinatorFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [remarks, setRemarks] = useState('');

  const matchingStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return students.filter(student =>
      (!term || student.name.toLowerCase().includes(term) || student.studentNumber.toLowerCase().includes(term) || student.program.toLowerCase().includes(term) || student.section.toLowerCase().includes(term) || student.adviserName.toLowerCase().includes(term)) &&
      (programFilter === 'all' || programName(student.program) === programFilter) &&
      (sectionFilter === 'all' || normalizeSection(student.section) === sectionFilter),
    );
  }, [programFilter, searchTerm, sectionFilter, students]);

  const programs = useMemo(() => Array.from(new Set(students.map(student => programName(student.program)))).sort(), [students]);
  const sections = useMemo(() => Array.from(new Set(students.map(student => normalizeSection(student.section)))).sort(), [students]);

  const requirementSummaries = useMemo(() => {
    const requirements = new Map<string, ReviewTarget[]>();
    matchingStudents.forEach(student => student[stages[stage].key].forEach(requirement => {
      const rows = requirements.get(requirement.name) || [];
      rows.push({ student, requirement, stage });
      requirements.set(requirement.name, rows);
    }));
    return Array.from(requirements.entries()).map(([name, submissions]) => ({
      name,
      submissions,
      submitted: submissions.filter(row => row.requirement.status !== 'Not Submitted').length,
      adviserApproved: submissions.filter(row => row.requirement.status === 'Approved').length,
      verified: submissions.filter(row => row.requirement.coordinatorStatus === 'Verified').length,
      attention: submissions.filter(row => row.requirement.coordinatorStatus === 'Needs Attention').length,
    }));
  }, [matchingStudents, stage]);

  const selectedRequirement = requirementSummaries.find(requirement => requirement.name === selectedRequirementName) || null;
  const visibleStudents = useMemo(() => {
    if (!selectedRequirement) return [];
    return selectedRequirement.submissions.filter(row => {
      const submitted = row.requirement.status !== 'Not Submitted';
      const status = row.requirement.coordinatorStatus || 'Pending';
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'NOT_SUBMITTED') return !submitted;
      if (!submitted) return false;
      if (statusFilter === 'VERIFIED') return status === 'Verified';
      if (statusFilter === 'ATTENTION') return status === 'Needs Attention';
      return status === 'Pending';
    });
  }, [selectedRequirement, statusFilter]);

  const selectStage = (next: RequirementStage) => {
    setStage(next);
    setSelectedRequirementName(null);
    setStatusFilter('ALL');
    setSearchParams({ stage: next });
  };

  const openReview = (submission: ReviewTarget) => {
    if (submission.requirement.status === 'Not Submitted') return;
    setTarget(submission);
    setRemarks(submission.requirement.coordinatorRemarks || '');
  };

  const decide = async (status: CoordinatorReviewStatus) => {
    try {
    if (!target || target.requirement.status !== 'Approved') return;
    await reviewCoordinatorRequirement(target.student.studentId, target.stage, target.requirement.name, status, remarks.trim());
    toast.success(status === 'Verified' ? 'Requirement verified by coordinator.' : 'Requirement flagged for adviser follow-up.');
    setTarget(null);
    setRemarks('');
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  return <div className="space-y-5 font-sans">
    <div><h1 className="text-2xl font-bold tracking-tight text-slate-900">Requirements Review</h1><p className="mt-0.5 text-sm text-slate-500">Review the same student submissions and adviser decisions without creating duplicate records.</p></div>

    <Card className="border-slate-200 shadow-sm"><CardContent className="p-2"><div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 p-1">
      {(Object.keys(stages) as RequirementStage[]).map(key => { const Icon = stages[key].icon; const count = key === stage ? requirementSummaries.length : new Set(matchingStudents.flatMap(student => student[stages[key].key].map(item => item.name))).size; return <Button key={key} variant="ghost" onClick={() => selectStage(key)} className={`h-11 cursor-pointer gap-2 text-xs font-bold ${stage === key ? 'bg-white text-[#800000] shadow-sm hover:bg-white hover:text-[#800000]' : 'text-slate-500 hover:bg-slate-200 hover:text-black'}`}><Icon className="h-4 w-4" />{stages[key].label}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span></Button>; })}
    </div></CardContent></Card>

    {selectedRequirement ? <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end"><div className="flex items-start gap-3"><Button variant="outline" size="icon" onClick={() => { setSelectedRequirementName(null); setStatusFilter('ALL'); }} className="mt-0.5 h-9 w-9 shrink-0 cursor-pointer hover:bg-slate-100 hover:text-slate-900" aria-label="Back to requirements"><ArrowLeft className="h-4 w-4" /></Button><div><p className="text-xs font-semibold uppercase tracking-wide text-[#800000]">{stages[stage].label}</p><h2 className="text-xl font-bold text-slate-900">{selectedRequirement.name}</h2><p className="mt-0.5 text-sm text-slate-500">{selectedRequirement.submissions.length} eligible students · adviser and coordinator decisions shown separately.</p></div></div><StudentFilters value={searchTerm} onChange={setSearchTerm} programFilter={programFilter} onProgramChange={setProgramFilter} programs={programs} sectionFilter={sectionFilter} onSectionChange={setSectionFilter} sections={sections} /></div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
        {([['ALL', 'All', selectedRequirement.submissions.length], ['PENDING', 'Not yet verified', selectedRequirement.submissions.filter(row => row.requirement.status !== 'Not Submitted' && (!row.requirement.coordinatorStatus || row.requirement.coordinatorStatus === 'Pending')).length], ['VERIFIED', 'Verified', selectedRequirement.verified], ['ATTENTION', 'Needs attention', selectedRequirement.attention], ['NOT_SUBMITTED', 'Not submitted', selectedRequirement.submissions.filter(row => row.requirement.status === 'Not Submitted').length]] as const).map(([value, label, count]) => <Button key={value} variant="ghost" onClick={() => setStatusFilter(value)} className={`h-8 cursor-pointer gap-1.5 rounded-full px-3 text-xs ${statusFilter === value ? 'bg-[#800000] text-white hover:bg-[#6b0000] hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-300 hover:text-black'}`}>{label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === value ? 'bg-white/20' : 'bg-slate-200 text-slate-700'}`}>{count}</span></Button>)}
      </div>

      {visibleStudents.length === 0 ? <EmptyState message="No students match this filter." /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{visibleStudents.map(row => <CoordinatorStudentCard key={row.student.studentId} row={row} onOpen={() => openReview(row)} />)}</div>}
    </section> : <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end"><div><h2 className="text-lg font-bold text-slate-900">{stages[stage].label} requirements</h2><p className="mt-0.5 text-sm text-slate-500">Open a requirement to see every student and the adviser review status.</p></div><StudentFilters value={searchTerm} onChange={setSearchTerm} programFilter={programFilter} onProgramChange={setProgramFilter} programs={programs} sectionFilter={sectionFilter} onSectionChange={setSectionFilter} sections={sections} /></div>
      {requirementSummaries.length === 0 ? <EmptyState message={`No configured ${stages[stage].label} requirements are available.`} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{requirementSummaries.map(requirement => <button key={requirement.name} type="button" onClick={() => { setSelectedRequirementName(requirement.name); setStatusFilter('ALL'); }} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#800000] hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-[#800000]"><ClipboardCheck className="h-5 w-5" /></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{requirement.submissions.length} eligible</span></div><h3 className="mt-4 text-sm font-bold text-slate-900">{requirement.name}</h3><div className="mt-4 grid grid-cols-2 gap-2 text-[11px]"><span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{requirement.submitted} submitted</span><span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{requirement.adviserApproved} adviser approved</span><span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{requirement.verified} verified</span><span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{requirement.attention} need attention</span></div></button>)}</div>}
    </section>}

    <Dialog open={!!target} onOpenChange={open => { if (!open) setTarget(null); }}><DialogContent className="max-h-[92vh] w-[calc(100%-2rem)] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Coordinator Requirement Review</DialogTitle><DialogDescription>{target?.requirement.name} submitted by {target ? formatStudentName(target.student.name) : ''}</DialogDescription></DialogHeader>{target && <div className="space-y-4">
      <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">Submission details</p>{coordinatorBadge(target.requirement.coordinatorStatus)}</div><div className="space-y-2 text-slate-600"><p><span className="font-semibold text-slate-800">Student:</span> {formatStudentName(target.student.name)} ({target.student.studentNumber})</p><p><span className="font-semibold text-slate-800">Requirement:</span> {target.requirement.name}</p><p><span className="font-semibold text-slate-800">Stage:</span> {stages[target.stage].label}</p><p><span className="font-semibold text-slate-800">Submitted:</span> {formatDateTime(target.requirement.submittedAt || target.requirement.updatedAt)}</p><p><span className="font-semibold text-slate-800">File:</span> {target.requirement.file?.name || target.requirement.fileName || 'No digital file attached'}</p></div><Button type="button" variant="outline" onClick={() => openNativeDocument(target.requirement.file)} disabled={!target.requirement.file?.url} className="w-full cursor-pointer justify-center border-[#800000]/30 text-[#800000] hover:bg-red-50 hover:text-[#600000]"><ExternalLink className="mr-1 h-4 w-4" />View Document</Button></section>
      <section className="space-y-2 rounded-lg border border-slate-200 p-4 text-sm"><div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">Adviser review</p>{adviserBadge(target.requirement.status)}</div><p className="text-slate-600"><span className="font-semibold text-slate-800">Adviser:</span> {target.student.adviserName}</p><p className="text-slate-600"><span className="font-semibold text-slate-800">Reviewed:</span> {formatDateTime(target.requirement.reviewedAt)}</p><p className="whitespace-pre-wrap text-slate-600"><span className="font-semibold text-slate-800">Remarks:</span> {target.requirement.remarks || 'No adviser remarks.'}</p></section>
      {target.requirement.status !== 'Approved' && <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Coordinator verification becomes available after the adviser approves this requirement.</p>}
      <div className="space-y-2"><Label htmlFor="coordinatorRequirementRemarks">Coordinator remarks</Label><textarea id="coordinatorRequirementRemarks" value={remarks} onChange={event => setRemarks(event.target.value)} placeholder="Add a verification note or explain what needs attention." className="min-h-28 w-full rounded-md border border-slate-200 p-2 text-sm" /></div>
    </div>}<DialogFooter><Button variant="outline" onClick={() => setTarget(null)} className="cursor-pointer hover:bg-slate-100 hover:text-slate-900">Close</Button><Button variant="outline" disabled={target?.requirement.status !== 'Approved'} onClick={() => decide('Needs Attention')} className="cursor-pointer border-amber-300 text-amber-800 hover:bg-amber-50 hover:text-amber-900"><AlertTriangle className="mr-1 h-4 w-4" />Flag for follow-up</Button><Button disabled={target?.requirement.status !== 'Approved'} onClick={() => decide('Verified')} className="cursor-pointer bg-green-600 hover:bg-green-700"><Check className="mr-1 h-4 w-4" />Verify</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function StudentFilters({ value, onChange, programFilter, onProgramChange, programs, sectionFilter, onSectionChange, sections }: { value: string; onChange: (value: string) => void; programFilter: string; onProgramChange: (value: string) => void; programs: string[]; sectionFilter: string; onSectionChange: (value: string) => void; sections: string[] }) {
  return <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto"><div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={value} onChange={event => onChange(event.target.value)} placeholder="Search assigned students..." className="bg-white pl-10 text-xs" /></div><select value={programFilter} onChange={event => onProgramChange(event.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 sm:w-40"><option value="all">All programs</option>{programs.map(program => <option key={program} value={program}>{program}</option>)}</select><select value={sectionFilter} onChange={event => onSectionChange(event.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 sm:w-28"><option value="all">All sections</option>{sections.map(section => <option key={section} value={section}>{section}</option>)}</select></div>;
}

function EmptyState({ message }: { message: string }) {
  return <Card className="border-dashed border-slate-300"><CardContent className="p-10 text-center text-sm text-slate-500">{message}</CardContent></Card>;
}

function CoordinatorStudentCard({ row, onOpen }: { row: ReviewTarget; onOpen: () => void }) {
  const submitted = row.requirement.status !== 'Not Submitted';
  return <button type="button" onClick={onOpen} disabled={!submitted} className={`min-h-44 rounded-xl border p-4 text-left shadow-sm transition-all ${submitted ? 'cursor-pointer border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#800000] hover:shadow-md' : 'cursor-default border-dashed border-slate-300 bg-slate-50'}`}><div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-[#800000]"><UserRound className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{formatStudentName(row.student.name)}</p><p className="mt-0.5 text-[10px] text-slate-500">{row.student.studentNumber}</p></div></div>{coordinatorBadge(row.requirement.coordinatorStatus, submitted)}</div><p className="mt-4 text-xs text-slate-600">{programName(row.student.program)} · {normalizeSection(row.student.section)}</p><div className="mt-3 space-y-1 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><p>{submitted ? `Submitted: ${row.requirement.submittedAt || row.requirement.updatedAt || 'Date not recorded'}` : 'No submission received yet'}</p><div className="flex items-center gap-1.5"><span>Adviser:</span>{adviserBadge(row.requirement.status)}</div></div>{submitted && <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#800000]"><Eye className="h-3.5 w-3.5" />View Document</div>}</button>;
}
