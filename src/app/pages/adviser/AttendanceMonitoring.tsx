import React, { useState } from 'react';
import { useOJT, DTRRecord } from '../../context/OJTContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { 
  Search, 
  MapPin, 
  AlertTriangle, 
  CheckCircle2, 
  Calendar, 
  Clock,
  FileText,
  ExternalLink,
  Sliders,
  Check,
  X
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { toast } from 'sonner';
import { openDtrPdf } from '../../lib/dtrPdf';

export function AttendanceMonitoring() {
  const { students, companies, updateDTRStatus, reviewAttendanceCorrection } = useOJT();
  const { user } = useAuth();
  
  const [activeTab, setActiveTab] = useState<'logs' | 'corrections' | 'dtrs'>('logs');
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('');
  const [weekFilter, setWeekFilter] = useState('');
  const [dtrMonthFilter, setDtrMonthFilter] = useState('');
  
  // Review Dialog States
  const [selectedDtr, setSelectedDtr] = useState<any | null>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedCorrection, setSelectedCorrection] = useState<any | null>(null);
  const [correctionRemarks, setCorrectionRemarks] = useState('');

  const getComparableSection = (section: string) => {
    const normalizedSection = section.trim().toUpperCase();
    const legacyMatch = normalizedSection.match(/\b([34])([AB])$/);

    if (legacyMatch) {
      return `${legacyMatch[1]}-${legacyMatch[2] === 'A' ? '1' : '2'}`;
    }

    return section.trim();
  };

  const getWeekRange = (weekValue: string) => {
    const [yearValue, weekNumberValue] = weekValue.split('-W');
    const year = Number(yearValue);
    const weekNumber = Number(weekNumberValue);

    if (!year || !weekNumber) return null;

    const janFourth = new Date(year, 0, 4);
    const janFourthDay = janFourth.getDay() || 7;
    const firstWeekMonday = new Date(janFourth);
    firstWeekMonday.setDate(janFourth.getDate() - janFourthDay + 1);

    const start = new Date(firstWeekMonday);
    start.setDate(firstWeekMonday.getDate() + (weekNumber - 1) * 7);

    const end = new Date(start);
    end.setDate(start.getDate() + 6);

    return { start, end };
  };

  const isDateWithinWeek = (dateValue: string, weekValue: string) => {
    const range = getWeekRange(weekValue);
    if (!range) return true;

    const date = new Date(`${dateValue}T00:00:00`);
    return date >= range.start && date <= range.end;
  };

  // Flatten all attendance logs across all students
  const allLogs = students.flatMap(s => 
    s.attendanceHistory.map(a => ({
      ...a,
      studentName: s.name,
      studentNumber: s.studentNumber,
      program: s.program,
      section: s.section,
      companyName: s.companyName
    }))
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Flatten all DTR submissions
  const allDTRs = students.flatMap(s => 
    (s.dtrHistory || []).map(d => ({
      ...d,
      studentId: s.studentId,
      studentName: s.name,
      studentNumber: s.studentNumber,
      section: s.section,
      program: s.program,
      companyName: s.companyName
    }))
  ).sort((a, b) => {
    const dateA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
    const dateB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
    return dateB - dateA;
  });

  // Filter logs list
  const filteredLogs = allLogs.filter(log => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch = log.studentName.toLowerCase().includes(normalizedSearch) || 
                          log.studentNumber.includes(searchTerm) ||
                          log.date.toLowerCase().includes(normalizedSearch) ||
                          log.locationStatus.toLowerCase().includes(normalizedSearch) ||
                          log.companyName.toLowerCase().includes(normalizedSearch);
    const matchesSection = sectionFilter === 'all' || getComparableSection(log.section) === sectionFilter;
    const matchesProgram = programFilter === 'all' || log.program.includes(programFilter);
    const matchesDate = !dateFilter || log.date === dateFilter;
    const matchesWeek = !weekFilter || isDateWithinWeek(log.date, weekFilter);
    return matchesSearch && matchesSection && matchesProgram && matchesDate && matchesWeek;
  });

  const correctionRequests = allLogs.filter(log => log.correction).filter(log => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch = log.studentName.toLowerCase().includes(normalizedSearch) || log.studentNumber.includes(searchTerm) || log.date.includes(searchTerm) || log.correction.reason.toLowerCase().includes(normalizedSearch);
    const matchesSection = sectionFilter === 'all' || getComparableSection(log.section) === sectionFilter;
    const matchesProgram = programFilter === 'all' || log.program.includes(programFilter);
    return matchesSearch && matchesSection && matchesProgram;
  });
  const pendingCorrectionCount = correctionRequests.filter(log => log.correction.status === 'Pending').length;

  // Filter DTRs list
  const filteredDTRs = allDTRs.filter(dtr => {
    const normalizedSearch = searchTerm.toLowerCase();
    const matchesSearch = dtr.studentName.toLowerCase().includes(normalizedSearch) || 
                          dtr.studentNumber.includes(searchTerm) ||
                          dtr.month.toLowerCase().includes(normalizedSearch) ||
                          dtr.status.toLowerCase().includes(normalizedSearch) ||
                          dtr.companyName.toLowerCase().includes(normalizedSearch);
    const matchesSection = sectionFilter === 'all' || getComparableSection(dtr.section) === sectionFilter;
    const matchesProgram = programFilter === 'all' || dtr.program.includes(programFilter);
    const matchesMonth = !dtrMonthFilter || dtr.startDate.startsWith(dtrMonthFilter);
    return matchesSearch && matchesSection && matchesProgram && matchesMonth;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Location Verified':
      case 'Attendance Recorded':
        return <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 font-bold px-2 py-0.5 rounded text-[10px] gap-1"><CheckCircle2 className="h-3 w-3" /> Location Verified</Badge>;
      case 'Outside Deployment Area':
        return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 font-bold px-2 py-0.5 rounded text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> Outside Geofence</Badge>;
      case 'Location Permission Denied':
      case 'Invalid Location':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-250 hover:bg-amber-100 font-bold px-2 py-0.5 rounded text-[10px] gap-1"><AlertTriangle className="h-3 w-3" /> GPS Shielded</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200">{status}</Badge>;
    }
  };

  const getDtrBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200 font-bold">Approved</Badge>;
      case 'Needs Revision':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-bold">Needs Revision</Badge>;
      case 'Submitted':
      case 'Under Review':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-bold">Submitted</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200">{status}</Badge>;
    }
  };

  const handleOpenReview = (dtr: any) => {
    setSelectedDtr(dtr);
    setRemarks(dtr.remarks || '');
    setReviewDialogOpen(true);
  };

  const handleReviewAction = async (status: DTRRecord['status']) => {
    if (!selectedDtr) return;
    try {
    await updateDTRStatus(selectedDtr.studentId, selectedDtr.id, status, remarks);
    toast.success(`DTR status updated to ${status}`, {
      description: `Student: ${selectedDtr.studentName}`
    });
    setReviewDialogOpen(false);
    setSelectedDtr(null);
    setRemarks('');
    } catch(error) { toast.error(error instanceof Error?error.message:'DTR review was not saved.'); }
  };

  const handleOpenDtrPdf = (dtr: any) => {
    const student = students.find(item => item.studentId === dtr.studentId);
    if (!student) return;
    const company = companies.find(item => item.id === student.companyId);
    openDtrPdf({ dtr, studentName: student.name, studentNumber: student.studentNumber, companyName: student.companyName, supervisorName: company?.contactPerson });
  };

  const handleCorrectionDecision = async (decision: 'Approved' | 'Rejected') => {
    if (!selectedCorrection || !user) return;
    try {
    await reviewAttendanceCorrection(selectedCorrection.studentId, selectedCorrection.id, decision, user.name, correctionRemarks);
    toast.success(`Attendance correction ${decision.toLowerCase()}.`, { description: `Student: ${selectedCorrection.studentName}` });
    setSelectedCorrection(null);
    setCorrectionRemarks('');
    } catch(error) { toast.error(error instanceof Error?error.message:'Correction review was not saved.'); }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Attendance Monitoring</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-normal">Audit student clock-ins, geofence coordinate logs, and approve Daily Time Records.</p>
        </div>
        
        {/* Tab triggers */}
        <div className="flex gap-1.5 bg-slate-100 p-1.5 rounded-lg border border-slate-200 text-xs self-start">
          <Button
            onClick={() => setActiveTab('corrections')}
            variant={activeTab === 'corrections' ? 'secondary' : 'ghost'}
            className={`h-8 text-xs font-bold cursor-pointer ${activeTab === 'corrections' ? 'bg-white shadow-sm hover:bg-white' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
          >
            Corrections {pendingCorrectionCount > 0 && <span className="ml-1 rounded-full bg-[#800000] px-1.5 py-0.5 text-[9px] text-white">{pendingCorrectionCount}</span>}
          </Button>
          <Button
            onClick={() => setActiveTab('logs')}
            variant={activeTab === 'logs' ? 'secondary' : 'ghost'}
            className={`h-8 text-xs font-bold cursor-pointer ${activeTab === 'logs' ? 'bg-white shadow-sm hover:bg-white' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
          >
            Clock-In Logs
          </Button>
          <Button
            onClick={() => setActiveTab('dtrs')}
            variant={activeTab === 'dtrs' ? 'secondary' : 'ghost'}
            className={`h-8 text-xs font-bold cursor-pointer ${activeTab === 'dtrs' ? 'bg-white shadow-sm hover:bg-white' : 'text-slate-600 hover:bg-white/70 hover:text-slate-900'}`}
          >
            DTR Review Board
          </Button>
        </div>
      </div>

      {/* Filter panel */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1.5 w-full">
            <Label htmlFor="attendance-search" className="text-xs">Search student</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="attendance-search"
                type="search"
                placeholder={activeTab === 'logs' ? "Search student, ID, company, or date..." : activeTab === 'corrections' ? "Search student, ID, date, or reason..." : "Search student, ID, company, month, or status..."}
                className="pl-10 text-xs bg-slate-50 border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full md:w-48 space-y-1.5">
            <Label htmlFor="attendance-program" className="text-xs">Program Course</Label>
            <select
              id="attendance-program"
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
            <Label htmlFor="attendance-section" className="text-xs">Class Section</Label>
            <select
              id="attendance-section"
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

          {activeTab === 'logs' && (
            <>
              <div className="w-full md:w-40 space-y-1.5">
                <Label htmlFor="attendance-date" className="text-xs">Log Date</Label>
                <Input
                  id="attendance-date"
                  type="date"
                  value={dateFilter}
                  onChange={(e) => {
                    setDateFilter(e.target.value);
                    if (e.target.value) setWeekFilter('');
                  }}
                  className="text-xs bg-slate-50 border-slate-200"
                />
              </div>

              <div className="w-full md:w-40 space-y-1.5">
                <Label htmlFor="attendance-week" className="text-xs">Log Week</Label>
                <Input
                  id="attendance-week"
                  type="week"
                  value={weekFilter}
                  onChange={(e) => {
                    setWeekFilter(e.target.value);
                    if (e.target.value) setDateFilter('');
                  }}
                  className="text-xs bg-slate-50 border-slate-200"
                />
              </div>
            </>
          )}

          {activeTab === 'dtrs' && (
            <div className="w-full md:w-40 space-y-1.5">
              <Label htmlFor="dtr-month" className="text-xs">DTR Month</Label>
              <Input
                id="dtr-month"
                type="month"
                value={dtrMonthFilter}
                onChange={(e) => setDtrMonthFilter(e.target.value)}
                className="text-xs bg-slate-50 border-slate-200"
              />
            </div>
          )}
        </CardContent>
      </Card>

      {activeTab === 'logs' ? (
        /* Tab 1: Real-time logs */
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800">Verification Logs</CardTitle>
            <CardDescription className="text-xs font-normal">Audited punch events with Geolocation coordinate checks.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Intern</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Deployment Company</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Date</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Clock In/Out</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Hours Rendered</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Geofence Validation</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Log Coordinates</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Correction request</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-slate-400 font-semibold font-sans">
                      No punch log entries match selection.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors text-xs font-sans">
                      <TableCell className="py-3 px-4">
                        <span className="font-bold text-slate-800 text-xs block">{log.studentName}</span>
                        <span className="text-[10px] text-slate-400 font-semibold">{log.studentNumber} | {log.section}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4 font-semibold text-slate-650">
                        {log.companyName}
                      </TableCell>
                      <TableCell className="py-3 px-4 font-semibold text-slate-805">
                        {log.date}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        <span className="text-xs font-bold text-slate-700 block">{log.timeIn}</span>
                        <span className="text-[10px] text-slate-450 font-medium">Out: {log.timeOut || '—'}</span>
                      </TableCell>
                      <TableCell className="py-3 px-4 font-extrabold text-slate-800 text-xs">
                        {log.totalHours > 0 ? `${log.totalHours.toFixed(2)} hrs` : '—'}
                      </TableCell>
                      <TableCell className="py-3 px-4 font-semibold">
                        {getStatusBadge(log.locationStatus)}
                      </TableCell>
                      <TableCell className="py-3 px-4 font-mono text-[10px] text-slate-500">
                        {log.gpsCoordinates ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-450 shrink-0" />
                            {log.gpsCoordinates.lat.toFixed(4)}, {log.gpsCoordinates.lng.toFixed(4)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="py-3 px-4">
                        {log.correction ? (
                          <div className="space-y-1.5">
                            <Badge className={log.correction.status === 'Approved' ? 'bg-green-100 text-green-800' : log.correction.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{log.correction.status}</Badge>
                            {log.correction.status === 'Pending' && <Button size="sm" variant="outline" onClick={() => { setSelectedCorrection(log); setCorrectionRemarks(''); }} className="h-7 border-[#800000] text-[10px] font-bold text-[#800000]">Review request</Button>}
                          </div>
                        ) : <span className="text-[10px] text-slate-400">—</span>}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : activeTab === 'corrections' ? (
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="border-b border-slate-100 pb-3"><CardTitle className="text-base font-bold text-slate-800">Attendance Correction Requests</CardTitle><CardDescription className="text-xs">Review requested changes with the original attendance data and permanent audit history.</CardDescription></CardHeader>
          <CardContent className="p-0 overflow-x-auto"><Table><TableHeader><TableRow className="bg-slate-50/50"><TableHead>Student</TableHead><TableHead>Date</TableHead><TableHead>Original time</TableHead><TableHead>Requested time</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader><TableBody>
            {correctionRequests.length === 0 ? <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-slate-400">No attendance correction requests found.</TableCell></TableRow> : correctionRequests.map(log => <TableRow key={log.id} className="text-xs"><TableCell><p className="font-bold">{log.studentName}</p><p className="text-[10px] text-slate-400">{log.studentNumber}</p></TableCell><TableCell>{log.date}</TableCell><TableCell>{log.correction.originalTimeIn} — {log.correction.originalTimeOut || 'Not recorded'}</TableCell><TableCell className="font-semibold text-[#800000]">{log.correction.requestedTimeIn} — {log.correction.requestedTimeOut || 'Not recorded'}</TableCell><TableCell className="max-w-56 whitespace-normal">{log.correction.reason}</TableCell><TableCell><Badge className={log.correction.status === 'Approved' ? 'bg-green-100 text-green-800' : log.correction.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>{log.correction.status}</Badge></TableCell><TableCell className="text-right">{log.correction.status === 'Pending' ? <Button size="sm" onClick={() => { setSelectedCorrection(log); setCorrectionRemarks(''); }} className="h-7 bg-[#800000] text-[10px]">Review</Button> : <span className="text-[10px] text-slate-500">{log.correction.approver || '—'}</span>}</TableCell></TableRow>)}
          </TableBody></Table></CardContent>
        </Card>
      ) : (
        /* Tab 2: DTR Submissions list */
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800">DTR Review Board</CardTitle>
            <CardDescription className="text-xs font-normal">Audit daily time card compilations submitted by student interns.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Student Name</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Target Month</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Date Range</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Total Rendered Hours</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Submitted Date</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Status</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center w-32">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDTRs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-400 font-semibold font-sans">
                      No Daily Time Records submitted yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDTRs.map((dtr) => (
                    <TableRow key={dtr.id} className="hover:bg-slate-50/50 transition-colors text-xs font-sans">
                      <TableCell className="py-3.5 px-4 font-bold text-slate-850">
                        {dtr.studentName}
                        <span className="text-[10px] text-slate-400 font-medium block">{dtr.studentNumber} | {dtr.section}</span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 font-bold text-slate-700">{dtr.month}</TableCell>
                      <TableCell className="py-3.5 px-4 font-semibold text-slate-550">{dtr.startDate} to {dtr.endDate}</TableCell>
                      <TableCell className="py-3.5 px-4 font-extrabold text-slate-850">{dtr.totalHours.toFixed(2)} hrs</TableCell>
                      <TableCell className="py-3.5 px-4 text-slate-500 font-medium">{dtr.submittedAt || '—'}</TableCell>
                      <TableCell className="py-3.5 px-4">{getDtrBadge(dtr.status)}</TableCell>
                      <TableCell className="py-3.5 px-4 text-center">
                        <Button
                          size="sm"
                          onClick={() => handleOpenReview(dtr)}
                          className="bg-[#800000] hover:bg-[#6b0000] text-white text-[10.5px] h-7 font-bold px-3.5 cursor-pointer"
                        >
                          Review DTR
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selectedCorrection} onOpenChange={(open) => !open && setSelectedCorrection(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Review attendance correction</DialogTitle>
            <DialogDescription>Approve only legitimate requests. The original time and complete decision history stay attached to the attendance record.</DialogDescription>
          </DialogHeader>
          {selectedCorrection?.correction && <div className="space-y-4 text-sm">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-bold text-slate-800">{selectedCorrection.studentName} · {selectedCorrection.date}</p>
              <div className="mt-2 grid grid-cols-2 gap-3 text-xs"><div><p className="font-semibold text-slate-400">ORIGINAL</p><p>{selectedCorrection.correction.originalTimeIn} — {selectedCorrection.correction.originalTimeOut || 'Not recorded'}</p></div><div><p className="font-semibold text-slate-400">REQUESTED</p><p>{selectedCorrection.correction.requestedTimeIn} — {selectedCorrection.correction.requestedTimeOut || 'Not recorded'}</p></div></div>
              <p className="mt-3 text-xs text-slate-600"><strong>Reason:</strong> {selectedCorrection.correction.reason}</p>
            </div>
            <div><Label htmlFor="correctionReviewRemarks">Decision remarks</Label><textarea id="correctionReviewRemarks" value={correctionRemarks} onChange={(event) => setCorrectionRemarks(event.target.value)} className="mt-1 min-h-20 w-full rounded-md border border-slate-200 p-2 text-sm" placeholder="Optional decision notes for the student and audit trail." /></div>
            <div className="rounded-lg border border-slate-100 p-3"><p className="text-xs font-bold text-slate-700">Audit trail</p>{selectedCorrection.correction.auditTrail.map((entry: any) => <p key={`${entry.timestamp}-${entry.action}`} className="mt-1 text-[11px] text-slate-500"><strong>{entry.action}</strong> by {entry.actor} · {new Date(entry.timestamp).toLocaleString()}</p>)}</div>
          </div>}
          <DialogFooter><Button variant="outline" onClick={() => setSelectedCorrection(null)}>Cancel</Button><Button variant="outline" onClick={() => handleCorrectionDecision('Rejected')} className="border-red-200 text-red-700 hover:bg-red-50">Reject</Button><Button onClick={() => handleCorrectionDecision('Approved')} className="bg-green-600 hover:bg-green-700">Approve correction</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DTR Audit Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={(open) => {
        if (!open) {
          setReviewDialogOpen(false);
          setSelectedDtr(null);
        }
      }}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto font-sans p-6">
          <DialogHeader className="border-b pb-2 mb-2">
            <DialogTitle className="text-slate-900 font-sans font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#800000]" />
              Coordinate Daily Time Record Review
            </DialogTitle>
            <DialogDescription className="text-slate-500 font-normal text-xs truncate">
              Auditing DTR submission for <span className="font-bold text-slate-850">{selectedDtr?.studentName}</span> | Period: {selectedDtr?.startDate} to {selectedDtr?.endDate}
            </DialogDescription>
          </DialogHeader>

          {selectedDtr && (
            <div className="space-y-4">
              <section className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-900">Submission details</h3>{getDtrBadge(selectedDtr.status)}</div>
                <p><span className="font-semibold text-slate-800">Student:</span> {selectedDtr.studentName} ({selectedDtr.studentNumber})</p>
                <p><span className="font-semibold text-slate-800">Period:</span> {selectedDtr.startDate} to {selectedDtr.endDate}</p>
                <p><span className="font-semibold text-slate-800">Total hours:</span> {selectedDtr.totalHours.toFixed(2)} hours</p>
                <p><span className="font-semibold text-slate-800">Submitted:</span> {selectedDtr.submittedAt ? new Date(selectedDtr.submittedAt).toLocaleString() : 'Date and time not recorded'}</p>
              </section>
              <Button onClick={() => handleOpenDtrPdf(selectedDtr)} variant="outline" className="w-full border-[#800000]/30 text-xs font-semibold text-[#800000] hover:bg-red-50 hover:text-[#600000]">
                <ExternalLink className="mr-2 h-4 w-4" /> View DTR PDF
              </Button>
              {/* Audit Controls */}
              <div className="space-y-4 font-sans text-xs">
                <div className="space-y-1.5">
                  <Label htmlFor="auditRemarks" className="text-xs font-bold text-slate-750">Evaluation Notes & Audit Remarks</Label>
                  <Input
                    id="auditRemarks"
                    placeholder="e.g. DTR looks perfect, signatures verified. / Missing punch out log on June 12th."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="border-slate-200 text-xs py-2"
                  />
                </div>

                <div className="flex flex-wrap justify-between items-center gap-3 pt-3 border-t">
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleReviewAction('Needs Revision')}
                      variant="secondary"
                      className="text-xs font-semibold flex items-center gap-1.5 px-4 cursor-pointer"
                    >
                      <X className="h-4 w-4" /> Request Revision
                    </Button>
                    <Button
                      onClick={() => handleReviewAction('Approved')}
                      className="bg-green-700 hover:bg-green-800 text-white font-bold text-xs flex items-center gap-1.5 px-4 cursor-pointer"
                    >
                      <Check className="h-4 w-4" /> Approve DTR (Sign-off)
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

