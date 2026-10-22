import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  Filter,
  Lock,
  Play,
  Printer,
  Search,
  Square,
  ClipboardPenLine,
} from 'lucide-react';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../../components/ui/table';
import { useAuth } from '../../context/AuthContext';
import { AttendanceRecord, DTRRecord, useOJT } from '../../context/OJTContext';
import { GeoMapPreview } from '../../components/shared/GeoMapPreview';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { openDtrPdf } from '../../lib/dtrPdf';

const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });

function toDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDisplayDate(dateKey: string) {
  const [year, month, day] = dateKey.split('-');
  return year && month && day ? `${month}/${day}/${year}` : dateKey;
}

function isVerifiedCompleted(record: AttendanceRecord) {
  return (
    !!record.timeOut &&
    record.totalHours > 0 &&
    (record.locationStatus === 'Location Verified' || record.locationStatus === 'Attendance Recorded') &&
    (record.attendanceStatus === 'Present' || record.attendanceStatus === 'Late' || record.attendanceStatus === 'Location Verified')
  );
}

export function Attendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { students, companies, timeIn, timeOut, mockLocation, requestAttendanceCorrection, generateDTR, submitGeneratedDTR } = useOJT();

  const [searchTerm, setSearchTerm] = useState('');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [filterType, setFilterType] = useState<'all' | 'week' | 'month' | 'range'>('all');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState(monthFormatter.format(new Date()));
  const [dtrStartDate, setDtrStartDate] = useState(() => {
    const now = new Date();
    return toDateKey(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [dtrEndDate, setDtrEndDate] = useState(() => toDateKey(new Date()));
  const [previewLogs, setPreviewLogs] = useState<DTRRecord['logs']>([]);
  const [generatedDtr, setGeneratedDtr] = useState<DTRRecord | null>(null);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [selectedDtrMapIndex, setSelectedDtrMapIndex] = useState(0);
  const [correctionRecord, setCorrectionRecord] = useState<AttendanceRecord | null>(null);
  const [requestedTimeIn, setRequestedTimeIn] = useState('');
  const [requestedTimeOut, setRequestedTimeOut] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const student = students.find(s => s.studentId === user?.id || s.email === user?.email);
  const company = student ? companies.find(item => item.id === student.companyId) : undefined;

  if (!student) {
    return (
      <div className="p-6 text-center font-sans">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-slate-650 mt-2 font-semibold">Student record not found.</p>
      </div>
    );
  }

  const assignedCompany = companies.find(c => c.id === student.companyId);
  const isCleared = student.stage !== 'Stage 1: Pre-OJT';
  const hasCompany = !!student.companyId && !!assignedCompany;
  const isGpsConfigured = !!assignedCompany && assignedCompany.latitude !== 0 && assignedCompany.longitude !== 0;
  const isLocked = !isCleared || !hasCompany || !isGpsConfigured;

  if (isLocked) {
    return (
      <div className="p-8 text-center max-w-xl mx-auto space-y-6 font-sans my-12 bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="h-14 w-14 bg-red-50 text-[#800000] rounded-full flex items-center justify-center mx-auto mb-2">
          <Lock className="h-7 w-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Attendance and DTR Locked</h2>
        <p className="text-slate-650 text-sm leading-relaxed font-normal">
          Attendance and DTR generation open after your deployment clearance, company assignment, and company geofence are verified.
        </p>

        <div className="border border-slate-100 rounded-lg overflow-hidden bg-slate-50 text-left text-xs font-semibold p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Pre-OJT Checklist and MOA Clearance</span>
            {isCleared ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1"><Check className="h-3 w-3" /> Cleared</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">Locked</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Registered Company Assignment</span>
            {hasCompany ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1"><Check className="h-3 w-3" /> Assigned</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">Missing</Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Company GPS Geofence</span>
            {isGpsConfigured ? (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100 gap-1"><Check className="h-3 w-3" /> Configured</Badge>
            ) : (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 gap-1">Missing</Badge>
            )}
          </div>
        </div>

        <Button onClick={() => navigate('/pre-ojt')} className="bg-[#800000] hover:bg-[#6b0000] text-white cursor-pointer font-bold px-6">
          Review Requirements
        </Button>
      </div>
    );
  }

  const todayDate = toDateKey(new Date());
  const todayRecord = student.attendanceHistory.find(a => a.date === todayDate && a.locationStatus !== 'Outside Deployment Area');
  const isClockedIn = todayRecord && todayRecord.timeOut === null;
  const isClockedOut = todayRecord && todayRecord.timeOut !== null;

  const monthOptions = useMemo(() => {
    const dates = student.attendanceHistory.map(log => parseDateKey(log.date));
    dates.push(new Date());
    return Array.from(new Set(dates.map(date => monthFormatter.format(date))));
  }, [student.attendanceHistory]);

  const calendarMonth = useMemo(() => {
    const match = selectedMonth.match(/^([A-Za-z]+) (\d{4})$/);
    const parsed = match ? new Date(`${match[1]} 1, ${match[2]}`) : new Date();
    return new Date(parsed.getFullYear(), parsed.getMonth(), 1);
  }, [selectedMonth]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
    const lastDay = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
    const leadingBlanks = firstDay.getDay();
    return [
      ...Array.from({ length: leadingBlanks }, () => null),
      ...Array.from({ length: lastDay.getDate() }, (_, index) => new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), index + 1))
    ];
  }, [calendarMonth]);

  const recordsByDate = useMemo(() => {
    return student.attendanceHistory.reduce<Record<string, AttendanceRecord[]>>((acc, record) => {
      acc[record.date] = [...(acc[record.date] || []), record];
      return acc;
    }, {});
  }, [student.attendanceHistory]);

  const getCalendarStatus = (date: Date) => {
    const key = toDateKey(date);
    const dayRecords = recordsByDate[key] || [];
    if (dayRecords.some(isVerifiedCompleted)) return 'present';
    if (dayRecords.some(record => record.locationStatus === 'Outside Deployment Area' || record.attendanceStatus === 'Outside Deployment Area')) return 'missed';

    const now = new Date();
    const isPastOrToday = date <= new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isWeekday = date.getDay() !== 0 && date.getDay() !== 6;
    return isPastOrToday && isWeekday ? 'missed' : 'blank';
  };

  const verifiedLogs = student.attendanceHistory.filter(isVerifiedCompleted);
  const failedLogs = student.attendanceHistory.filter(record => record.locationStatus === 'Outside Deployment Area' || record.attendanceStatus === 'Outside Deployment Area');

  const performTimeIn = (coords: { lat: number; lng: number } | null) => {
    const result = timeIn(student.studentId, coords, navigator.userAgent);
    result.success ? toast.success(result.message) : toast.error(result.message);
    setIsVerifying(false);
  };

  const performTimeOut = (coords: { lat: number; lng: number } | null) => {
    const result = timeOut(student.studentId, coords, navigator.userAgent);
    result.success ? toast.success(result.message) : toast.error(result.message);
    setIsVerifying(false);
  };

  const requestGps = (action: 'in' | 'out') => {
    setIsVerifying(true);
    toast.info(action === 'in' ? 'Requesting browser GPS verification...' : 'Requesting browser GPS verification for Clock Out...', {
      description: 'Comparing coordinates with your assigned company geofence.'
    });

    const fallback = () => {
      toast.warning('Browser GPS is blocked or unavailable. Using simulation panel coordinates...', {
        description: `Coordinates: ${mockLocation.lat.toFixed(6)}, ${mockLocation.lng.toFixed(6)}`,
        duration: 6000
      });
      action === 'in' ? performTimeIn({ lat: mockLocation.lat, lng: mockLocation.lng }) : performTimeOut({ lat: mockLocation.lat, lng: mockLocation.lng });
    };

    if (!navigator.geolocation) {
      fallback();
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        toast.success('GPS capture successful.');
        const coords = { lat: position.coords.latitude, lng: position.coords.longitude };
        action === 'in' ? performTimeIn(coords) : performTimeOut(coords);
      },
      fallback,
      { enableHighAccuracy: true, timeout: 5000 }
    );
  };

  const isInCurrentWeek = (dateStr: string) => {
    const logDate = parseDateKey(dateStr);
    const now = new Date();
    const firstDay = new Date(now);
    firstDay.setDate(now.getDate() - now.getDay());
    firstDay.setHours(0, 0, 0, 0);
    const lastDay = new Date(firstDay);
    lastDay.setDate(firstDay.getDate() + 6);
    lastDay.setHours(23, 59, 59, 999);
    return logDate >= firstDay && logDate <= lastDay;
  };

  const isInCurrentMonth = (dateStr: string) => {
    const logDate = parseDateKey(dateStr);
    const now = new Date();
    return logDate.getMonth() === now.getMonth() && logDate.getFullYear() === now.getFullYear();
  };

  const filteredHistory = student.attendanceHistory.filter(record => {
    const matchesSearch =
      record.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.locationStatus.toLowerCase().includes(searchTerm.toLowerCase()) ||
      record.attendanceStatus.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;
    if (filterType === 'week') return isInCurrentWeek(record.date);
    if (filterType === 'month') return isInCurrentMonth(record.date);
    if (filterType === 'range' && historyStartDate && historyEndDate) {
      const logDate = parseDateKey(record.date);
      return logDate >= parseDateKey(historyStartDate) && logDate <= parseDateKey(historyEndDate);
    }
    return true;
  });

  const dtrAttentionRecords = useMemo(() => student.attendanceHistory.filter(record => {
    const recordDate = parseDateKey(record.date);
    return recordDate >= parseDateKey(dtrStartDate) && recordDate <= parseDateKey(dtrEndDate) && !isVerifiedCompleted(record);
  }), [dtrEndDate, dtrStartDate, student.attendanceHistory]);

  const handleGenerateLogs = (event?: React.FormEvent) => {
    event?.preventDefault();
    if (!dtrStartDate || !dtrEndDate) {
      toast.error('Please enter a valid DTR start and end date.');
      return;
    }

    const sDate = parseDateKey(dtrStartDate);
    const eDate = parseDateKey(dtrEndDate);
    eDate.setHours(23, 59, 59, 999);

    if (sDate > eDate) {
      toast.error('DTR start date must be before the end date.');
      return;
    }

    const eligibleRecords = student.attendanceHistory
      .filter(record => {
        const recordDate = parseDateKey(record.date);
        return recordDate >= sDate && recordDate <= eDate && isVerifiedCompleted(record);
      })
      .sort((a, b) => parseDateKey(a.date).getTime() - parseDateKey(b.date).getTime());

    const logs = eligibleRecords.map(record => ({
        attendanceRecordId: record.id,
        date: record.date,
        timeIn: record.timeIn,
        timeOut: record.timeOut,
        totalHours: record.totalHours,
        locationStatus: record.locationStatus,
        gpsCoordinates: record.gpsCoordinates
      }));

    if (logs.length === 0) {
      toast.warning('No verified attendance records found for this DTR range.', {
        description: 'Only completed check-ins made inside the assigned company geofence are included.'
      });
      setPreviewLogs([]);
      setGeneratedDtr(null);
      setHasGenerated(false);
      return;
    }

    const generated = generateDTR(student.studentId, selectedMonth, dtrStartDate, dtrEndDate, logs, eligibleRecords.map(record => record.id));
    setPreviewLogs(generated?.logs || logs);
    setGeneratedDtr(generated);
    setSelectedDtrMapIndex(0);
    setHasGenerated(true);
    toast.success(`DTR generated from ${logs.length} verified attendance records.`);
  };

  const handleSubmitDTR = () => {
    if (!generatedDtr) return;
    submitGeneratedDTR(student.studentId, generatedDtr.id);
    setGeneratedDtr({ ...generatedDtr, status: 'Submitted', submittedAt: new Date().toISOString() });
    toast.success('DTR submitted for adviser review.', { description: `${generatedDtr.month} · Version ${generatedDtr.version || 1}` });
  };

  const handleDTRExport = () => {
    if (previewLogs.length === 0) return;

    const dtrId = generatedDtr?.id || `preview_dtr_${Date.now()}`;
    const payload: DTRRecord = generatedDtr || {
      id: dtrId,
      month: selectedMonth,
      startDate: dtrStartDate,
      endDate: dtrEndDate,
      status: 'Generated',
      remarks: '',
      generatedAt: new Date().toISOString(),
      totalHours: previewLogs.reduce((total, log) => total + log.totalHours, 0),
      logs: previewLogs
    };

    openDtrPdf({
      dtr: payload,
      studentName: student.name,
      studentNumber: student.studentNumber,
      companyName: student.companyName,
      supervisorName: company?.contactPerson,
    });

    toast.success('DTR export opened.', {
      description: `Covered period: ${dtrStartDate} to ${dtrEndDate}`
    });
  };

  const getLogForDay = (day: number) => {
    const paddedDay = day < 10 ? `0${day}` : `${day}`;
    return previewLogs.find(log => log.date.split('-')[2] === paddedDay);
  };

  const formatDtrCellTime = (value?: string | null) => {
    if (!value) return '';
    const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AP]M)?$/i);
    if (!match) return value.trim().replace(/\s+/g, ' ');
    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hour > 12) hour -= 12;
    if (period === 'AM' && hour === 0) hour = 12;
    return `${hour}:${minute}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Location Verified':
      case 'Attendance Recorded':
        return <Badge className="bg-green-105 text-green-805 border-green-200 hover:bg-green-100 font-bold px-2 py-0.5 rounded text-[11px] gap-1"><CheckCircle2 className="h-3 w-3" /> Location Verified</Badge>;
      case 'Outside Deployment Area':
        return <Badge className="bg-red-100 text-red-800 border-red-200 hover:bg-red-100 font-bold px-2 py-0.5 rounded text-[11px] gap-1"><AlertTriangle className="h-3 w-3" /> Outside Area</Badge>;
      case 'Location Permission Denied':
      case 'Invalid Location':
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-100 font-bold px-2 py-0.5 rounded text-[11px] gap-1"><AlertTriangle className="h-3 w-3" /> Geofence Error</Badge>;
      default:
        return <Badge className="bg-blue-105 text-blue-805 border-blue-200 hover:bg-blue-100 font-bold px-2 py-0.5 rounded text-[11px]">{status}</Badge>;
    }
  };

  const getAttendanceStatusBadge = (status: string) => {
    switch (status) {
      case 'Present':
        return <Badge className="bg-green-100 text-green-800 border-green-200 font-semibold text-[10px]">Present</Badge>;
      case 'Late':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-semibold text-[10px]">Late</Badge>;
      case 'Outside Deployment Area':
        return <Badge className="bg-red-100 text-red-800 border-red-200 font-semibold text-[10px]">Outside Area</Badge>;
      case 'Incomplete Time Out':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-semibold text-[10px]">Incomplete Time Out</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">{status || 'Incomplete'}</Badge>;
    }
  };

  const previewTotalHours = previewLogs.reduce((sum, log) => sum + log.totalHours, 0);

  const toTimeInput = (value: string | null) => {
    if (!value) return '';
    const match = value.match(/^(\d{1,2}):(\d{2})(?:\s*([AP]M))?$/i);
    if (!match) return '';
    let hour = Number(match[1]);
    const minute = match[2];
    const period = match[3]?.toUpperCase();
    if (period === 'PM' && hour < 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  };

  const openCorrectionDialog = (record: AttendanceRecord) => {
    setCorrectionRecord(record);
    setRequestedTimeIn(toTimeInput(record.timeIn));
    setRequestedTimeOut(toTimeInput(record.timeOut));
    setCorrectionReason('');
  };

  const submitCorrectionRequest = () => {
    if (!correctionRecord || !user) return;
    const result = requestAttendanceCorrection(
      student.studentId,
      correctionRecord.id,
      requestedTimeIn,
      requestedTimeOut || null,
      correctionReason,
      user.name,
    );
    result.success ? toast.success(result.message) : toast.error(result.message);
    if (result.success) setCorrectionRecord(null);
  };

  return (
    <div className="space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Attendance and DTR</h1>
          <p className="text-slate-500 text-sm mt-0.5">Record verified on-site attendance and automatically generate your Daily Time Record from approved logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <Card className="self-start overflow-hidden border-slate-200 shadow-sm lg:col-span-2">
          <CardHeader className="border-b border-slate-100 bg-slate-50/50 pb-4">
            <div className="flex justify-between items-center gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 font-sans">Punch Clock Terminal</CardTitle>
                <CardDescription className="text-slate-500 text-xs font-normal">Your coordinates must be inside your assigned company geofence before attendance is recorded.</CardDescription>
              </div>
              <div className="text-right">
                <span className="text-sm font-extrabold text-[#800000]">{currentTime.toLocaleTimeString()}</span>
                <span className="text-[10px] text-slate-400 font-semibold block mt-0.5">{currentTime.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 py-4">
            <div className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:grid-cols-2 sm:items-center">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clock Status</p>
                <div className="mt-1.5">
                  {isClockedIn ? (
                    <Badge className="bg-green-600 text-white font-bold text-xs px-3 py-1 rounded-full">Checked In and Active</Badge>
                  ) : isClockedOut ? (
                    <Badge className="bg-blue-600 text-white font-bold text-xs px-3 py-1 rounded-full">Logged Out Today</Badge>
                  ) : (
                    <Badge className="bg-slate-500 text-white font-bold text-xs px-3 py-1 rounded-full">Not Logged In Today</Badge>
                  )}
                </div>
                {isClockedIn && todayRecord && (
                  <p className="text-xs text-slate-500 mt-2 font-medium">Clock In registered at: <span className="font-semibold text-slate-700">{todayRecord.timeIn}</span></p>
                )}
              </div>
              <div className="sm:border-l sm:border-slate-200 sm:pl-4 sm:text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Assigned Company Geofence</p>
                <p className="font-bold text-slate-800 text-sm mt-1">{assignedCompany?.name}</p>
                <p className="text-xs text-slate-505 font-normal mt-0.5">{assignedCompany?.address}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button
                onClick={() => requestGps('in')}
                disabled={!!isClockedIn || !!isClockedOut || isVerifying}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-40"
              >
                <Play className="h-5 w-5" />
                Time In
              </Button>
              <Button
                onClick={() => requestGps('out')}
                disabled={!isClockedIn || isVerifying}
                className="bg-slate-900 hover:bg-[#800000] text-white font-bold py-5 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-40"
              >
                <Square className="h-5 w-5" />
                Time Out
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="self-start border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800">GPS Validation</CardTitle>
            <CardDescription className="text-slate-500 text-xs font-normal">Current coordinate comparison.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 text-xs space-y-3 font-mono">
              <div className="flex justify-between items-center pb-2.5 border-b border-slate-200 font-sans">
                <span className="text-slate-500 font-medium">GPS Signal:</span>
                <span className="font-bold text-green-600 flex items-center gap-1">
                  <span className="h-2.5 w-2.5 bg-green-500 rounded-full animate-ping"></span>
                  Active
                </span>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider font-sans">Current Coordinates</p>
                <p className="text-slate-700 text-[11px]">{mockLocation.lat === 0 && mockLocation.lng === 0 ? 'ACCESS DENIED' : `${mockLocation.lat.toFixed(6)}, ${mockLocation.lng.toFixed(6)}`}</p>
              </div>
              <div>
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider font-sans">Company Coordinates</p>
                <p className="text-slate-700 text-[11px]">{assignedCompany?.latitude.toFixed(6)}, {assignedCompany?.longitude.toFixed(6)}</p>
              </div>
              <div className="font-sans">
                <p className="text-slate-400 font-bold uppercase text-[9px] tracking-wider">Allowed Radius</p>
                <p className="font-bold text-slate-700">{assignedCompany?.allowedRadius} meters</p>
              </div>
            </div>
            <div className="p-3 bg-[#800000]/5 border border-red-105 rounded-lg text-xs leading-relaxed text-slate-750 flex gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-[#800000] shrink-0 mt-0.5" />
              <p className="font-normal text-slate-650">
                <span className="font-bold text-[#800000]">Location Rule:</span> Attendance is accepted only when the captured GPS position is inside the assigned company radius.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <GeoMapPreview
        coordinates={mockLocation}
        title="Current location preview"
        description="The marker shows the coordinates currently used for GPS validation."
        mapHeightClass="h-52"
      />

      <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3">
        <Card className="order-2 border-slate-200 shadow-sm xl:col-span-1 xl:order-2">
          <CardHeader className="pb-3 border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold text-slate-800">Attendance Calendar</CardTitle>
                <CardDescription className="text-xs text-slate-500 font-normal">Green means verified attendance. Red means absent or rejected geofence attempt.</CardDescription>
              </div>
              <select
                value={selectedMonth}
                onChange={event => setSelectedMonth(event.target.value)}
                className="bg-white border border-slate-205 rounded p-2 text-xs font-semibold"
              >
                {monthOptions.map(month => <option key={month} value={month}>{month}</option>)}
              </select>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => <div key={day}>{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1 mt-2">
              {calendarDays.map((date, index) => {
                if (!date) return <div key={`blank-${index}`} className="aspect-square" />;
                const status = getCalendarStatus(date);
                const className =
                  status === 'present'
                    ? 'bg-green-100 text-green-800 border-green-200'
                    : status === 'missed'
                      ? 'bg-red-100 text-red-800 border-red-200'
                      : 'bg-white text-slate-400 border-slate-100';
                return (
                  <div key={toDateKey(date)} className={`aspect-square rounded border flex items-center justify-center text-xs font-bold ${className}`}>
                    {date.getDate()}
                  </div>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-4 mt-4 text-xs font-semibold text-slate-600">
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-500" /> Present</span>
              <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-500" /> Absent / outside geofence</span>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <div className="rounded-lg border border-green-100 bg-green-50 p-3">
                <p className="text-[10px] uppercase font-bold text-green-700">Verified Days</p>
                <p className="text-lg font-extrabold text-green-800">{verifiedLogs.length}</p>
              </div>
              <div className="rounded-lg border border-red-100 bg-red-50 p-3">
                <p className="text-[10px] uppercase font-bold text-red-700">Failed Attempts</p>
                <p className="text-lg font-extrabold text-red-800">{failedLogs.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="order-1 border-slate-200 shadow-sm xl:col-span-3 xl:order-1">
          <CardHeader className="pb-3 border-b border-slate-100">
            <CardTitle className="text-base font-bold text-slate-800">Automatic DTR Generation</CardTitle>
            <CardDescription className="text-xs text-slate-500 font-normal">The DTR is filled only from completed attendance records verified inside your assigned company geofence.</CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <form onSubmit={handleGenerateLogs} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_1fr_auto] gap-3 items-end text-xs font-semibold">
              <div className="space-y-1.5">
                <Label htmlFor="monthSelect" className="text-xs text-slate-700">DTR Month</Label>
                <select
                  id="monthSelect"
                  value={selectedMonth}
                  onChange={(e) => {
                    const month = e.target.value;
                    const parsed = new Date(`${month} 1`);
                    const periodStart = new Date(parsed.getFullYear(), parsed.getMonth(), 1);
                    const periodEnd = new Date(parsed.getFullYear(), parsed.getMonth() + 1, 0);
                    const today = new Date();
                    setSelectedMonth(month);
                    setDtrStartDate(toDateKey(periodStart));
                    setDtrEndDate(toDateKey(periodEnd > today ? today : periodEnd));
                    setHasGenerated(false);
                    setGeneratedDtr(null);
                    setPreviewLogs([]);
                  }}
                  className="w-full bg-white border border-slate-205 rounded p-2 text-xs font-semibold h-10"
                >
                  {monthOptions.map(month => <option key={month} value={month}>{month}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dtrStartDate" className="text-xs text-slate-700">From Date</Label>
                <Input id="dtrStartDate" type="date" value={dtrStartDate} onChange={(event) => setDtrStartDate(event.target.value)} className="border-slate-200 focus-visible:ring-[#800000] text-xs" required />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dtrEndDate" className="text-xs text-slate-700">To Date</Label>
                <Input id="dtrEndDate" type="date" value={dtrEndDate} onChange={(event) => setDtrEndDate(event.target.value)} className="border-slate-200 focus-visible:ring-[#800000] text-xs" required />
              </div>
              <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] text-white font-bold h-10 flex items-center gap-1.5 cursor-pointer">
                <Calendar className="h-4 w-4" /> Generate
              </Button>
            </form>

            {hasGenerated ? (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border bg-slate-50 p-3">
                  <div>
                    <p className="text-xs font-bold text-slate-800">DTR Preview Ready</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{selectedMonth} · {dtrStartDate} to {dtrEndDate}</p>
                    <p className="text-[10px] text-slate-500 font-semibold">{previewLogs.length} verified records, {previewTotalHours.toFixed(2)} rendered hours · Version {generatedDtr?.version || 1}</p>
                  </div>
                  <div className="flex flex-wrap gap-2"><Button type="button" onClick={() => handleGenerateLogs()} variant="outline" className="cursor-pointer text-xs hover:bg-slate-100"><Calendar className="h-3.5 w-3.5" />Regenerate</Button><Button type="button" onClick={handleDTRExport} variant="outline" className="cursor-pointer text-xs hover:bg-slate-100"><Printer className="h-3.5 w-3.5" />Preview / Print</Button><Button type="button" onClick={handleSubmitDTR} disabled={generatedDtr?.status === 'Submitted'} className="bg-[#800000] hover:bg-[#6b0000] text-white font-bold text-xs flex items-center gap-1.5 cursor-pointer px-4"><Check className="h-3.5 w-3.5" />{generatedDtr?.status === 'Submitted' ? 'Submitted' : 'Submit DTR'}</Button></div>
                </div>

                {dtrAttentionRecords.length > 0 && <div className="flex flex-col justify-between gap-2 rounded-lg border border-red-100 bg-red-50 p-3 text-xs sm:flex-row sm:items-center"><div><p className="font-bold text-red-800">{dtrAttentionRecords.length} attendance record{dtrAttentionRecords.length === 1 ? '' : 's'} requires attention</p><p className="mt-0.5 text-red-700">{dtrAttentionRecords.slice(0, 3).map(record => `${record.date} — ${record.timeOut ? record.locationStatus : 'Missing Time Out'}`).join(' · ')}</p></div><Button variant="outline" onClick={() => document.getElementById('attendance-history')?.scrollIntoView({ behavior: 'smooth' })} className="cursor-pointer border-red-200 text-red-800 hover:bg-red-100">Review Attendance</Button></div>}

                <div className="border border-slate-300 rounded overflow-hidden bg-white">
                  <table className="intrack-table w-full text-center text-[10px] border-collapse font-mono">
                    <colgroup>
                      <col className="w-[10.5%]" />
                      <col className="w-[13.25%]" />
                      <col className="w-[17.2%]" />
                      <col className="w-[13.25%]" />
                      <col className="w-[17.2%]" />
                      <col className="w-[12.6%]" />
                      <col className="w-[15.6%]" />
                    </colgroup>
                    <thead>
                      <tr className="bg-slate-100 border-b border-slate-300 font-sans font-bold text-slate-600">
                        <th className="p-2 border-r border-slate-300 w-14" rowSpan={2}>Day</th>
                        <th className="p-2 border-r border-slate-300" colSpan={2}>A.M.</th>
                        <th className="p-2 border-r border-slate-300" colSpan={2}>P.M.</th>
                        <th className="p-2 border-r border-slate-300" colSpan={2}>Undertime</th>
                      </tr>
                      <tr className="bg-slate-50 border-b border-slate-300 font-sans text-slate-500">
                        <th className="p-1 border-r border-slate-300">Arrival</th>
                        <th className="p-1 border-r border-slate-300">Departure</th>
                        <th className="p-1 border-r border-slate-300">Arrival</th>
                        <th className="p-1 border-r border-slate-300">Departure</th>
                        <th className="p-1 border-r border-slate-300">Hours</th>
                        <th className="p-1">Minutes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 15 }, (_, index) => {
                        const day = index + 1;
                        const log = getLogForDay(day);
                        return (
                          <tr key={day} className="border-b border-slate-200">
                            <td className="p-2 border-r border-slate-300 font-bold bg-slate-50/50">{day}</td>
                            <td className="p-1 border-r border-slate-300 font-bold text-[9px] whitespace-nowrap overflow-hidden">{formatDtrCellTime(log?.timeIn)}</td>
                            <td className="p-1 border-r border-slate-300 text-slate-400 font-sans italic text-[9px] whitespace-nowrap overflow-hidden">{log ? '12:00' : ''}</td>
                            <td className="p-1 border-r border-slate-300 text-slate-400 font-sans italic text-[9px] whitespace-nowrap overflow-hidden">{log ? '1:00' : ''}</td>
                            <td className="p-1 border-r border-slate-300 font-bold text-[9px] whitespace-nowrap overflow-hidden">{formatDtrCellTime(log?.timeOut)}</td>
                            <td className="p-2 border-r border-slate-300"></td>
                            <td className="p-2"></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-bold text-slate-800">DTR location records</p>
                    <p className="mt-1 text-[10px] text-slate-500">Choose a verified workday to preview the GPS point recorded for that DTR entry.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {previewLogs.map((log, index) => (
                        <button
                          key={`${log.date}-${index}`}
                          type="button"
                          onClick={() => setSelectedDtrMapIndex(index)}
                          className={`rounded-md border px-2.5 py-1.5 text-[10px] font-bold transition-colors ${selectedDtrMapIndex === index ? 'border-[#800000] bg-[#800000] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[#800000]/40'}`}
                        >
                          {log.date}
                        </button>
                      ))}
                    </div>
                  </div>
                  <GeoMapPreview
                    coordinates={previewLogs[selectedDtrMapIndex]?.gpsCoordinates}
                    title="Selected DTR GPS record"
                    description={previewLogs[selectedDtrMapIndex]?.date ? `Verified attendance on ${previewLogs[selectedDtrMapIndex].date}.` : undefined}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 rounded-lg border border-dashed border-slate-200 bg-slate-50">
                <FileText className="h-12 w-12 text-slate-300" />
                <p className="font-bold text-slate-700 text-sm">No DTR preview generated</p>
                <p className="text-xs text-slate-500 max-w-md font-normal leading-relaxed">Choose the covered period and generate a DTR. The system will fill the school-style DTR from verified attendance only.</p>
              </div>
            )}
          </CardContent>
        </Card>
      <Card className="order-2 border-slate-200 shadow-sm xl:col-span-3">
        <CardHeader className="pb-3 border-b border-slate-100"><CardTitle className="text-base font-bold text-slate-800">DTR Submissions</CardTitle><CardDescription className="text-xs text-slate-500">Generated DTR versions and adviser review history by reporting period.</CardDescription></CardHeader>
        <CardContent className="p-0">{student.dtrHistory.length === 0 ? <p className="p-6 text-center text-sm text-slate-500">No DTR has been generated yet.</p> : <div className="divide-y divide-slate-100">{student.dtrHistory.map(dtr => <button key={dtr.id} type="button" onClick={() => openDtrPdf({ dtr, studentName: student.name, studentNumber: student.studentNumber, companyName: student.companyName, supervisorName: company?.contactPerson })} className="flex w-full cursor-pointer items-center justify-between gap-3 px-4 py-3 text-left hover:bg-slate-50"><div><p className="text-sm font-bold text-slate-800">{dtr.month} <span className="ml-1 text-[10px] font-medium text-slate-500">Version {dtr.version || 1}</span></p><p className="mt-0.5 text-[11px] text-slate-500">{formatDisplayDate(dtr.startDate)} to {formatDisplayDate(dtr.endDate)} · {dtr.totalHours.toFixed(2)} hours · {dtr.logs.length} verified records</p>{dtr.remarks && <p className="mt-1 text-[11px] text-[#800000]">{dtr.remarks}</p>}</div><Badge className={dtr.status === 'Approved' ? 'bg-green-100 text-green-800' : dtr.status === 'Needs Revision' || dtr.status === 'Revision Requested' ? 'bg-red-100 text-red-800' : dtr.status === 'Generated' ? 'bg-slate-200 text-slate-700' : 'bg-blue-100 text-blue-800'}>{dtr.status}</Badge></button>)}</div>}</CardContent>
      </Card>
      <Card id="attendance-history" className="order-3 border-slate-200 shadow-sm xl:col-span-3 xl:order-3">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">Attendance Log History</CardTitle>
              <CardDescription className="text-slate-500 text-xs font-normal">A record of geofence-verified clock events and rejected attempts.</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 bg-slate-50 border rounded-lg px-2.5 py-1 text-xs">
                <Filter className="h-3.5 w-3.5 text-slate-400" />
                <select value={filterType} onChange={(event) => setFilterType(event.target.value as any)} className="bg-transparent border-none text-xs font-semibold text-slate-600 focus:outline-none cursor-pointer">
                  <option value="all">All Records</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                  <option value="range">Custom Date Range</option>
                </select>
              </div>
              {filterType === 'range' && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Input type="date" value={historyStartDate} onChange={(event) => setHistoryStartDate(event.target.value)} className="h-8 text-xs border-slate-200 max-w-[120px] px-2" />
                  <span className="text-slate-400 font-semibold">to</span>
                  <Input type="date" value={historyEndDate} onChange={(event) => setHistoryEndDate(event.target.value)} className="h-8 text-xs border-slate-200 max-w-[120px] px-2" />
                </div>
              )}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input type="search" placeholder="Search date, status..." className="pl-8 text-xs h-8 bg-slate-50 border-slate-200 max-w-[180px] focus-visible:ring-[#800000]" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Date</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Time In</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Time Out</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Hours</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Status</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Geofence</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Coordinates</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Correction</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs uppercase text-slate-500">Device</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-slate-400 font-semibold font-sans">No matching attendance logs found.</TableCell>
                </TableRow>
              ) : (
                filteredHistory.map(log => (
                  <TableRow key={log.id} className="hover:bg-slate-50/50 transition-colors text-xs font-sans">
                    <TableCell className="py-3.5 px-4 font-bold text-slate-800">{log.date}</TableCell>
                    <TableCell className="py-3.5 px-4 text-slate-650 font-semibold">{log.timeIn}</TableCell>
                    <TableCell className="py-3.5 px-4 text-slate-650 font-semibold">{log.timeOut || '-'}</TableCell>
                    <TableCell className="py-3.5 px-4 font-extrabold text-slate-800">{log.totalHours > 0 ? `${log.totalHours.toFixed(2)} hrs` : '-'}</TableCell>
                    <TableCell className="py-3.5 px-4">{getAttendanceStatusBadge(log.attendanceStatus)}</TableCell>
                    <TableCell className="py-3.5 px-4">{getStatusBadge(log.locationStatus)}</TableCell>
                    <TableCell className="py-3.5 px-4 font-mono text-[10.5px] text-slate-500">{log.gpsCoordinates ? `${log.gpsCoordinates.lat.toFixed(4)}, ${log.gpsCoordinates.lng.toFixed(4)}` : '-'}</TableCell>
                    <TableCell className="py-3.5 px-4">
                      {log.correction ? (
                        <Badge className={log.correction.status === 'Approved' ? 'bg-green-100 text-green-800' : log.correction.status === 'Rejected' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}>
                          {log.correction.status}
                        </Badge>
                      ) : log.timeOut ? (
                        <Button variant="outline" size="sm" onClick={() => openCorrectionDialog(log)} className="h-7 gap-1 border-slate-200 text-[10px] font-bold text-[#800000] hover:bg-red-50">
                          <ClipboardPenLine className="h-3 w-3" /> Correct
                        </Button>
                      ) : <span className="text-[10px] text-slate-400">Complete time out first</span>}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-[10px] text-slate-400 font-normal truncate max-w-[120px]" title={log.deviceInfo || 'N/A'}>{log.deviceInfo ? log.deviceInfo.split(' ').pop() || 'Browser' : 'N/A'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
    <Dialog open={!!correctionRecord} onOpenChange={(open) => !open && setCorrectionRecord(null)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ClipboardPenLine className="h-5 w-5 text-[#800000]" /> Request attendance correction</DialogTitle>
          <DialogDescription>Changes require adviser approval. The original record and every decision are retained in the audit trail.</DialogDescription>
        </DialogHeader>
        {correctionRecord && <div className="space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <p className="font-bold text-slate-700">Original record — {correctionRecord.date}</p>
            <p className="mt-1 text-slate-500">Time in: <strong>{correctionRecord.timeIn}</strong> · Time out: <strong>{correctionRecord.timeOut || 'Not recorded'}</strong></p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label htmlFor="requestedTimeIn">Requested time in</Label><Input id="requestedTimeIn" type="time" value={requestedTimeIn} onChange={(event) => setRequestedTimeIn(event.target.value)} className="mt-1" /></div>
            <div><Label htmlFor="requestedTimeOut">Requested time out</Label><Input id="requestedTimeOut" type="time" value={requestedTimeOut} onChange={(event) => setRequestedTimeOut(event.target.value)} className="mt-1" /></div>
          </div>
          <div><Label htmlFor="correctionReason">Reason for correction <span className="text-red-600">*</span></Label><textarea id="correctionReason" value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} className="mt-1 min-h-24 w-full rounded-md border border-slate-200 p-2 text-sm" placeholder="Explain why the recorded time needs correction." /></div>
        </div>}
        <DialogFooter><Button variant="outline" onClick={() => setCorrectionRecord(null)}>Cancel</Button><Button onClick={submitCorrectionRequest} className="bg-[#800000] hover:bg-[#6b0000]">Submit for adviser approval</Button></DialogFooter>
      </DialogContent>
    </Dialog>
    </div>
  );
}
