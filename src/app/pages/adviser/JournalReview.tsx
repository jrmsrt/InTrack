import React, { useState } from 'react';
import { useOJT } from '../../context/OJTContext';
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
import { 
  Check, 
  X, 
  Search, 
  BookOpen, 
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

export function JournalReview() {
  const { students, reviewWeeklyJournal } = useOJT();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [weekNumberFilter, setWeekNumberFilter] = useState('all');
  const [selectedJournal, setSelectedJournal] = useState<{ studentId: string; studentName: string; studentNumber: string; section: string; program: string; companyName: string; journalId: string; weekNumber: number; startDate: string; endDate: string; tasks: any[]; reflection: string; problems: string; totalHours: number; status: string; remarks?: string; submittedAt?: string } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

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

  const getComparableSection = (section: string) => {
    const normalizedSection = section.trim().toUpperCase();
    const legacyMatch = normalizedSection.match(/\b([34])([AB])$/);

    if (legacyMatch) {
      return `${legacyMatch[1]}-${legacyMatch[2] === 'A' ? '1' : '2'}`;
    }

    return section.trim();
  };

  // Flatten weekly journals
  const allJournals = students.flatMap(s => 
    s.weeklyJournals.map(j => ({
      journalId: j.id,
      weekNumber: j.weekNumber,
      startDate: j.startDate,
      endDate: j.endDate,
      tasks: j.tasks,
      reflection: j.reflection,
      problems: j.problems,
      totalHours: j.totalHours,
      status: j.status,
      remarks: j.remarks,
      submittedAt: j.submittedAt,
      studentId: s.studentId,
      studentName: s.name,
      studentNumber: s.studentNumber,
      section: s.section,
      program: s.program,
      companyName: s.companyName
    }))
  ).sort((a, b) => b.weekNumber - a.weekNumber);

  // Filter journals
  const filteredJournals = allJournals.filter(j => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch = j.studentName.toLowerCase().includes(normalizedSearch) ||
                          j.studentNumber.includes(searchTerm) ||
                          j.companyName.toLowerCase().includes(normalizedSearch) ||
                          j.status.toLowerCase().includes(normalizedSearch) ||
                          `week ${j.weekNumber}`.includes(normalizedSearch) ||
                          String(j.weekNumber).includes(searchTerm);
    const matchesSection = sectionFilter === 'all' || getComparableSection(j.section) === sectionFilter;
    const matchesProgram = programFilter === 'all' || j.program.includes(programFilter);
    const matchesWeek = weekNumberFilter === 'all' || String(j.weekNumber) === weekNumberFilter;
    return matchesSearch && matchesSection && matchesProgram && matchesWeek;
  });

  const weekNumberOptions = Array.from(new Set(allJournals.map(j => j.weekNumber))).sort((a, b) => a - b);

  const handleReviewAction = async (status: 'Approved' | 'Needs Revision') => {
    if (!selectedJournal) return;

    try {
    await reviewWeeklyJournal(selectedJournal.studentId, selectedJournal.journalId, status, remarks);
    toast.success(`Weekly Journal for Week ${selectedJournal.weekNumber} is now ${status === 'Approved' ? 'Approved' : 'Returned'}`);
    
    setReviewDialogOpen(false);
    setSelectedJournal(null);
    setRemarks('');
    } catch(error) { toast.error(error instanceof Error?error.message:'Review was not saved.'); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" /> Approved</Badge>;
      case 'Needs Revision':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-250"><AlertTriangle className="h-3 w-3 mr-1" /> Needs Revision</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="h-3 w-3 mr-1" /> Submitted</Badge>;
    }
  };

  const handleOpenJournal = (journal: typeof selectedJournal) => {
    if (!journal) return;
    sessionStorage.setItem(`weeklyJournal:${journal.journalId}`, JSON.stringify({
      studentId: journal.studentId,
      journal: {
        id: journal.journalId,
        weekNumber: journal.weekNumber,
        startDate: journal.startDate,
        endDate: journal.endDate,
        tasks: journal.tasks,
        reflection: journal.reflection,
        problems: journal.problems,
        totalHours: journal.totalHours,
        status: journal.status,
        remarks: journal.remarks
      },
      reflection: journal.reflection,
      problems: journal.problems,
      assignedDepartment: 'OJT Department'
    }));
    setSelectedJournal(journal);
    setRemarks('');
    setReviewDialogOpen(true);
  };

  const handleViewDocument = () => {
    if (!selectedJournal) return;
    window.open(`/print-weekly-journal/${selectedJournal.journalId}?preview=1&zoom=1`, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Weekly Journal Review</h1>
          <p className="text-slate-500 text-sm mt-0.5">Audit and endorse weekly OJT accomplishment journals compiled by interns.</p>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1.5 w-full">
            <Label htmlFor="journal-search" className="text-xs">Search journal</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="journal-search"
                type="search"
                placeholder="Search student, ID, company, week, or status..."
                className="pl-10 text-xs bg-slate-50 border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full md:w-48 space-y-1.5">
            <Label htmlFor="journal-program" className="text-xs">Program Course</Label>
            <select
              id="journal-program"
              value={programFilter}
              onChange={(e) => setProgramFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2 text-xs focus:ring-[#800000] focus:border-[#800000]"
            >
              <option value="all">All Programs</option>
              <option value="BSIT">BSIT</option>
              <option value="BSCpE">BSCpE</option>
              <option value="BSHM">BSHM</option>
              <option value="BSOA">BSOA</option>
            </select>
          </div>

          <div className="w-full md:w-48 space-y-1.5">
            <Label htmlFor="journal-section" className="text-xs">Class Section</Label>
            <select
              id="journal-section"
              value={sectionFilter}
              onChange={(e) => setSectionFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2 text-xs focus:ring-[#800000] focus:border-[#800000]"
            >
              <option value="all">All Sections</option>
              <option value="3-1">3-1</option>
              <option value="3-2">3-2</option>
              <option value="4-1">4-1</option>
              <option value="4-2">4-2</option>
            </select>
          </div>

          <div className="w-full md:w-40 space-y-1.5">
            <Label htmlFor="journal-week" className="text-xs">Week Number</Label>
            <select
              id="journal-week"
              value={weekNumberFilter}
              onChange={(e) => setWeekNumberFilter(e.target.value)}
              className="w-full bg-slate-50 border border-slate-250 rounded-lg p-2 text-xs focus:ring-[#800000] focus:border-[#800000]"
            >
              <option value="all">All Weeks</option>
              {weekNumberOptions.map((weekNumber) => (
                <option key={weekNumber} value={weekNumber}>Week {weekNumber}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800">Submitted Journals Queue</CardTitle>
          <CardDescription>Verify student reflections and total logged hours details before endorsing.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {filteredJournals.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No weekly journals submitted.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Student Name</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Week Number</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Total Hours</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Weekly Journal File</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Status</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center w-28">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredJournals.map((j) => (
                  <TableRow key={j.journalId} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 text-xs block">{j.studentName}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{j.studentNumber} | {j.section}</span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 font-semibold text-xs text-slate-805">
                      Week {j.weekNumber}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-bold text-slate-800">
                      {j.totalHours} hrs
                    </TableCell>
                    <TableCell className="py-3.5 px-4 max-w-xs text-xs">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenJournal(j)}
                        className="h-7 text-[10px] font-semibold text-[#800000] border-red-200 hover:bg-red-50 hover:text-[#6b0000] hover:border-red-300 cursor-pointer"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        Weekly_Journal_Week_{j.weekNumber}.pdf
                      </Button>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 font-semibold text-xs">
                      {getStatusBadge(j.status)}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => handleOpenJournal(j)}
                        className="bg-[#800000] hover:bg-[#6b0000] text-white text-[10px] h-7 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        Audit Journal
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog Document Preview style */}
      {selectedJournal && (
        <Dialog open={reviewDialogOpen} onOpenChange={() => setReviewDialogOpen(false)}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto font-sans">
            <DialogHeader>
              <DialogTitle>Audit Weekly Report Journal</DialogTitle>
              <DialogDescription>
                Verify reflections and hour validations for <span className="font-bold">{selectedJournal.studentName}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">Submission details</h3>
                  {getStatusBadge(selectedJournal.status)}
                </div>
                <p><span className="font-semibold text-slate-800">Student:</span> {selectedJournal.studentName} ({selectedJournal.studentNumber})</p>
                <p><span className="font-semibold text-slate-800">Program and section:</span> {selectedJournal.program} / {selectedJournal.section}</p>
                <p><span className="font-semibold text-slate-800">Journal period:</span> Week {selectedJournal.weekNumber}, {selectedJournal.startDate} to {selectedJournal.endDate}</p>
                <p><span className="font-semibold text-slate-800">Company:</span> {selectedJournal.companyName}</p>
                <p><span className="font-semibold text-slate-800">Total hours:</span> {selectedJournal.totalHours} hrs</p>
                <p><span className="font-semibold text-slate-800">Submitted:</span> {formatSubmissionDate(selectedJournal.submittedAt)}</p>
              </section>

              <Button type="button" variant="outline" className="w-full" onClick={handleViewDocument}>
                <ExternalLink className="mr-2 h-4 w-4" /> View Document
              </Button>

              {/* Remarks Field */}
              <div className="space-y-1.5">
                <Label htmlFor="journalRemarks" className="text-xs">Add Adviser Remarks / Remarks</Label>
                <Input
                  id="journalRemarks"
                  placeholder="e.g. Approved. Thorough reflection on software review criteria."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => handleReviewAction('Needs Revision')}
                className="text-xs cursor-pointer"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Return for Revision
              </Button>
              <Button
                onClick={() => handleReviewAction('Approved')}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Endorse Weekly Report
              </Button>
            </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
