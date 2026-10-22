import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardCheck, ExternalLink, Eye, FileText, Files, Search, UserRound, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {toast} from 'sonner';
import { DTRRecord, RequirementItem, StudentOJTProfile, useOJT } from '../../context/OJTContext';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { openNativeDocument, RequirementFilePreview } from '../../components/forms/requirementFiles';
import { openDtrPdf } from '../../lib/dtrPdf';

type Stage = 'pre' | 'during' | 'post';
type RequirementKey = 'preOJTRequirements' | 'duringOJTRequirements' | 'postOJTRequirements';
type NormalizedStatus = 'NOT_SUBMITTED' | 'SUBMITTED' | 'UNDER_REVIEW' | 'REVISION_REQUESTED' | 'APPROVED';
type StudentRequirement = { student: StudentOJTProfile; requirement: RequirementItem; status: NormalizedStatus; dtr?: DTRRecord };
type ReviewTarget = StudentRequirement & { stage: Stage };

const stages: Record<Stage, { label: string; icon: React.ElementType; key: RequirementKey; previewStage: RequirementFilePreview['stage'] }> = {
  pre: { label: 'Pre-OJT', icon: ClipboardCheck, key: 'preOJTRequirements', previewStage: 'Pre-OJT' },
  during: { label: 'During OJT', icon: Files, key: 'duringOJTRequirements', previewStage: 'During-OJT' },
  post: { label: 'Post-OJT', icon: FileText, key: 'postOJTRequirements', previewStage: 'Post-OJT' },
};

const statusMeta: Record<NormalizedStatus, { label: string; className: string }> = {
  NOT_SUBMITTED: { label: 'Not submitted', className: 'bg-slate-100 text-slate-600' },
  SUBMITTED: { label: 'Submitted', className: 'bg-blue-100 text-blue-800' },
  UNDER_REVIEW: { label: 'Under review', className: 'bg-violet-100 text-violet-800' },
  REVISION_REQUESTED: { label: 'Revision requested', className: 'bg-slate-200 text-slate-700' },
  APPROVED: { label: 'Approved', className: 'bg-emerald-100 text-emerald-800' },
};

const normalizeStatus = (status: RequirementItem['status'] | undefined): NormalizedStatus => {
  if (status === 'Approved') return 'APPROVED';
  if (status === 'Needs Revision' || status === 'Rejected') return 'REVISION_REQUESTED';
  if (status === 'Under Review') return 'UNDER_REVIEW';
  if (status === 'Submitted') return 'SUBMITTED';
  return 'NOT_SUBMITTED';
};

const normalizeDtrStatus = (status: DTRRecord['status'] | undefined): NormalizedStatus => {
  if (status === 'Approved') return 'APPROVED';
  if (status === 'Needs Revision' || status === 'Revision Requested') return 'REVISION_REQUESTED';
  if (status === 'Under Review') return 'UNDER_REVIEW';
  if (status === 'Submitted') return 'SUBMITTED';
  return 'NOT_SUBMITTED';
};

