import React, { useMemo, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { DailyTask, useOJT, WeeklyJournal as WeeklyJournalRecord } from '../../context/OJTContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  BookOpen,
  Download,
  FileText,
  Search
} from 'lucide-react';

type WeekOption = {
  weekNumber: number;
  startDate: string;
  endDate: string;
  label: string;
};

function toDateKey(date: Date) {
  return date.toISOString().split('T')[0];
}

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function getMonday(date: Date) {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatRangeLabel(startDate: string, endDate: string) {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  return `${startLabel} - ${endLabel}`;
}

function getTaskSummary(tasks: DailyTask[]) {
  if (tasks.length === 0) return '';
  return tasks
    .map(task => `${task.date}: ${task.title} - ${task.description}${task.output ? ` Output: ${task.output}.` : ''}`)
    .join('\n\n');
}

function getTaskProblems(tasks: DailyTask[], fallback: string) {
  const taskProblems = tasks
    .map(task => task.problemsEncountered?.trim())
    .filter(Boolean)
    .filter(problem => problem.toLowerCase() !== 'none');
  return [...taskProblems, fallback.trim()].filter(Boolean).join('\n\n') || 'None';
}

function getTaskSkills(tasks: DailyTask[], reflection: string) {
  const taskSkills = tasks
    .map(task => task.skillsApplied?.trim())
    .filter(Boolean);
  return [...taskSkills, reflection.trim()].filter(Boolean).join('\n\n') || 'Not specified in daily task logs.';
}

export function WeeklyJournal() {
  const { user } = useAuth();
  const { students, companies } = useOJT();

  const student = students.find(s => s.studentId === user?.id || s.email === user?.email);
  const company = student ? companies.find(c => c.id === student.companyId) : null;

  const weekOptions = useMemo<WeekOption[]>(() => {
    if (!student) return [];

    const taskWeeks = student.dailyTasks.reduce<Map<string, { start: Date; end: Date }>>((map, task) => {
      const start = getMonday(parseDateKey(task.date));
      const end = new Date(start);
      end.setDate(start.getDate() + 4);
      const key = toDateKey(start);
      map.set(key, { start, end });
      return map;
    }, new Map());

    if (taskWeeks.size === 0) {
      const fallbackStart = getMonday(new Date());
      const fallbackEnd = new Date(fallbackStart);
      fallbackEnd.setDate(fallbackStart.getDate() + 4);
      taskWeeks.set(toDateKey(fallbackStart), { start: fallbackStart, end: fallbackEnd });
    }

    return Array.from(taskWeeks.values())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .map((week, index) => {
        const startDate = toDateKey(week.start);
        const endDate = toDateKey(week.end);
        return {
          weekNumber: index + 1,
          startDate,
          endDate,
          label: `Week ${index + 1} (${formatRangeLabel(startDate, endDate)})`
        };
      });
  }, [student]);

  const [selectedWeekIndex, setSelectedWeekIndex] = useState(0);
  const [assignedDepartment, setAssignedDepartment] = useState('IT Department');
  const [reflection, setReflection] = useState('');
  const [problems, setProblems] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [isGenerated, setIsGenerated] = useState(false);
  const [generatedJournal, setGeneratedJournal] = useState<WeeklyJournalRecord | null>(null);

  if (!student) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-slate-600 mt-2">Student record not found.</p>
      </div>
    );
  }

  const selectedWeek = weekOptions[Math.min(selectedWeekIndex, weekOptions.length - 1)];
  const weeklyLogs = student.dailyTasks
    .filter(task => {
      if (!selectedWeek) return false;
      const taskDate = parseDateKey(task.date);
      const startDate = parseDateKey(selectedWeek.startDate);
      const endDate = parseDateKey(selectedWeek.endDate);
      endDate.setHours(23, 59, 59, 999);
      return taskDate >= startDate && taskDate <= endDate;
    })
    .filter(task =>
      task.date.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      task.skillsApplied.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => parseDateKey(a.date).getTime() - parseDateKey(b.date).getTime());

  const totalHours = weeklyLogs.reduce((sum, task) => {
    const start = task.timeStarted || '08:00 AM';
    const end = task.timeEnded || '05:00 PM';
    const parseTime = (value: string) => {
      const [time, modifier] = value.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return hours + minutes / 60;
    };
    const diff = Math.max(0, parseTime(end) - parseTime(start));
    return sum + diff;
  }, 0);

  const handleGenerate = () => {
    if (!selectedWeek) return;
    if (weeklyLogs.length === 0) {
      toast.error('No daily task logs found for the selected week.');
      return;
    }
    if (!getTaskSkills(weeklyLogs, reflection).trim()) {
      toast.error('No relevant skills or competencies were found in the selected week.');
      return;
    }

    const journal: WeeklyJournalRecord = {
      id: `weekly_preview_${Date.now()}`,
      weekNumber: selectedWeek.weekNumber,
      startDate: selectedWeek.startDate,
      endDate: selectedWeek.endDate,
      tasks: weeklyLogs,
      reflection,
      problems: getTaskProblems(weeklyLogs, problems),
      totalHours,
      status: 'Draft'
    };

    setGeneratedJournal(journal);
    setIsGenerated(true);
    toast.success(`Weekly Journal generated from ${weeklyLogs.length} daily task logs.`);
  };

  const storeGeneratedJournal = (journal: WeeklyJournalRecord) => {
    sessionStorage.setItem(`weeklyJournal:${journal.id}`, JSON.stringify({
      studentId: student.studentId,
      journal,
      reflection,
      problems,
      assignedDepartment
    }));
  };

  const handleDownloadPdf = () => {
    if (!generatedJournal) return;
    storeGeneratedJournal(generatedJournal);

    const iframe = document.createElement('iframe');
    iframe.src = `/print-weekly-journal/${generatedJournal.id}`;
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.onload = () => {
      setTimeout(() => iframe.remove(), 3000);
    };
    document.body.appendChild(iframe);

    toast.success('Weekly Journal PDF export opened.');
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Weekly Journal</h1>
          <p className="text-slate-500 text-sm mt-0.5">Generate the official Weekly Journal Report from your daily task logs.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start">
        <div className="xl:col-span-1 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800">Journal Compiler</CardTitle>
              <CardDescription className="text-xs">Select a week, review retrieved logs, and generate the official report.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-xs">
              <div className="space-y-2">
                <Label htmlFor="weekSelector" className="text-xs">Selected Week</Label>
                <select
                  id="weekSelector"
                  value={selectedWeekIndex}
                  onChange={(event) => {
                    setSelectedWeekIndex(Number(event.target.value));
                    setIsGenerated(false);
                    setGeneratedJournal(null);
                  }}
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs focus:ring-[#800000] focus:border-[#800000]"
                >
                  {weekOptions.map((week, index) => (
                    <option value={index} key={`${week.startDate}-${week.endDate}`}>{week.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="department" className="text-xs">Assigned Department</Label>
                <Input
                  id="department"
                  value={assignedDepartment}
                  onChange={(event) => setAssignedDepartment(event.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="reflectionText" className="text-xs">Additional Skills / Competencies Notes</Label>
                <Textarea
                  id="reflectionText"
                  placeholder="Optional. The system already retrieves skills from daily task logs; add extra weekly notes here if needed."
                  value={reflection}
                  onChange={(event) => setReflection(event.target.value)}
                  rows={4}
                  className="text-xs p-2.5"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="problemsText" className="text-xs">Additional Problems / Difficulties Notes</Label>
                <Textarea
                  id="problemsText"
                  placeholder="Optional. The system already retrieves problems from daily task logs; add extra weekly notes here if needed."
                  value={problems}
                  onChange={(event) => setProblems(event.target.value)}
                  rows={3}
                  className="text-xs p-2.5"
                />
              </div>

              <Button
                onClick={handleGenerate}
                className="w-full bg-[#800000] hover:bg-[#6b0000] text-white font-bold text-xs py-2.5 mt-2 cursor-pointer shadow-sm"
              >
                <FileText className="h-4 w-4 mr-1" /> Generate Weekly Journal
              </Button>
            </CardContent>
          </Card>

        </div>

        <div className="xl:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-800">Retrieved Daily Task Logs</CardTitle>
                  <CardDescription className="text-xs">These records will be inserted into the Weekly Journal template.</CardDescription>
                </div>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                  <Input
                    value={searchTerm}
                    onChange={(event) => setSearchTerm(event.target.value)}
                    placeholder="Search logs..."
                    className="pl-8 h-8 text-xs w-56"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {weeklyLogs.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">No daily task logs found for this week.</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {weeklyLogs.map(task => (
                    <div key={task.id} className="p-4 grid grid-cols-1 md:grid-cols-[120px_1fr] gap-3 text-xs">
                      <div>
                        <p className="font-bold text-slate-800">{task.date}</p>
                        <p className="text-[10px] text-slate-400">{task.timeStarted} - {task.timeEnded}</p>
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{task.title}</p>
                        <p className="text-slate-600 mt-1">{task.description}</p>
                        <p className="text-[10px] text-slate-500 mt-2"><span className="font-bold">Skills:</span> {task.skillsApplied || 'Not specified'}</p>
                        <p className="text-[10px] text-slate-500 mt-1"><span className="font-bold">Problems:</span> {task.problemsEncountered || 'None'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-sm border-slate-200 overflow-hidden">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 pb-3.5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold text-slate-850">Official Weekly Journal Preview</CardTitle>
                  <CardDescription className="text-xs">Template-based preview using the selected week's task logs.</CardDescription>
                </div>
                {isGenerated && generatedJournal && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={handleDownloadPdf}
                      className="text-xs h-8 bg-slate-50/70 border-slate-200 text-slate-600 hover:bg-[#800000] hover:text-white hover:border-[#800000] flex items-center gap-1 cursor-pointer font-bold shadow-sm"
                    >
                      <Download className="h-3.5 w-3.5" /> Download PDF
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="bg-slate-100/50 p-5">
              {!isGenerated || !generatedJournal ? (
                <div className="min-h-[360px] flex flex-col items-center justify-center text-center text-slate-400 space-y-3">
                  <BookOpen className="h-10 w-10 text-slate-350" />
                  <p className="text-xs max-w-sm">Generate the journal to preview the completed official Weekly Journal Report form.</p>
                </div>
              ) : (
                <div className="bg-white border border-slate-300 shadow-sm mx-auto w-full max-w-[760px] p-5 text-[10px] text-black font-sans">
                  <div className="grid grid-cols-[72px_1fr_90px] gap-3 items-start mb-4">
                    <img src="/pup-logo.png" alt="" className="h-20 w-20 object-contain" />
                    <div className="font-serif leading-tight">
                      <p>REPUBLIC OF THE PHILIPPINES</p>
                      <p className="text-base font-extrabold">POLYTECHNIC UNIVERSITY OF THE PHILIPPINES</p>
                      <p>OFFICE OF THE VICE PRESIDENT FOR CAMPUSES</p>
                      <p className="text-base font-extrabold">PARANAQUE CITY CAMPUS</p>
                    </div>
                    <img src="/bagong-pilipinas.png" alt="" className="h-20 w-20 object-contain justify-self-end" />
                  </div>

                  <div className="border border-black grid grid-cols-[80px_1fr_180px] min-h-[80px] text-center font-bold">
                    <div className="border-r border-black flex items-center justify-center"><img src="/pup-logo.png" alt="" className="h-14 w-14 object-contain" /></div>
                    <div className="border-r border-black flex items-center justify-center text-lg">WEEKLY JOURNAL REPORT</div>
                    <div className="flex items-center justify-center text-lg">FORM 4</div>
                  </div>
                  <div className="border-x border-b border-black grid grid-cols-[1fr_180px] text-xs">
                    <div className="border-r border-black px-3 py-1">Program: <strong>On the Job Training Program</strong></div>
                    <div className="px-3 py-1">Semester:</div>
                  </div>
                  <div className="border-x border-b border-black px-3 py-1 text-xs">Subject: <strong>Weekly Journal Report</strong></div>

                  <div className="border border-black mt-2 p-3 text-xs leading-snug space-y-1">
                    <div className="grid grid-cols-[auto_minmax(0,1.4fr)_auto_minmax(0,0.8fr)] gap-x-1 items-end">
                      <span>Name of Trainee:</span><span className="font-bold border-b border-black break-words min-w-0 px-1">{student.name}</span>
                      <span>Year and Section:</span><span className="font-bold border-b border-black break-words min-w-0 px-1">{student.section}</span>
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1 items-end">
                      <span>Company:</span><span className="font-bold border-b border-black break-words min-w-0 px-1">{company?.name || student.companyName}</span>
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1 items-end">
                      <span>Address:</span><span className="font-bold border-b border-black break-words min-w-0 px-1">{company?.address || ''}</span>
                    </div>
                    <div className="grid grid-cols-[auto_minmax(0,1.2fr)_auto_minmax(0,0.8fr)] gap-x-1 items-end">
                      <span>Training Supervisor:</span><span className="font-bold border-b border-black break-words min-w-0 px-1">{company?.contactPerson || ''}</span>
                      <span>Contact Numbers:</span><span className="font-bold border-b border-black break-words min-w-0 px-1">{company?.contactNumber || ''}</span>
                    </div>
                    <p>Instruction: Briefly discuss here your accomplished tasks and activities and the corresponding new skills learned and applied as well as any problem/difficulty encountered in any given area/department.</p>
                  </div>

                  <h3 className="text-center font-serif text-lg my-3 tracking-wide">WEEKLY JOURNAL REPORT</h3>

                  <table className="intrack-table w-full border-collapse border border-black text-[10px] table-fixed">
                    <tbody>
                      <tr className="text-center">
                        <td className="border border-black p-2 w-[16%]">Training Period</td>
                        <td className="border border-black p-2 w-[16.5%] whitespace-nowrap">Week No. <span className="inline-block border-b border-black min-w-8">{generatedJournal.weekNumber}</span></td>
                        <td className="border border-black p-2 w-[16.5%] whitespace-nowrap">From <span className="inline-block border-b border-black min-w-20">{generatedJournal.startDate}</span></td>
                        <td className="border border-black p-2 w-[26%] whitespace-nowrap">To <span className="inline-block border-b border-black min-w-20">{generatedJournal.endDate}</span></td>
                        <td className="border border-black p-2 w-[25%]">Assigned Department:<br />{assignedDepartment}</td>
                      </tr>
                      <tr className="text-center">
                        <td className="border border-black p-2" colSpan={3}>Assigned Tasks</td>
                        <td className="border border-black p-2">Any Problem/s/ Difficulty Encountered (if any)</td>
                        <td className="border border-black p-2">Relevant Skills/Competencies Learned/Applied</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-2 whitespace-pre-wrap align-top h-72" colSpan={3}>{getTaskSummary(generatedJournal.tasks)}</td>
                        <td className="border border-black p-2 whitespace-pre-wrap align-top">{getTaskProblems(generatedJournal.tasks, problems)}</td>
                        <td className="border border-black p-2 whitespace-pre-wrap align-top">{getTaskSkills(generatedJournal.tasks, reflection)}</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-0 h-32 align-top" colSpan={3}>
                          <div className="h-full min-h-32 flex flex-col justify-between p-2">
                            <span>Noted:</span>
                            <span className="text-center">
                              <span className="block border-b border-black w-64 max-w-[90%] mx-auto min-h-5 mb-1">{company?.contactPerson || ''}</span>
                              Company Training Supervisor
                            </span>
                          </div>
                        </td>
                        <td className="border border-black p-2"></td>
                        <td className="border border-black p-2"></td>
                      </tr>
                    </tbody>
                  </table>

                  <div className="grid grid-cols-[300px_1fr] gap-2 items-start mt-3 text-[9px] leading-tight">
                    <div>
                      PUP Paranaque Campus, Col. E de Leon St. Wawa,<br />
                      Brgy. Sto. Nino, Paranaque City<br />
                      Direct line: (02) 8553 8623 | Email: <span className="text-blue-700 underline">paranaque@pup.edu.ph</span><br />
                      Website: www.pup.edu.ph | Inquiries: https://bit.ly/PUPSINTA
                      <p className="text-sm leading-tight mt-1" style={{ fontFamily: '"Trajan Pro", "Times New Roman", serif' }}>A LEADING COMPREHENSIVE<br />POLYTECHNIC UNIVERSITY IN ASIA</p>
                    </div>
                    <img src="/weekly-journal-footer.png" alt="" className="w-full max-w-[360px] object-contain justify-self-end" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
