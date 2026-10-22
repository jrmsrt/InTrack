import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import { NativeFilePreviewLink } from '../../components/forms/FileViewer';
import { openNativeDocument } from '../../components/forms/requirementFiles';
import React, { useState } from 'react';

import { moaStatuses, type MoaStatus } from '../../domain/contracts';
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
  FileText, 
  AlertTriangle,
  Clock,
  Calendar,
  ExternalLink
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

export function MOAManagement() {
  const { students, reviewMOA } = useCoordinatorModuleData();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [moaStatus, setMoaStatus] = useState<MoaStatus>('FOR COMPANY REVIEW');
  const [remarks, setRemarks] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  const formatDateTime = (value?: string) => {
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

  const student = students.find(s => s.studentId === selectedStudentId);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.moaState.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReviewActionSubmit = async (e: React.FormEvent) => {
    try {
    e.preventDefault();
    if (!selectedStudentId) return;

    const result = await reviewMOA(selectedStudentId, moaStatus, remarks);
    if (!result.success) {
      toast.error(result.error || 'Unable to update MOA status.');
      return;
    }
    toast.success(`MOA status updated for ${student?.name}`, {
      description: `New Status: ${moaStatus}`
    });
    
    setReviewDialogOpen(false);
    setSelectedStudentId(null);
    setRemarks('');
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SAS COPY SUBMITTED':
        return <Badge className="bg-green-100 text-green-800 border-green-200 font-semibold">SAS COPY SUBMITTED</Badge>;
      case 'SIGNED AND NOTARIZED':
        return <Badge className="bg-green-105 text-green-800 border-green-200 font-semibold">SIGNED AND NOTARIZED</Badge>;
      case 'FOR NOTARIZATION':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-semibold">FOR NOTARIZATION</Badge>;
      case 'IN-PROCESS FOR REVISION':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-205 font-semibold">IN-PROCESS FOR REVISION</Badge>;
      case 'IN-PROCESS FOR REVIEW OF ULCO':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-semibold">IN-PROCESS FOR REVIEW OF ULCO</Badge>;
      case 'FOR COMPANY REVIEW':
        return <Badge className="bg-indigo-100 text-indigo-855 border-indigo-200 font-semibold">FOR COMPANY REVIEW</Badge>;
      case 'NO MOA':
      default:
        return <Badge className="bg-slate-105 text-slate-500 border-slate-200 font-semibold">NO MOA</Badge>;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">MOA Management</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-light">Audit company agreements, coordinate signatures, and archive notarized documentation packets.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by student name or status..."
            className="pl-10 text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#800000]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800 font-sans">Agreement Pipelines Registry</CardTitle>
          <CardDescription>Track Memorandum of Agreement statuses across deployed company partners.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Intern Details</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Deployment Company</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase font-sans">MOA Document</TableHead>
                <th className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-left w-32 font-sans font-normal">Last Update</th>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Pipeline Status</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center w-28">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((s) => {
                const lastLog = s.moaState.timeline[s.moaState.timeline.length - 1];
                return (
                  <TableRow key={s.studentId} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-3.5 px-4 font-sans">
                      <span className="font-bold text-slate-800 text-xs block">{s.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{s.studentNumber} | {s.section}</span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-650">
                      {s.companyName}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs">
                      {s.moaState.pendingUpload?.fileName || s.moaState.fileName ? (
                        <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                          <NativeFilePreviewLink file={s.moaState.pendingUpload?.file ?? s.moaState.file}>
                            {s.moaState.pendingUpload?.fileName ?? s.moaState.fileName}
                          </NativeFilePreviewLink>
                        </div>
                      ) : (
                        <span className="text-slate-400">No upload yet</span>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-500">
                      {lastLog ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          {lastLog.date}
                        </span>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      {getStatusBadge(s.moaState.status)}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedStudentId(s.studentId);
                          setMoaStatus(s.moaState.status === 'NO MOA' ? 'FOR COMPANY REVIEW' : s.moaState.status);
                          setRemarks(s.moaState.remarks || '');
                          setReviewDialogOpen(true);
                        }}
                        className="bg-[#800000] hover:bg-[#6b0000] text-white text-[10px] h-7 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        Manage MOA
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Review & Status dialogue */}
      {student && (
        <Dialog open={reviewDialogOpen} onOpenChange={() => setReviewDialogOpen(false)}>
          <DialogContent className="w-[calc(100%-2rem)] sm:max-w-2xl max-h-[92vh] overflow-y-auto font-sans">
            <form onSubmit={handleReviewActionSubmit} className="space-y-4">
              <DialogHeader>
                <DialogTitle>Coordinate Agreement Status</DialogTitle>
                <DialogDescription>
                  Update the pipeline status and legal remarks for <span className="font-semibold">{student.name}</span>.
                </DialogDescription>
              </DialogHeader>
              <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">Submission details</h3>
                  {getStatusBadge(student.moaState.status)}
                </div>
                <p><span className="font-semibold text-slate-800">Student:</span> {student.name} ({student.studentNumber})</p>
                <p><span className="font-semibold text-slate-800">Program and section:</span> {student.program} / {student.section}</p>
                <p><span className="font-semibold text-slate-800">Company:</span> {student.companyName}</p>
                <p><span className="font-semibold text-slate-800">Document:</span> {student.moaState.pendingUpload?.fileName || student.moaState.file?.name || student.moaState.fileName || 'No digital file attached'}</p>
                {student.moaState.pendingUpload && <p className="text-amber-700">New upload awaiting your review. The displayed status is the previous coordinator decision.</p>}
                <p><span className="font-semibold text-slate-800">Submitted:</span> {formatDateTime(student.moaState.submittedAt)}</p>
                <p><span className="font-semibold text-slate-800">Last reviewed:</span> {formatDateTime(student.moaState.reviewedAt)}</p>
              </section>

              <Button
                type="button"
                variant="outline"
                className="w-full border-[#800000]/30 text-[#800000] hover:bg-red-50 hover:text-[#600000]"
                disabled={!(student.moaState.pendingUpload?.file ?? student.moaState.file)?.url}
                onClick={() => openNativeDocument(student.moaState.pendingUpload?.file ?? student.moaState.file)}
              >
                <ExternalLink className="mr-2 h-4 w-4" /> View Document
              </Button>

              <div className="space-y-4 text-xs font-sans">

                <div className="space-y-1.5">
                  <Label htmlFor="moaStatusSelect" className="text-xs">Update Status</Label>
                  <select
                    id="moaStatusSelect"
                    value={moaStatus}
                    onChange={(e) => setMoaStatus(e.target.value as MoaStatus)}
                    className="w-full bg-white border border-slate-205 rounded p-2.5 text-xs font-semibold"
                  >
                    {moaStatuses.map(status => <option key={status} value={status}>{status}</option>)}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="moaRemarks" className="text-xs">Audit Remarks / Notes</Label>
                  <Input
                    id="moaRemarks"
                    placeholder="e.g. Legal check completed. Route to corporate signature."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReviewDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] text-white">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
