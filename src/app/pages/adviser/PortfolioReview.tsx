import React, { useState } from 'react';
import { openNativeDocument } from '../../components/forms/requirementFiles';
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
  AlertTriangle,
  Clock,
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

export function PortfolioReview() {
  const { students, reviewPortfolio } = useOJT();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedAttachmentIndex, setSelectedAttachmentIndex] = useState(0);

  const submittedStudents = students.filter(s => s.portfolioSubmitted);

  const filteredStudents = submittedStudents.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const student = students.find(s => s.studentId === selectedStudentId);
  const portfolioFiles = student
    ? [...student.preOJTRequirements, ...student.duringOJTRequirements, ...student.postOJTRequirements, student.moaState].flatMap(item => item.file ? [item.file] : [])
    : [];

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

  const handleReviewAction = async (status: 'Approved' | 'Needs Revision') => {
    if (!selectedStudentId) return;

    try {
    await reviewPortfolio(selectedStudentId, status, remarks);
    toast.success(`Portfolio submission is now ${status === 'Approved' ? 'Approved' : 'Returned'}`);
    
    setReviewDialogOpen(false);
    setSelectedStudentId(null);
    setRemarks('');
    } catch(error) { toast.error(error instanceof Error?error.message:'Review was not saved.'); }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Portfolio Review Module</h1>
          <p className="text-slate-500 text-sm mt-0.5">Audit compiled internship portfolios containing full accomplishments, assessments, and time logs.</p>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="search"
            placeholder="Search by intern name..."
            className="pl-10 text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#800000]"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800">Submitted Portfolios Queue</CardTitle>
          <CardDescription>Verify Table of Contents, attachments, evaluations, and clearances compiled in standard templates.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              No compiled portfolios submitted.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Intern details</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Hours Rendered</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Company assigned</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Approval Status</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center w-28">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((s) => (
                  <TableRow key={s.studentId} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 text-xs block">{s.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{s.studentNumber} | {s.section}</span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-bold text-slate-800">
                      {s.totalHoursRendered.toFixed(0)} hrs
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-650">
                      {s.companyName}
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      {s.portfolioApproved ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200">Endorsed</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">Awaiting Audit</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedStudentId(s.studentId);
                          setRemarks(s.portfolioRemarks || '');
                          setSelectedAttachmentIndex(0);
                          setReviewDialogOpen(true);
                        }}
                        className="bg-[#800000] hover:bg-[#6b0000] text-white text-[10px] h-7 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        Audit Portfolio
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Audit Detail Overlay Dialog */}
      {student && (
        <Dialog open={reviewDialogOpen} onOpenChange={() => setReviewDialogOpen(false)}>
          <DialogContent className="sm:max-w-2xl max-h-[92vh] overflow-y-auto font-sans">
            <DialogHeader>
              <DialogTitle>Audit Intern Portfolio Report</DialogTitle>
              <DialogDescription>
                Endorse compilation sheet for <span className="font-bold">{student.name}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <section className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-semibold text-slate-900">Submission details</h3>
                  {student.portfolioApproved ? (
                    <Badge className="bg-green-100 text-green-800 border-green-200">Endorsed</Badge>
                  ) : (
                    <Badge className="bg-blue-100 text-blue-800 border-blue-200">Awaiting Audit</Badge>
                  )}
                </div>
                <p><span className="font-semibold text-slate-800">Student:</span> {student.name} ({student.studentNumber})</p>
                <p><span className="font-semibold text-slate-800">Program and section:</span> {student.program} / {student.section}</p>
                <p><span className="font-semibold text-slate-800">Company:</span> {student.companyName}</p>
                <p><span className="font-semibold text-slate-800">Hours rendered:</span> {student.totalHoursRendered.toFixed(0)} hrs</p>
                <p><span className="font-semibold text-slate-800">Submitted:</span> {formatSubmissionDate(student.portfolioSubmittedAt)}</p>
                <p><span className="font-semibold text-slate-800">Uploaded documents:</span> {portfolioFiles.length}</p>
              </section>

              {student.coordinatorPortfolioStatus && student.coordinatorPortfolioStatus !== 'Pending' && (
                <section className={`space-y-2 rounded-md border p-4 text-sm ${student.coordinatorPortfolioStatus === 'Approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                  <h3 className="font-semibold">Coordinator review: {student.coordinatorPortfolioStatus === 'Approved' ? 'Final Approved' : 'Needs Revision'}</h3>
                  <p>Reviewed: {formatSubmissionDate(student.coordinatorPortfolioReviewedAt)}</p>
                  <p className="whitespace-pre-wrap">{student.coordinatorPortfolioRemarks || 'No coordinator remarks.'}</p>
                </section>
              )}

              {portfolioFiles.length > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="portfolioAttachment" className="text-xs">Document</Label>
                  <select
                    id="portfolioAttachment"
                    value={Math.min(selectedAttachmentIndex, portfolioFiles.length - 1)}
                    onChange={(event) => setSelectedAttachmentIndex(Number(event.target.value))}
                    className="block w-full rounded-md border border-slate-200 bg-white p-2 text-sm"
                  >
                    {portfolioFiles.map((file, index) => <option key={`${file.name}-${index}`} value={index}>{file.name}</option>)}
                  </select>
                </div>
              ) : (
                <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">No uploaded portfolio document is available.</p>
              )}

              <Button
                type="button"
                variant="outline"
                className="w-full"
                disabled={portfolioFiles.length === 0}
                onClick={() => openNativeDocument(portfolioFiles[selectedAttachmentIndex])}
              >
                <ExternalLink className="mr-2 h-4 w-4" /> View Document
              </Button>

              {/* Remarks Field */}
              <div className="space-y-1.5">
                <Label htmlFor="portfolioRemarks" className="text-xs">Endorsement Remarks / Feedback</Label>
                <Input
                  id="portfolioRemarks"
                  placeholder="e.g. Excellent OJT Portfolio compilation. All components verified."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="secondary"
                onClick={() => handleReviewAction('Needs Revision')}
                className="text-xs cursor-pointer"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Request Revision
              </Button>
              <Button
                onClick={() => handleReviewAction('Approved')}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Endorse to Coordinator
              </Button>
            </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
