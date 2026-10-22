import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useAuth } from '../../context/AuthContext';
import { useOJT, DTRRecord } from '../../context/OJTContext';
import { toast } from 'sonner';
import { 
  FileText, 
  Calendar, 
  Clock, 
  Printer, 
  Send, 
  CheckCircle2, 
  AlertTriangle, 
  Lock, 
  Building,
  Eye,
  Download,
  Check
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function DTRGeneration() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { students, companies, submitDTR } = useOJT();

  const [selectedMonth, setSelectedMonth] = useState('June 2026');
  const [startDate, setStartDate] = useState('2026-06-01');
  const [endDate, setEndDate] = useState('2026-06-15');

  // Preview generated DTR details state
  const [previewLogs, setPreviewLogs] = useState<any[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  const student = students.find(s => s.studentId === user?.id || s.email === user?.email);

  if (!student) {
    return (
      <div className="p-6 text-center font-sans">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-slate-650 mt-2 font-semibold">Student record not found.</p>
      </div>
    );
  }

  const assignedCompany = companies.find(c => c.id === student.companyId);

  // Clearance locks check
  const isCleared = student.stage !== 'Stage 1: Pre-OJT';
  const hasCompany = !!student.companyId && !!assignedCompany;
  const isGpsConfigured = !!assignedCompany && assignedCompany.latitude !== 0 && assignedCompany.longitude !== 0;
  const isLocked = !isCleared || !hasCompany || !isGpsConfigured;

  // Render lock screen if checks fail
  if (isLocked) {
    return (
      <div className="p-8 text-center max-w-xl mx-auto space-y-6 font-sans my-12 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="h-14 w-14 bg-red-50 text-[#800000] rounded-full flex items-center justify-center mx-auto mb-2">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">DTR Generation Locked</h2>
        <p className="text-slate-650 text-sm leading-relaxed font-normal">
          Before generating your Daily Time Record, the system must verify your deployment credentials. Please satisfy the following prerequisites:
        </p>

        <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-50 text-left text-xs font-semibold p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">1. Pre-OJT Checklist & MOA Clearance</span>
            {isCleared ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1"><Check className="h-3 w-3" /> Cleared</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">Locked</Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">2. Registered Company Assignment</span>
            {hasCompany ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1"><Check className="h-3 w-3" /> Assigned</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">Missing Assignment</Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-600">3. Geofence GPS Coordinates Configured</span>
            {isGpsConfigured ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1"><Check className="h-3 w-3" /> Configured</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">Missing Coordinates</Badge>
            )}
          </div>
        </div>

        <div className="pt-3">
          <Button 
            onClick={() => navigate('/pre-ojt')} 
            className="bg-[#800000] hover:bg-[#6b0000] text-white cursor-pointer font-bold px-6"
          >
            Review Requirements
          </Button>
        </div>
      </div>
    );
  }

  // Retrieve attendance logs matching Date Range and verified location
  const handleGenerateLogs = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) {
      toast.error("Please enter a valid start and end date.");
      return;
    }

    const sDate = new Date(startDate);
    const eDate = new Date(endDate);
    sDate.setHours(0,0,0,0);
    eDate.setHours(23,59,59,999);

    // Filter logs that are within the date range and have clocked out
    const logs = student.attendanceHistory.filter(record => {
      const rDate = new Date(record.date);
      const isWithinDate = rDate >= sDate && rDate <= eDate;
      const isVerified = record.locationStatus === 'Location Verified' || record.locationStatus === 'Attendance Recorded';
      const hasCheckedOut = record.timeOut !== null;
      return isWithinDate && isVerified && hasCheckedOut;
    });

    if (logs.length === 0) {
      toast.warning("No verified attendance check-out logs found for this date range.", {
        description: "Only coordinates-verified logs with completed check-outs are included in DTRs."
      });
      setPreviewLogs([]);
      setHasGenerated(false);
      return;
    }

    setPreviewLogs(logs);
    setHasGenerated(true);
    toast.success(`DTR Compiled! Found ${logs.length} attendance log entries.`, {
      description: "You can preview the filled Daily Time Record below before submitting."
    });
  };

  const calculateTotalHours = () => {
    return previewLogs.reduce((acc, log) => acc + log.totalHours, 0);
  };

  const handleDTRSubmit = () => {
    if (previewLogs.length === 0) return;

    submitDTR(student.studentId, selectedMonth, startDate, endDate, previewLogs);
    toast.success("DTR submitted successfully for Adviser Review!", {
      description: `Covered period: ${startDate} to ${endDate}`
    });
    setHasGenerated(false);
    setPreviewLogs([]);
  };

  const getDTRStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved</Badge>;
      case 'Needs Revision':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-205 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Needs Revision</Badge>;
      case 'Submitted':
      case 'Under Review':
        return <Badge className="bg-blue-105 text-blue-805 border-blue-200 flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Under Review</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200">{status}</Badge>;
    }
  };

  const handlePrintDTRWindow = (dtrId: string) => {
    window.open(`/print-dtr/${dtrId}`, '_blank', 'width=900,height=950');
  };

  // Helper to map date row in printable sheet
  const getLogForDay = (day: number) => {
    const paddedDay = day < 10 ? `0${day}` : `${day}`;
    // Find log for date format: YYYY-MM-DD
    const matched = previewLogs.find(log => {
      const parts = log.date.split('-');
      return parts[2] === paddedDay;
    });
    return matched;
  };

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">DTR Generation</h1>
        <p className="text-slate-505 text-sm mt-0.5 font-normal">Automatically compile your Daily Time Record (DTR) sheets from GPS-verified logs.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Compiler Form */}
        <div className="space-y-6 lg:col-span-1">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-800">DTR Filter compiler</CardTitle>
              <CardDescription className="text-xs text-slate-500 font-normal">Specify the month and date span to pull attendance records.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleGenerateLogs} className="space-y-4 text-xs font-semibold">
                <div className="space-y-1.5">
                  <Label htmlFor="monthSelect" className="text-xs text-slate-700">DTR Target Month</Label>
                  <select
                    id="monthSelect"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded p-2 text-xs font-semibold"
                  >
                    <option value="May 2026">May 2026</option>
                    <option value="June 2026">June 2026</option>
                    <option value="July 2026">July 2026</option>
                    <option value="August 2026">August 2026</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="startDate" className="text-xs text-slate-700">From Date</Label>
                    <Input
                      id="startDate"
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="border-slate-200 focus-visible:ring-[#800000] text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="endDate" className="text-xs text-slate-700">To Date</Label>
                    <Input
                      id="endDate"
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="border-slate-200 focus-visible:ring-[#800000] text-xs"
                      required
                    />
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-[#800000] hover:bg-[#6b0000] text-white font-bold py-2.5 flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Calendar className="h-4 w-4" /> Retrieve Logs & Generate
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* DTR History Registry */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800">DTR Registry submissions</CardTitle>
              <CardDescription className="text-xs text-slate-500 font-normal">History of DTR drafts and reviews.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 p-0">
              {!student.dtrHistory || student.dtrHistory.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs italic font-semibold">
                  No submitted DTR logs found.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {student.dtrHistory.map((dtr) => (
                    <div key={dtr.id} className="p-4 space-y-2 hover:bg-slate-50/50 transition-colors">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-800">{dtr.month}</span>
                        {getDTRStatusBadge(dtr.status)}
                      </div>
                      <p className="text-[10px] text-slate-400 font-semibold">{dtr.startDate} to {dtr.endDate}</p>
                      <div className="flex justify-between items-center text-[10.5px]">
                        <span className="font-bold text-[#800000]">{dtr.totalHours.toFixed(2)} hours rendered</span>
                        <Button
                          onClick={() => handlePrintDTRWindow(dtr.id)}
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-bold text-[#800000] flex items-center gap-1 px-2 border hover:bg-red-50"
                        >
                          <Printer className="h-3.5 w-3.5" /> Export PDF
                        </Button>
                      </div>

                      {/* Adviser Remarks */}
                      {dtr.remarks && (
                        <div className="bg-amber-50/50 border border-amber-100 p-2 rounded text-[10px] text-amber-850 mt-2 flex gap-1 items-start leading-normal">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600 mt-0.5 shrink-0" />
                          <div>
                            <span className="font-bold">Adviser Feedback:</span> "{dtr.remarks}"
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Formatted Sheet Preview */}
        <div className="lg:col-span-2 space-y-4">
          {hasGenerated ? (
            <div className="space-y-4 font-sans">
              <div className="flex justify-end gap-2 bg-white p-3 rounded-lg border shadow-sm">
                <Button
                  onClick={handleDTRSubmit}
                  className="bg-[#800000] hover:bg-[#6b0000] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer px-4"
                >
                  <Send className="h-3.5 w-3.5" /> Submit to Adviser
                </Button>
              </div>

              {/* DTR Sheet Mockup Card */}
              <Card className="shadow-md border-slate-300 bg-white">
                <CardContent className="p-8 space-y-6 font-mono text-[10.5px] text-slate-800 select-none">
                  {/* school header */}
                  <div className="text-center space-y-0.5 border-b pb-4">
                    <p className="font-bold text-xs uppercase tracking-wide">POLYTECHNIC UNIVERSITY OF THE PHILIPPINES</p>
                    <p className="text-slate-500 font-sans text-[9px] font-semibold">Office of the Internship Coordinator</p>
                    <h3 className="font-extrabold text-[#800000] text-sm underline tracking-wider pt-2">DAILY TIME RECORD</h3>
                  </div>

                  {/* Student details */}
                  <div className="grid grid-cols-2 gap-y-2 py-3 bg-slate-50 p-4 rounded border border-slate-200 font-sans text-xs">
                    <div><span className="font-bold text-slate-500">Student Name:</span> <span className="font-bold text-slate-800">{student.name}</span></div>
                    <div><span className="font-bold text-slate-500">Program & Section:</span> <span className="font-bold text-slate-800">{student.program.split(/[—–-]/)[0]?.trim() || 'BSIT'} - {student.section}</span></div>
                    <div><span className="font-bold text-slate-500">Student Number:</span> <span className="font-bold text-slate-800">{student.studentNumber}</span></div>
                    <div><span className="font-bold text-slate-500">HTE Company:</span> <span className="font-bold text-slate-850">{assignedCompany?.name}</span></div>
                    <div className="col-span-2"><span className="font-bold text-slate-500">HTE Address:</span> <span className="font-bold text-slate-800">{assignedCompany?.address}</span></div>
                    <div className="col-span-2"><span className="font-bold text-slate-500">Covered Period:</span> <span className="font-bold text-[#800000]">{startDate} to {endDate}</span></div>
                  </div>

                  {/* DTR Grid list */}
                  <div className="border border-slate-350 rounded overflow-hidden bg-white">
                    <table className="intrack-table w-full text-left text-[10.5px] border-collapse font-mono">
                      <thead>
                        <tr className="bg-slate-100 border-b border-slate-350 font-sans font-bold text-slate-600 text-center">
                          <th className="p-2 border-r border-slate-300 w-16">Day</th>
                          <th className="p-2 border-r border-slate-300">Arrival (Time In)</th>
                          <th className="p-2 border-r border-slate-300 text-slate-400 font-normal">Departure (Lunch)</th>
                          <th className="p-2 border-r border-slate-300 text-slate-400 font-normal">Arrival (Lunch)</th>
                          <th className="p-2 border-r border-slate-300">Departure (Time Out)</th>
                          <th className="p-2 border-r border-slate-300 w-28">Daily Hours</th>
                          <th className="p-2">Initials</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {Array.from({ length: 15 }, (_, i) => {
                          const day = i + 1; // Show first 15 days in preview for compact size
                          const log = getLogForDay(day);
                          return (
                            <tr key={day} className="hover:bg-slate-50/50 transition-colors text-center">
                              <td className="p-2 border-r border-slate-300 font-bold bg-slate-50/50 text-slate-500">{day}</td>
                              <td className="p-2 border-r border-slate-300 font-bold text-slate-800">{log ? log.timeIn : '—'}</td>
                              <td className="p-2 border-r border-slate-300 text-slate-350 font-sans italic text-[9px]">{log ? '12:00 PM' : '—'}</td>
                              <td className="p-2 border-r border-slate-300 text-slate-350 font-sans italic text-[9px]">{log ? '01:00 PM' : '—'}</td>
                              <td className="p-2 border-r border-slate-300 font-bold text-slate-800">{log ? log.timeOut : '—'}</td>
                              <td className="p-2 border-r border-slate-300 font-extrabold text-slate-900">
                                {log ? `${log.totalHours.toFixed(2)} hrs` : '—'}
                              </td>
                              <td className="p-2 text-center">
                                {log ? (
                                  <span className="text-[10px] text-green-700 bg-green-50 px-1.5 py-0.5 rounded border border-green-150 font-bold">OK</span>
                                ) : '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Summary rendered */}
                  <div className="flex justify-between items-center bg-[#800000]/5 border border-red-150 p-3 rounded-lg font-sans">
                    <span className="font-bold text-slate-850">Cumulative Rendered Hours:</span>
                    <span className="font-extrabold text-sm text-[#800000]">{calculateTotalHours().toFixed(2)} Hours</span>
                  </div>

                  {/* Signatures */}
                  <div className="grid grid-cols-2 gap-8 pt-10 text-center font-sans text-xs">
                    <div className="space-y-1">
                      <div className="border-b border-slate-400 w-3/4 mx-auto h-6 flex items-end justify-center font-semibold italic text-[#800000] font-serif">
                        {student.name}
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Signature of Intern</p>
                    </div>
                    <div className="space-y-1">
                      <div className="border-b border-slate-400 w-3/4 mx-auto h-6 flex items-end justify-center font-semibold text-slate-700">
                        Pending Coordinator Review
                      </div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">OJT Supervisor / Coordinator</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="shadow-sm border-slate-200">
              <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
                <FileText className="h-16 w-16 text-slate-300 animate-pulse" />
                <h3 className="font-bold text-slate-700 text-sm">No DTR Sheet Preview Generated</h3>
                <p className="text-xs text-slate-500 max-w-sm font-normal leading-relaxed">
                  Select a Month and Date Range in the compiler filter on the left and click <strong>Retrieve Logs & Generate</strong> to load attendance data.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
