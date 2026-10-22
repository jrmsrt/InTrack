import { NativeFilePreviewLink } from '../../components/forms/FileViewer';
import React, { useState } from 'react';
import { useOJT, StudentOJTProfile } from '../../context/OJTContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Button } from '../../components/ui/button';
import { RequirementFilePreview, openNativeDocument, resolveRequirementDocument } from '../../components/forms/requirementFiles';
import { MasterlistImportDialog, MasterlistStudent } from '../../components/forms/MasterlistImportDialog';
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
  Filter, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  FileText,
  UserCheck,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

function formatLastFirstMI(fullName: string): string {
  if (!fullName) return '';
  if (fullName.includes(',')) return fullName;
  const parts = fullName.trim().split(/\s+/);
  if (parts.length <= 1) return fullName;
  
  const lastName = parts[parts.length - 1];
  const secondToLast = parts[parts.length - 2];
  if (secondToLast.endsWith('.') || (secondToLast.length === 1 && /[A-Z]/i.test(secondToLast))) {
    const mi = secondToLast.endsWith('.') ? secondToLast : `${secondToLast}.`;
    const firstName = parts.slice(0, parts.length - 2).join(' ');
    return `${lastName}, ${firstName} ${mi}`;
  }
  
  if (parts.length === 2) {
    return `${lastName}, ${parts[0]}`;
  }
  
  const middleName = parts[parts.length - 2];
  const firstName = parts.slice(0, parts.length - 2).join(' ');
  const middleInitial = middleName.charAt(0).toUpperCase();
  return `${lastName}, ${firstName} ${middleInitial}.`;
}