const dtrRequirementStatus = (status: DTRRecord['status'] | undefined): RequirementItem['status'] => {
  if (status === 'Approved') return 'Approved';
  if (status === 'Needs Revision' || status === 'Revision Requested') return 'Needs Revision';
  if (status === 'Under Review') return 'Under Review';
  if (status === 'Submitted') return 'Submitted';
  return 'Not Submitted';
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

const formatSubmissionDate = (value?: string) => {
  if (!value) return 'Date and time not recorded';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
};



const statusBadge = (status: NormalizedStatus) => (
  <Badge className={`${statusMeta[status].className} border-0 text-[10px] font-semibold`}>{statusMeta[status].label}</Badge>
);

export function RequirementReviews() {
  const { user } = useAuth();
  const { students, companies, reviewPreOJTReq, reviewDuringOJTReq, reviewPostOJTReq, updateDTRStatus } = useOJT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [stage, setStage] = useState<Stage>(searchParams.get('stage') === 'during' ? 'during' : searchParams.get('stage') === 'post' ? 'post' : 'pre');
  const [selectedRequirementName, setSelectedRequirementName] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'REVISION_REQUESTED' | 'NOT_SUBMITTED'>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [programFilter, setProgramFilter] = useState('all');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [dtrPeriod, setDtrPeriod] = useState('');
  const [target, setTarget] = useState<ReviewTarget | null>(null);
  const [isReReviewing, setIsReReviewing] = useState(false);
  const [remarks, setRemarks] = useState('');

  const assignedStudents = useMemo(
    () => students.filter(student => user?.role === 'adviser' && student.adviserId === user.id),
    [students, user?.id, user?.role],
  );

  const matchingStudents = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return assignedStudents.filter(student =>
      (!term || student.name.toLowerCase().includes(term) || student.studentNumber.toLowerCase().includes(term) || student.program.toLowerCase().includes(term) || student.section.toLowerCase().includes(term)) &&
      (programFilter === 'all' || programName(student.program) === programFilter) &&
      (sectionFilter === 'all' || normalizeSection(student.section) === sectionFilter),
    );
  }, [assignedStudents, programFilter, searchTerm, sectionFilter]);

  const programs = useMemo(() => Array.from(new Set(assignedStudents.map(student => programName(student.program)))).sort(), [assignedStudents]);
  const sections = useMemo(() => Array.from(new Set(assignedStudents.map(student => normalizeSection(student.section)))).sort(), [assignedStudents]);
  const dtrPeriods = useMemo(() => Array.from(new Set(assignedStudents.flatMap(student => student.dtrHistory.map(dtr => dtr.month)))).sort((a, b) => b.localeCompare(a)), [assignedStudents]);
  const activeDtrPeriod = dtrPeriod || dtrPeriods[0] || new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(new Date());

  // Build the stage dataset from configured requirement records on assigned students.
  // Not Submitted rows stay in the result, acting as an eligible-students LEFT JOIN.
  const requirementSummaries = useMemo(() => {
    const requirements = new Map<string, StudentRequirement[]>();
    matchingStudents.forEach(student => {
      student[stages[stage].key].forEach(requirement => {
        const rows = requirements.get(requirement.name) || [];
        if (stage === 'during' && requirement.name === 'Daily Time Record') {
          const dtr = student.dtrHistory.filter(record => record.month === activeDtrPeriod).sort((a, b) => (b.version || 1) - (a.version || 1))[0];
          rows.push({ student, requirement: { ...requirement, status: dtrRequirementStatus(dtr?.status), remarks: dtr?.remarks || requirement.remarks }, status: normalizeDtrStatus(dtr?.status), dtr });
        } else {
          rows.push({ student, requirement, status: normalizeStatus(requirement.status) });
        }
        requirements.set(requirement.name, rows);
      });
    });

    return Array.from(requirements.entries()).map(([name, studentRequirements]) => {
      const counts: Record<NormalizedStatus, number> = {
        NOT_SUBMITTED: 0, SUBMITTED: 0, UNDER_REVIEW: 0, REVISION_REQUESTED: 0, APPROVED: 0,
      };
      studentRequirements.forEach(row => { counts[row.status] += 1; });
      return { name, students: studentRequirements, counts };
    });
  }, [activeDtrPeriod, matchingStudents, stage]);

  const selectedRequirement = requirementSummaries.find(requirement => requirement.name === selectedRequirementName) || null;
  const visibleStudents = useMemo(() => {
    if (!selectedRequirement) return [];
    return selectedRequirement.students.filter(row => {
      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'PENDING') return row.status === 'SUBMITTED' || row.status === 'UNDER_REVIEW';
      return row.status === statusFilter;
    });
  }, [selectedRequirement, statusFilter]);

  const selectStage = (next: Stage) => {
    setStage(next);
    setSelectedRequirementName(null);
    setStatusFilter('ALL');
    setSearchParams({ stage: next });
  };

  const openReview = (row: StudentRequirement) => {
    if (row.status === 'NOT_SUBMITTED') return;
    setTarget({ ...row, stage });
    setIsReReviewing(row.status !== 'APPROVED');
    setRemarks(row.requirement.remarks || '');
  };

  const hasReviewEvidence = !!(target?.dtr || target?.requirement.file?.url || (target?.stage === 'pre' && ['Practicum kit (expanded envelope)', 'Attendance OJT Orientation'].includes(target.requirement.name)));

  const openTargetDocument = () => {
    if (!target) return;
    if (target.dtr) {
      const company = companies.find(item => item.id === target.student.companyId);
      openDtrPdf({ dtr: target.dtr, studentName: target.student.name, studentNumber: target.student.studentNumber, companyName: target.student.companyName, supervisorName: company?.contactPerson });
      return;
    }
    openNativeDocument(target.requirement.file);
  };

  const decide = async (status: 'Approved' | 'Needs Revision') => {
    if (!target || !hasReviewEvidence) return;
    try {
    if (target.dtr) {
      await updateDTRStatus(target.student.studentId, target.dtr.id, status, remarks.trim());
      setTarget(null); setIsReReviewing(false); setRemarks('');
      return;
    }
    const review = target.stage === 'pre' ? reviewPreOJTReq : target.stage === 'during' ? reviewDuringOJTReq : reviewPostOJTReq;
    await review(target.student.studentId, target.requirement.name, status, remarks.trim());
    setTarget(null);
    setIsReReviewing(false);
    setRemarks('');
    } catch(error) { toast.error(error instanceof Error?error.message:'Review was not saved.'); }
  };

  return (
    <div className="space-y-5 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Review Requirements</h1>
        <p className="mt-0.5 text-sm text-slate-500">Review one configured requirement at a time across students assigned to you.</p>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-2">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-50 p-1">
            {(Object.keys(stages) as Stage[]).map(key => {
              const Icon = stages[key].icon;
              const count = key === stage
                ? requirementSummaries.length
                : new Set(assignedStudents.flatMap(student => student[stages[key].key].map(item => item.name))).size;
              return <Button key={key} variant="ghost" onClick={() => selectStage(key)} className={`h-11 cursor-pointer gap-2 text-xs font-bold ${stage === key ? 'bg-white text-[#800000] shadow-sm hover:bg-white hover:text-[#800000]' : 'text-slate-500 hover:bg-slate-200 hover:text-black'}`}><Icon className="h-4 w-4" />{stages[key].label}<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">{count}</span></Button>;
            })}
          </div>
        </CardContent>
      </Card>

      {selectedRequirement ? (
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div className="flex items-start gap-3">
              <Button variant="outline" size="icon" onClick={() => { setSelectedRequirementName(null); setStatusFilter('ALL'); }} className="mt-0.5 h-9 w-9 shrink-0 cursor-pointer hover:bg-slate-100 hover:text-slate-900" aria-label="Back to requirements"><ArrowLeft className="h-4 w-4" /></Button>
              <div><p className="text-xs font-semibold uppercase tracking-wide text-[#800000]">{stages[stage].label}</p><h2 className="text-xl font-bold text-slate-900">{selectedRequirement.name}</h2><p className="mt-0.5 text-sm text-slate-500">{selectedRequirement.students.length} eligible students · includes students without a submission.</p></div>
            </div>
            <StudentFilters value={searchTerm} onChange={setSearchTerm} programFilter={programFilter} onProgramChange={setProgramFilter} programs={programs} sectionFilter={sectionFilter} onSectionChange={setSectionFilter} sections={sections} />
          </div>

          {stage === 'during' && selectedRequirement.name === 'Daily Time Record' && <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 text-xs"><Label htmlFor="dtr-period" className="font-bold text-slate-700">Reporting period</Label><select id="dtr-period" value={activeDtrPeriod} onChange={event => setDtrPeriod(event.target.value)} className="h-8 cursor-pointer rounded-md border border-slate-300 bg-slate-100 px-2 font-medium text-slate-800">{[...new Set([activeDtrPeriod, ...dtrPeriods])].map(period => <option key={period} value={period}>{period}</option>)}</select></div>}

          <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            {([
              ['ALL', 'All', selectedRequirement.students.length],
              ['PENDING', 'Submitted / pending review', selectedRequirement.counts.SUBMITTED + selectedRequirement.counts.UNDER_REVIEW],
              ['APPROVED', 'Approved', selectedRequirement.counts.APPROVED],
              ['REVISION_REQUESTED', 'Revision requested', selectedRequirement.counts.REVISION_REQUESTED],
              ['NOT_SUBMITTED', 'Not submitted', selectedRequirement.counts.NOT_SUBMITTED],
            ] as const).map(([value, label, count]) => <Button key={value} variant="ghost" onClick={() => setStatusFilter(value)} className={`h-8 cursor-pointer gap-1.5 rounded-full px-3 text-xs ${statusFilter === value ? 'bg-[#800000] text-white hover:bg-[#6b0000] hover:text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-300 hover:text-black'}`}>{label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${statusFilter === value ? 'bg-white/20' : 'bg-slate-200 text-slate-700'}`}>{count}</span></Button>)}
          </div>

          {visibleStudents.length === 0 ? <EmptyState message="No assigned students match this filter." /> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {visibleStudents.map(row => <StudentCard key={row.student.studentId} row={row} onOpen={() => openReview(row)} />)}
          </div>}
        </section>
      ) : (
        <section className="space-y-4">
          <div className="flex flex-col justify-between gap-3 xl:flex-row xl:items-end"><div><h2 className="text-lg font-bold text-slate-900">{stages[stage].label} requirements</h2><p className="mt-0.5 text-sm text-slate-500">Open a requirement to see every assigned student expected to submit it.</p></div><StudentFilters value={searchTerm} onChange={setSearchTerm} programFilter={programFilter} onProgramChange={setProgramFilter} programs={programs} sectionFilter={sectionFilter} onSectionChange={setSectionFilter} sections={sections} /></div>
          {requirementSummaries.length === 0 ? <EmptyState message={`No configured ${stages[stage].label} requirements are assigned to your students.`} /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {requirementSummaries.map(requirement => <button key={requirement.name} type="button" onClick={() => { setSelectedRequirementName(requirement.name); setStatusFilter('ALL'); }} className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-[#800000] hover:shadow-md"><div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-50 text-[#800000]"><ClipboardCheck className="h-5 w-5" /></div><span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-600">{requirement.students.length} eligible</span></div><h3 className="mt-4 text-sm font-bold text-slate-900">{requirement.name}</h3><div className="mt-4 grid grid-cols-2 gap-2 text-[11px]"><span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{requirement.counts.SUBMITTED} submitted</span><span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{requirement.counts.NOT_SUBMITTED} not submitted</span><span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{requirement.counts.UNDER_REVIEW} under review</span><span className="rounded-md bg-slate-100 px-2 py-1.5 text-slate-700">{requirement.counts.REVISION_REQUESTED} revisions</span></div></button>)}
          </div>}
        </section>
      )}

      <Dialog open={!!target} onOpenChange={open => { if (!open) { setTarget(null); setIsReReviewing(false); } }}>
        <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{target?.status === 'APPROVED' && !isReReviewing ? 'Approved submission' : 'Review submission'}</DialogTitle><DialogDescription>{target?.requirement.name} submitted by {target ? formatStudentName(target.student.name) : ''}</DialogDescription></DialogHeader>
          {target && <div className="space-y-4">
            <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">Submission details</p>
                {statusBadge(target.status)}
              </div>
              <div className="space-y-2 text-slate-600">
                <p><span className="font-semibold text-slate-800">Student:</span> {formatStudentName(target.student.name)} ({target.student.studentNumber})</p>
                <p><span className="font-semibold text-slate-800">Requirement:</span> {target.requirement.name}</p>
                <p><span className="font-semibold text-slate-800">Stage:</span> {stages[target.stage].label}</p>
                <p><span className="font-semibold text-slate-800">Submitted:</span> {formatSubmissionDate(target.dtr?.submittedAt || target.requirement.submittedAt || target.requirement.updatedAt)}</p>
                {target.dtr ? <p><span className="font-semibold text-slate-800">Record:</span> {target.dtr.month} · Version {target.dtr.version || 1} · {target.dtr.totalHours.toFixed(2)} hours</p> : <p><span className="font-semibold text-slate-800">File:</span> {target.requirement.file?.name || target.requirement.fileName || 'No digital file attached'}</p>}
              </div>
              <Button type="button" variant="outline" onClick={openTargetDocument} disabled={!target.dtr && !target.requirement.file?.url} className="w-full cursor-pointer justify-center border-[#800000]/30 text-[#800000] hover:bg-red-50 hover:text-[#600000]">
                <ExternalLink className="mr-1 h-4 w-4" />View Document
              </Button>
            </section>
            {target.requirement.coordinatorStatus && target.requirement.coordinatorStatus !== 'Pending' && <section className={`rounded-lg border p-3 text-sm ${target.requirement.coordinatorStatus === 'Verified' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
              <p className="font-semibold">Coordinator review: {target.requirement.coordinatorStatus}</p>
              <p className="mt-1 text-xs">Reviewed {formatSubmissionDate(target.requirement.coordinatorReviewedAt)}</p>
              <p className="mt-2 whitespace-pre-wrap">{target.requirement.coordinatorRemarks || 'No coordinator remarks.'}</p>
            </section>}
            {target.status === 'APPROVED' && !isReReviewing ? <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">This document was previously approved.</p><p className="mt-1 text-xs text-emerald-800">You can still view it or review the decision again if something needs to change.</p></div> : <div className="space-y-2"><Label htmlFor="requirementRemarks">Review remarks</Label><textarea id="requirementRemarks" value={remarks} onChange={event => setRemarks(event.target.value)} placeholder="Add an approval note or describe the required revision." className="min-h-28 w-full rounded-md border border-slate-200 p-2 text-sm" /></div>}
          </div>}
          <DialogFooter>{target?.status === 'APPROVED' && !isReReviewing ? <><Button variant="outline" onClick={() => setTarget(null)} className="cursor-pointer hover:bg-slate-100 hover:text-slate-900">Close</Button><Button onClick={() => setIsReReviewing(true)} className="cursor-pointer bg-[#800000] hover:bg-[#6b0000]">Review again</Button></> : <><Button variant="outline" onClick={() => setTarget(null)} className="cursor-pointer hover:bg-slate-100 hover:text-slate-900">Cancel</Button><Button variant="outline" disabled={!hasReviewEvidence} onClick={() => decide('Needs Revision')} className="cursor-pointer border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"><X className="mr-1 h-4 w-4" />Request revision</Button><Button disabled={!hasReviewEvidence} onClick={() => decide('Approved')} className="cursor-pointer bg-green-600 hover:bg-green-700"><Check className="mr-1 h-4 w-4" />Approve</Button></>}</DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StudentFilters({ value, onChange, programFilter, onProgramChange, programs, sectionFilter, onSectionChange, sections }: { value: string; onChange: (value: string) => void; programFilter: string; onProgramChange: (value: string) => void; programs: string[]; sectionFilter: string; onSectionChange: (value: string) => void; sections: string[] }) {
  return <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
    <div className="relative w-full sm:w-64"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={value} onChange={event => onChange(event.target.value)} placeholder="Search assigned students..." className="bg-white pl-10 text-xs" /></div>
    <select value={programFilter} onChange={event => onProgramChange(event.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 sm:w-40"><option value="all">All programs</option>{programs.map(program => <option key={program} value={program}>{program}</option>)}</select>
    <select value={sectionFilter} onChange={event => onSectionChange(event.target.value)} className="h-9 w-full cursor-pointer rounded-md border border-slate-300 bg-slate-100 px-3 text-xs font-medium text-slate-800 hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-[#800000]/20 sm:w-28"><option value="all">All sections</option>{sections.map(section => <option key={section} value={section}>{section}</option>)}</select>
  </div>;
}

function EmptyState({ message }: { message: string }) {
  return <Card className="border-dashed border-slate-300"><CardContent className="p-10 text-center text-sm text-slate-500">{message}</CardContent></Card>;
}

function StudentCard({ row, onOpen }: { row: StudentRequirement; onOpen: () => void }) {
  const isSubmitted = row.status !== 'NOT_SUBMITTED';
  const submissionDate = row.requirement.submittedAt || (isSubmitted ? row.requirement.updatedAt : undefined);
  const revisionCount = row.requirement.revisionCount || (row.status === 'REVISION_REQUESTED' ? 1 : 0);
  return <button type="button" onClick={onOpen} disabled={!isSubmitted} className={`min-h-44 rounded-xl border p-4 text-left shadow-sm transition-all ${isSubmitted ? 'cursor-pointer border-slate-200 bg-white hover:-translate-y-0.5 hover:border-[#800000] hover:shadow-md' : 'cursor-default border-dashed border-slate-300 bg-slate-50'}`}>
    <div className="flex items-start justify-between gap-3"><div className="flex min-w-0 items-center gap-2"><div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-[#800000]"><UserRound className="h-4 w-4" /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-slate-800">{formatStudentName(row.student.name)}</p><p className="mt-0.5 text-[10px] text-slate-500">{row.student.studentNumber}</p></div></div>{statusBadge(row.status)}</div>
    <p className="mt-4 text-xs text-slate-600">{row.student.program.split('—')[0].trim()} · {normalizeSection(row.student.section)}</p>
    <div className="mt-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500"><p>{row.dtr ? `${row.dtr.totalHours.toFixed(2)} hrs · Submitted: ${row.dtr.submittedAt || 'Date not recorded'}` : isSubmitted ? `Submitted: ${submissionDate || 'Date not recorded'}` : 'No submission received yet'}</p>{revisionCount > 0 && <p className="mt-1 font-semibold text-slate-700">{revisionCount} revision {revisionCount === 1 ? 'request' : 'requests'}</p>}</div>
    {isSubmitted && <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#800000]"><Eye className="h-3.5 w-3.5" />View Document</div>}
  </button>;
}
