import {StudentClassJoin} from '../../components/forms/StudentClassJoin';
import {officialOjtCoordinator} from '../../data/institution';
import { enrollmentPendingMessage } from '../../lib/studentEnrollmentAccess';
import { welcomeName } from '../../lib/welcomeName';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOJT } from '../../context/OJTContext';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { 
  Play, 
  Square, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FileText, 
  BookOpen, 
  Award,
  ArrowRight,
  MapPin,
  Calendar,
  MessageSquare
} from 'lucide-react';

export function StudentDashboard() {
  const { user } = useAuth();
  const { students, announcements, timeIn, timeOut, mockLocation, isBackendConnected, studentEnrollmentStatus } = useOJT();
  const navigate = useNavigate();

  const student = students.find(s => s.studentId === user?.id || s.email === user?.email);

  if (!student) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-slate-600 mt-2">Student record not found. Please contact the OJT Coordinator.</p>
      </div>
    );
  }

  const enrollmentLocked = studentEnrollmentStatus === 'not_enrolled';
  const isCleared = !enrollmentLocked && student.stage !== 'Stage 1: Pre-OJT';
  
  // Attendance calculation
  const todayDate = new Date().toISOString().split('T')[0];
  const todayRecord = student.attendanceHistory.find(a => a.date === todayDate);
  const isClockedIn = todayRecord && todayRecord.timeOut === null;
  const isClockedOut = todayRecord && todayRecord.timeOut !== null;

  const handleClockIn = () => {
    // Send current mock location coordinates
    const result = timeIn(student.studentId, { lat: mockLocation.lat, lng: mockLocation.lng });
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const handleClockOut = () => {
    const result = timeOut(student.studentId, { lat: mockLocation.lat, lng: mockLocation.lng });
    if (result.success) {
      toast.success(result.message);
    } else {
      toast.error(result.message);
    }
  };

  const completionPct = Math.min(
    student.requiredHours > 0 ? Math.round((student.totalHoursRendered / student.requiredHours) * 100) : 0,
    100
  );
  const studentAnnouncements = announcements.filter(announcement => announcement.targetRole === 'all' || announcement.targetRole === 'student');

  // Pre-OJT stats
  const preOjtTotal = student.preOJTRequirements.length;
  const preOjtApproved = student.preOJTRequirements.filter(r => r.status === 'Approved').length;
  const preOjtPending = student.preOJTRequirements.filter(r => r.status === 'Submitted' || r.status === 'Under Review').length;
  const preOjtRevision = student.preOJTRequirements.filter(r => r.status === 'Needs Revision').length;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#800000] to-[#550000] text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">Intern Portal</span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Welcome back, {welcomeName(student.name)}!</h1>
          <p className="text-white/80 text-sm mt-1 font-light">
            Section: <span className="font-semibold">{student.section}</span> | Adviser: <span className="font-semibold">{student.adviserName}</span>
          </p>
          <p className="text-white/80 text-xs mt-1 font-light">{officialOjtCoordinator.title}: {officialOjtCoordinator.name}</p>
        </div>
        <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/20">
          <p className="text-xs text-white/70">Assigned Partner HTE:</p>
          <p className="font-bold text-sm text-[#D4AF37]">{student.companyName}</p>
        </div>
      </div>

      {/* Lock Warning Notice */}
      {!isCleared && (
        <Card className="border-amber-200 bg-amber-50/50 shadow-sm animate-pulse">
          <CardContent className="p-4 flex gap-3.5 items-start">
            <AlertTriangle className="h-5.5 w-5.5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-amber-900 text-sm">{enrollmentLocked ? 'OJT Enrollment Pending' : 'Deployment Lock Active'}</h4>
              <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                {enrollmentLocked ? enrollmentPendingMessage : 'Complete and wait for approval of your Pre-OJT requirements before accessing During-OJT features.'}
              </p>
              <div className="flex gap-4 mt-3">
                <Button variant="secondary" 
                  size="sm" 
                  disabled={enrollmentLocked}
                  onClick={() => navigate('/pre-ojt')}
                  className="text-xs h-8"
                >
                  Verify Pre-OJT Checklist <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
                <Button 
                  size="sm" 
                  variant="secondary" 
                  disabled={enrollmentLocked}
                  onClick={() => navigate('/moa')}
                  className="text-xs h-8"
                >
                  Track MOA Progress
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isBackendConnected&&<StudentClassJoin/>}

      {/* Status Overview Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Rendered Hours */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Rendered Hours
              <Clock className="h-4.5 w-4.5 text-slate-400" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{student.totalHoursRendered.toFixed(1)}</span>
              <span className="text-xs text-slate-500 font-medium">/ {student.requiredHours} hrs</span>
            </div>
            {/* mini progress bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-3 overflow-hidden">
              <div className="bg-green-500 h-full" style={{ width: `${completionPct}%` }} />
            </div>
            <p className="text-[10px] text-slate-400 mt-2 font-medium">{completionPct}% of required training finished</p>
          </CardContent>
        </Card>

        {/* Remaining Hours */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Remaining Hours
              <Clock className="h-4.5 w-4.5 text-slate-400" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold text-slate-900">
              {Math.max(0, student.requiredHours - student.totalHoursRendered).toFixed(1)}
            </span>
            <span className="text-xs text-slate-500 font-medium ml-1">hrs left</span>
            <p className="text-[10px] text-slate-400 mt-5 font-medium">Based on 8 hrs daily average</p>
          </CardContent>
        </Card>

        {/* Today's Attendance */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Today's Attendance
              <Calendar className="h-4.5 w-4.5 text-slate-400" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              {isClockedIn && (
                <Badge className="bg-green-100 text-green-800 hover:bg-green-100 font-bold px-2.5 py-1 rounded-full text-xs">
                  Active (Clocked In)
                </Badge>
              )}
              {isClockedOut && (
                <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 font-bold px-2.5 py-1 rounded-full text-xs">
                  Completed (Clocked Out)
                </Badge>
              )}
              {!todayRecord && (
                <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 font-bold px-2.5 py-1 rounded-full text-xs">
                  No Record Yet
                </Badge>
              )}
            </div>
            <p className="text-[10px] text-slate-400 mt-4 leading-normal font-medium">
              GPS Boundary Verification: <span className="font-semibold text-slate-700">Required</span>
            </p>
          </CardContent>
        </Card>

        {/* Pre-OJT Status */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Pre-OJT Requirements
              <CheckCircle2 className="h-4.5 w-4.5 text-slate-400" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900">{preOjtApproved}</span>
              <span className="text-xs text-slate-500 font-medium">/ {preOjtTotal} cleared</span>
            </div>
            <div className="flex gap-2 mt-3 text-[9px] font-semibold text-slate-400">
              {preOjtPending > 0 && <span className="text-blue-600">{preOjtPending} Pending</span>}
              {preOjtRevision > 0 && <span className="text-red-500">{preOjtRevision} Revisions</span>}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Center Actions Area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions Panel */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">Attendance & Rapid Controls</CardTitle>
            <CardDescription>Log daily time ins and outs inside the geo-fenced coordinates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3.5">
              <Button
                onClick={handleClockIn}
                disabled={!isCleared || isClockedIn || isClockedOut}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-40"
              >
                <Play className="h-5 w-5" />
                Time In (Clock In)
              </Button>
              <Button
                onClick={handleClockOut}
                disabled={!isCleared || !isClockedIn}
                className="flex-1 bg-slate-900 hover:bg-[#800000] text-white font-bold py-6 rounded-xl flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-40"
              >
                <Square className="h-5 w-5" />
                Time Out (Clock Out)
              </Button>
            </div>

            {/* Quick Navigation Links */}
            <div className="border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Quick Navigation Shortcuts</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  {
                    title: "Submit Daily Task",
                    description: "Log daily activities & hours",
                    path: "/tasks",
                    icon: FileText,
                    iconColor: "text-indigo-600 dark:text-indigo-400",
                    iconBg: "bg-indigo-50 dark:bg-indigo-950/40",
                    hoverBorder: "hover:border-indigo-200 dark:hover:border-indigo-900/50",
                    hoverBg: "hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10",
                    requiresClearance: true,
                  },
                  {
                    title: "Weekly Journal",
                    description: "Write & submit weekly logs",
                    path: "/weekly-journal",
                    icon: BookOpen,
                    iconColor: "text-amber-600 dark:text-amber-400",
                    iconBg: "bg-amber-50 dark:bg-amber-950/40",
                    hoverBorder: "hover:border-amber-200 dark:hover:border-amber-900/50",
                    hoverBg: "hover:bg-slate-100 dark:hover:bg-slate-800",
                    requiresClearance: true,
                  },
                  {
                    title: "Portfolio Status",
                    description: "Check endorsement & files",
                    path: "/portfolio",
                    icon: Award,
                    iconColor: "text-emerald-600 dark:text-emerald-400",
                    iconBg: "bg-emerald-50 dark:bg-emerald-950/40",
                    hoverBorder: "hover:border-emerald-200 dark:hover:border-emerald-900/50",
                    hoverBg: "hover:bg-emerald-50/10 dark:hover:bg-emerald-950/10",
                    requiresClearance: true,
                  },
                  {
                    title: "Check Messages",
                    description: "Inbox & chat communications",
                    path: "/messages",
                    icon: MessageSquare,
                    iconColor: "text-blue-600 dark:text-blue-400",
                    iconBg: "bg-blue-50 dark:bg-blue-950/40",
                    hoverBorder: "hover:border-blue-200 dark:hover:border-blue-900/50",
                    hoverBg: "hover:bg-blue-50/10 dark:hover:bg-blue-950/10",
                    requiresClearance: false,
                  }
                ].map((link, idx) => {
                  const Icon = link.icon;
                  const isDisabled = enrollmentLocked || (link.requiresClearance && !isCleared);
                  return (
                    <button
                      key={idx}
                      disabled={isDisabled}
                      onClick={() => navigate(link.path)}
                      className={`w-full text-left p-3 rounded-xl border border-slate-100 bg-white transition-all duration-200 flex flex-col justify-between group cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md disabled:opacity-45 disabled:cursor-not-allowed ${isDisabled ? "" : `${link.hoverBorder} ${link.hoverBg}`}`}
                    >
                      <div className="flex items-center justify-between w-full mb-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${link.iconBg} shrink-0 transition-transform duration-200 ${isDisabled ? "" : "group-hover:scale-105"}`}>
                          <Icon className={`h-4 w-4 ${link.iconColor}`} />
                        </div>
                        {!isDisabled && (
                          <ArrowRight className="h-3.5 w-3.5 text-slate-350 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all shrink-0" />
                        )}
                      </div>
                      <div className="min-w-0 w-full">
                        <span className={`text-[11px] font-semibold text-slate-700 transition-colors block truncate ${isDisabled ? "" : "group-hover:text-slate-900"}`}>
                          {link.title}
                        </span>
                        <span className="text-[9px] text-slate-400 mt-0.5 block truncate font-normal leading-normal">
                          {link.description}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Remarks and Alerts Panel */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-900">Recent Feedback & Remarks</CardTitle>
            <CardDescription>Notifications from Coordinator & Adviser.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Pre-OJT remark */}
            {student.preOJTRequirements.some(r => r.status === 'Needs Revision') && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-red-700">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Pre-OJT Correction Required
                </div>
                <div className="space-y-1">
                  {student.preOJTRequirements
                    .filter(r => r.status === 'Needs Revision')
                    .map((r, i) => (
                      <p key={i} className="text-slate-600 leading-relaxed">
                        <span className="font-semibold">{r.name}:</span> "{r.remarks}"
                      </p>
                    ))
                  }
                </div>
              </div>
            )}

            {/* MOA Remark */}
            {student.moaState.remarks && (
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <FileText className="h-3.5 w-3.5 text-slate-500" />
                  MOA Status: {student.moaState.status}
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed font-light">
                  Coordinator remarks: "{student.moaState.remarks}"
                </p>
              </div>
            )}

            {/* General welcome notification */}
            {studentAnnouncements.slice(0, 2).map(announcement => (
              <div key={announcement.id} className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <MessageSquare className="h-3.5 w-3.5 text-[#800000]" />
                    {announcement.title}
                  </div>
                  <Badge className={
                    announcement.priority === 'Urgent'
                      ? 'bg-red-100 text-red-800 hover:bg-red-100'
                      : announcement.priority === 'Important'
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                        : 'bg-blue-100 text-blue-800 hover:bg-blue-100'
                  }>
                    {announcement.priority}
                  </Badge>
                </div>
                <p className="text-slate-600 mt-1 leading-relaxed">
                  {announcement.message}
                </p>
              </div>
            ))}

            <div className="p-3 bg-red-50/40 border border-red-100/50 rounded-lg text-xs">
              <div className="flex items-center gap-1.5 font-semibold text-[#800000]">
                <CheckCircle2 className="h-3.5 w-3.5 text-[#800000]" />
                {isBackendConnected?'Student Account Verified':'OJT Program Intake Cleared'}
              </div>
              <p className="text-slate-500 mt-1 leading-relaxed">
                {isBackendConnected?'Saved requirements, adviser feedback and coordinator announcements are shown in this portal.':'Resume approved by section Adviser Michael Chen. Ensure consent slips are notarized.'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