export function StudentMonitoring() {
  const { students, addStudentProfile, isBackendConnected } = useOJT();
  const { user, authorizeStudent } = useAuth();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [programFilter, setProgramFilter] = useState('all');
  
  const [selectedStudent, setSelectedStudent] = useState<StudentOJTProfile | null>(null);
  
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  const handleImportMasterlist = (records: MasterlistStudent[]) => {
    let imported = 0;
    let skipped = 0;
    records.forEach(record => {
      if (students.some(student => student.studentNumber.toLowerCase() === record.studentNumber.toLowerCase())) { skipped += 1; return; }
      const whitelistResult = authorizeStudent(record);
      if (!whitelistResult.success) { skipped += 1; return; }
      addStudentProfile({ studentId: `student-${record.studentNumber}`, studentNumber: record.studentNumber, name: record.name, email: record.email, program: record.program, section: record.section, adviserId: user?.id || 'adviser_temp', adviserName: user?.name || 'Assigned Adviser', companyId: 'c1', companyName: 'TechCorp Inc.' });
      imported += 1;
    });
    return { imported, skipped };
  };

  const getComparableSection = (section: string) => {
    const normalizedSection = section.trim().toUpperCase();
    const legacyMatch = normalizedSection.match(/\b([34])([AB])$/);

    if (legacyMatch) {
      return `${legacyMatch[1]}-${legacyMatch[2] === 'A' ? '1' : '2'}`;
    }

    return section.trim();
  };

  // Filter logic
  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          s.studentNumber.includes(searchTerm);
    const matchesSection = sectionFilter === 'all' || getComparableSection(s.section) === sectionFilter;
    const matchesProgram = programFilter === 'all' || s.program.includes(programFilter);
    return matchesSearch && matchesSection && matchesProgram;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
      case 'Stage 4: Portfolio Completion':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Approved/Received</Badge>;
      case 'Submitted':
      case 'Under Review':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Review</Badge>;
      case 'Needs Revision':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Revision</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200">Pending</Badge>;
    }
  };

  const getStageBadge = (stage: string) => {
    if (stage.includes('Stage 1')) return <Badge className="bg-slate-100 text-slate-700">Pre-OJT</Badge>;
    if (stage.includes('Stage 2')) return <Badge className="bg-amber-500 text-white">During OJT</Badge>;
    if (stage.includes('Stage 3')) return <Badge className="bg-indigo-600 text-white">Post-OJT</Badge>;
    return <Badge className="bg-green-600 text-white">Completed</Badge>;
  };

  const renderRequirementTile = (
    requirement: { name: string; status: string; fileName: string | null },
    student: StudentOJTProfile,
    stage: RequirementFilePreview['stage']
  ) => (
    <div className="flex justify-between items-start gap-3 p-2 bg-slate-50 rounded border">
      <div className="min-w-0">
        <span className="font-medium text-slate-700 truncate max-w-[180px] block">{requirement.name}</span>
        {requirement.fileName && (
          <NativeFilePreviewLink file={resolveRequirementDocument(students, {
              studentName: student.name,
              reqName: requirement.name,
              fileName: requirement.fileName || '',
              stage
            })}>
            <span className="truncate">{requirement.fileName}</span>
          </NativeFilePreviewLink>
        )}
      </div>
      <div className="shrink-0">{getStatusBadge(requirement.status)}</div>
    </div>
  );

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Student Monitoring Module</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track OJT progression and clearances for all students under your advisory.</p>
        </div>
        <Button disabled={isBackendConnected} title={isBackendConnected?'Whitelisting is managed by the coordinator. Enroll students through My Classes.':undefined} onClick={() => setImportDialogOpen(true)} className="h-9 gap-1.5 bg-[#800000] text-xs font-bold hover:bg-[#6b0000]"><FileSpreadsheet className="h-4 w-4" /> Import & whitelist</Button>
      </div>

      <MasterlistImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onImport={handleImportMasterlist} title="Import Advisee Masterlist" />

      {/* Filter panel */}
      <Card className="shadow-sm border-slate-200">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-1.5 w-full">
            <Label htmlFor="search" className="text-xs">Search student</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="search"
                type="search"
                placeholder="Search by student name or ID..."
                className="pl-10 text-xs bg-slate-50 border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="w-full md:w-48 space-y-1.5">
            <Label htmlFor="program" className="text-xs">Program Course</Label>
            <select
              id="program"
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
            <Label htmlFor="section" className="text-xs">Class Section</Label>
            <select
              id="section"
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
        </CardContent>
      </Card>

      {/* Progress Board Table */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800">Student Progress Matrix</CardTitle>
          <CardDescription>Click on any student record to view their detailed checklist submissions.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Intern Details</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Company assigned</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Rendered Hours</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">OJT Flow Stage</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center">Pre-OJT</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center">During-OJT</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center">Post-OJT</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center">Portfolio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-slate-400">
                    No matching student records found.
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((s) => {
                  const preCountApproved = s.preOJTRequirements.filter(r => r.status === 'Approved').length;
                  const duringCountApproved = s.duringOJTRequirements.filter(r => r.status === 'Approved').length;
                  const postCountApproved = s.postOJTRequirements.filter(r => r.status === 'Approved').length;

                  return (
                    <TableRow data-interactive="true" 
                      key={s.studentId}
                      onClick={() => setSelectedStudent(s)}
                      className="hover:bg-slate-50/50 transition-colors cursor-pointer"
                    >
                      <TableCell className="py-3.5 px-4">
                        <span className="font-bold text-slate-800 text-xs block">{formatLastFirstMI(s.name)}</span>
                        <span className="text-[10px] text-slate-400 font-medium">{s.studentNumber} | {s.section}</span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-650">
                        {s.companyName}
                      </TableCell>
                      <TableCell className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-slate-800 text-xs">{s.totalHoursRendered.toFixed(0)}</span>
                          <span className="text-[10px] text-slate-400 font-medium">/ {s.requiredHours} hrs</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 font-semibold text-xs">
                        {getStageBadge(s.stage)}
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-center">
                        <span className="text-xs font-semibold text-slate-700">{preCountApproved}/{s.preOJTRequirements.length}</span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-center">
                        <span className="text-xs font-semibold text-slate-700">{duringCountApproved}/{s.duringOJTRequirements.length}</span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-center">
                        <span className="text-xs font-semibold text-slate-700">{postCountApproved}/{s.postOJTRequirements.length}</span>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-center">
                        {s.portfolioApproved ? (
                          <Badge className="bg-green-100 text-green-800">Endorsed</Badge>
                        ) : s.portfolioSubmitted ? (
                          <Badge className="bg-blue-100 text-blue-800">Review</Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-400">Draft</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Student Details Dialog Checklist View */}
      {selectedStudent && (
        <Dialog open={!!selectedStudent} onOpenChange={() => setSelectedStudent(null)}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{formatLastFirstMI(selectedStudent.name)}'s OJT Checklist Status</DialogTitle>
              <DialogDescription>
                Detailed audit of submitted checklists across all stages.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-6 text-xs">
              {/* Pre-OJT */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs border-b pb-1">1. Pre-OJT Clearances</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedStudent.preOJTRequirements.map((r, i) => (
                    <React.Fragment key={i}>{renderRequirementTile(r, selectedStudent, 'Pre-OJT')}</React.Fragment>
                  ))}
                  <div className="flex justify-between items-center p-2 bg-slate-50 rounded border">
                    <div className="min-w-0">
                      <span className="font-medium text-slate-700 block">Memorandum of Agreement</span>
                      {selectedStudent.moaState.fileName && (
                        <NativeFilePreviewLink file={resolveRequirementDocument(students, {
                            studentName: selectedStudent.name,
                            reqName: 'Memorandum of Agreement',
                            fileName: selectedStudent.moaState.fileName || '',
                            stage: 'MOA'
                          })}>
                          <span className="truncate">{selectedStudent.moaState.fileName}</span>
                        </NativeFilePreviewLink>
                      )}
                    </div>
                    {getStatusBadge(selectedStudent.moaState.status)}
                  </div>
                </div>
              </div>

              {/* During-OJT */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs border-b pb-1">2. During-OJT Deliverables</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedStudent.duringOJTRequirements.map((r, i) => (
                    <React.Fragment key={i}>{renderRequirementTile(r, selectedStudent, 'During-OJT')}</React.Fragment>
                  ))}
                </div>
              </div>

              {/* Post-OJT */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-800 text-xs border-b pb-1">3. Post-OJT Documents</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedStudent.postOJTRequirements.map((r, i) => (
                    <React.Fragment key={i}>{renderRequirementTile(r, selectedStudent, 'Post-OJT')}</React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      
    </div>
  );
}

function Label({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return <label htmlFor={htmlFor} className={`font-semibold text-slate-600 ${className}`}>{children}</label>;
}
