import { welcomeName } from '../../lib/welcomeName';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useOJT } from '../../context/OJTContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { 
  Users, 
  Clock, 
  FileCheck, 
  FileText,
  Award, 
  ArrowRight, 
  Calendar,
} from 'lucide-react';

export function AdviserDashboard() {
  const { user } = useAuth();
  const { students } = useOJT();
  const navigate = useNavigate();

  // Filter student profiles assigned to this adviser
  const assignedStudents = students.filter(s => s.adviserId === user?.id || s.adviserName === user?.name);

  // Compute metrics
  const totalCount = assignedStudents.length;
  
  // Pending approvals
  let pendingJournalCount = 0;
  let pendingPortfolioCount = 0;
  let completedHoursCount = 0;

  assignedStudents.forEach(s => {
    pendingJournalCount += s.weeklyJournals.filter(j => j.status === 'Submitted').length;
    if (s.portfolioSubmitted && !s.portfolioApproved) {
      pendingPortfolioCount++;
    }
    if (s.totalHoursRendered >= s.requiredHours) {
      completedHoursCount++;
    }
  });

  return (
    <div className="space-y-6 font-sans">
      {/* Adviser Welcome */}
      <div className="bg-slate-900 text-white p-6 rounded-2xl shadow-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <span className="text-[#D4AF37] text-xs font-bold uppercase tracking-wider">Faculty Portal</span>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight mt-1">Hello, Prof. {welcomeName(user?.name)}!</h1>
          <p className="text-slate-350 text-sm mt-1 font-light">
            Monitor and endorse clearances for your assigned OJT section groups.
          </p>
        </div>
        <div className="bg-white/10 px-4 py-2.5 rounded-xl border border-white/20 text-xs">
          <p className="text-slate-350">Academic Oversight:</p>
          <p className="font-bold text-slate-100 text-sm mt-0.5">{[...new Set(assignedStudents.map(s=>s.section).filter(Boolean))].join(', ')||'No enrolled students yet'}</p>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Interns */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Assigned Interns
              <Users className="h-4.5 w-4.5 text-slate-400" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold text-slate-900">{totalCount}</span>
            <span className="text-xs text-slate-500 font-medium ml-1">students</span>
            <p className="text-[10px] text-slate-400 mt-4 font-medium">Students enrolled in your classes</p>
          </CardContent>
        </Card>

        {/* Pending Journals */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Pending Journals
              <Clock className="h-4.5 w-4.5 text-slate-400" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold text-slate-900">{pendingJournalCount}</span>
            <span className="text-xs text-slate-500 font-medium ml-1">to review</span>
            {pendingJournalCount > 0 && (
              <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 text-[9px] scale-90 mt-3.5 block font-bold text-center w-24">
                Needs Review
              </Badge>
            )}
          </CardContent>
        </Card>

        {/* Completed Hours */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Hours Completed
              <FileCheck className="h-4.5 w-4.5 text-slate-400" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold text-slate-900">{completedHoursCount}</span>
            <span className="text-xs text-slate-500 font-medium ml-1">interns</span>
            <p className="text-[10px] text-slate-400 mt-4 font-medium">Met their program’s required hours</p>
          </CardContent>
        </Card>

        {/* Portfolios for Review */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              Portfolio Reviews
              <Award className="h-4.5 w-4.5 text-slate-400" />
            </CardDescription>
          </CardHeader>
          <CardContent>
            <span className="text-3xl font-extrabold text-slate-900">{pendingPortfolioCount}</span>
            <span className="text-xs text-slate-500 font-medium ml-1">awaiting</span>
            {pendingPortfolioCount > 0 && (
              <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-250 text-[9px] scale-90 mt-3.5 block font-bold text-center w-24">
                Awaiting Endorsement
              </Badge>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Task Grids */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pending Actions Feed */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">Pending Review Queue</CardTitle>
            <CardDescription>Actions requiring your review and endorsement signature.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            {pendingJournalCount === 0 && pendingPortfolioCount === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                All queues clear! No pending submissions.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {assignedStudents.map((s) => {
                  const sJournals = s.weeklyJournals.filter(j => j.status === 'Submitted');
                  const needsPortfolio = s.portfolioSubmitted && !s.portfolioApproved;

                  if (sJournals.length === 0 && !needsPortfolio) return null;

                  return (
                    <div key={s.studentId} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{s.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">{s.program} | {s.section}</p>
                      </div>
                      <div className="flex gap-2.5 items-center">
                        {sJournals.length > 0 && (
                          <Badge variant="outline" className="text-[10px] font-semibold text-amber-700 border-amber-200 bg-amber-50">
                            {sJournals.length} Weekly Journals
                          </Badge>
                        )}
                        {needsPortfolio && (
                          <Badge variant="outline" className="text-[10px] font-semibold text-purple-700 border-purple-200 bg-purple-50">
                            Portfolio Submission
                          </Badge>
                        )}
                        <Button 
                          size="sm"
                          onClick={() => {
                            if (sJournals.length > 0) navigate('/adviser/journals');
                            else navigate('/adviser/portfolio');
                          }}
                          className="bg-[#800000] hover:bg-[#6b0000] text-white text-[10px] h-7 font-semibold"
                        >
                          Review <ArrowRight className="h-3 w-3 ml-1" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick links to monitors */}
        <Card className="shadow-sm border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold text-slate-800">Quick Navigation</CardTitle>
            <CardDescription>Shortcut access to monitoring panels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              {
                title: "Student Monitoring Board",
                description: "Review progress, weekly journals, & portfolios",
                path: "/adviser/students",
                icon: Users,
                iconColor: "text-indigo-600 dark:text-indigo-400",
                iconBg: "bg-indigo-50 dark:bg-indigo-950/40",
                hoverBorder: "hover:border-indigo-200 dark:hover:border-indigo-900/50",
                hoverBg: "hover:bg-indigo-50/10 dark:hover:bg-indigo-950/10",
              },
              {
                title: "Attendance Monitor Calendar",
                description: "Check daily student time logs & calendar sheets",
                path: "/adviser/attendance",
                icon: Calendar,
                iconColor: "text-amber-600 dark:text-amber-400",
                iconBg: "bg-amber-50 dark:bg-amber-950/40",
                hoverBorder: "hover:border-amber-200 dark:hover:border-amber-900/50",
                hoverBg: "hover:bg-slate-100 dark:hover:bg-slate-800",
              },
              {
                title: "Forms and Templates",
                description: "Download university templates & guidelines",
                path: "/adviser/forms-templates",
                icon: FileText,
                iconColor: "text-blue-600 dark:text-blue-400",
                iconBg: "bg-blue-50 dark:bg-blue-950/40",
                hoverBorder: "hover:border-blue-200 dark:hover:border-blue-900/50",
                hoverBg: "hover:bg-blue-50/10 dark:hover:bg-blue-950/10",
              }
            ].map((link, idx) => {
              const Icon = link.icon;
              return (
                <button
                  key={idx}
                  onClick={() => navigate(link.path)}
                  className={`w-full text-left p-3 rounded-xl border border-slate-100 bg-white transition-all duration-200 flex items-center justify-between group cursor-pointer shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md ${link.hoverBorder} ${link.hoverBg}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${link.iconBg} shrink-0 transition-transform duration-200 group-hover:scale-105`}>
                      <Icon className={`h-4.5 w-4.5 ${link.iconColor}`} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-slate-700 group-hover:text-slate-900 transition-colors block truncate">
                        {link.title}
                      </span>
                      <span className="text-[10px] text-slate-400 mt-0.5 block truncate font-normal leading-normal">
                        {link.description}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return <ArrowRight className={className} />;
}
