import { DocumentReviewWorkspace, NativeFilePreviewLink } from '../../components/forms/FileViewer';
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
  FileText, 
  AlertTriangle,
  Clock
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

export function PreOJTReview() {
  const { students, reviewPreOJTReq } = useOJT();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReq, setSelectedReq] = useState<{ studentId: string; studentName: string; reqName: string; fileName: string; status: string; remarks: string } | null>(null);
  const [remarks, setRemarks] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // Flatten submitted Pre-OJT requirements across students
  const submittedReqs = students.flatMap(s => 
    s.preOJTRequirements
      .filter(r => r.status === 'Submitted' || r.status === 'Under Review' || r.status === 'Needs Revision')
      .map(r => ({
        studentId: s.studentId,
        studentName: s.name,
        studentNumber: s.studentNumber,
        section: s.section,
        reqName: r.name,
        fileName: r.fileName || '',
        status: r.status,
        remarks: r.remarks
      }))
  );

  const filteredReqs = submittedReqs.filter(r => 
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.reqName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleReviewAction = (status: 'Approved' | 'Needs Revision' | 'Rejected') => {
    if (!selectedReq || !(students.find(s => s.studentId === selectedReq?.studentId)?.preOJTRequirements.find(r => r.name === selectedReq?.reqName)?.file?.url || ['Practicum kit (expanded envelope)', 'Attendance OJT Orientation'].includes(selectedReq?.reqName || ''))) return;

    reviewPreOJTReq(selectedReq.studentId, selectedReq.reqName, status, remarks);
    toast.success(`Pre-OJT requirement ${selectedReq.reqName} is now marked ${status}`);
    
    setReviewDialogOpen(false);
    setSelectedReq(null);
    setRemarks('');
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Pre-OJT Document Review</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-light">Verify student intakes, resume checklists, and endorsement letters before giving deployment clearances.</p>
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
          <CardTitle className="text-base font-bold text-slate-800">Pending Clearances Queue</CardTitle>
          <CardDescription>Verify registration copies, consent slips, anti-sexual harassment certificates, and medical clearances.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {filteredReqs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">
              All Pre-OJT document checks completed. No items pending.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50/50">
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Student Intern</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Requirement Description</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Submitted Document</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase font-sans">State</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center w-28">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReqs.map((r, i) => (
                  <TableRow key={i} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 text-xs block">{r.studentName}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{r.studentNumber} | {r.section}</span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 font-semibold text-xs text-slate-805">
                      {r.reqName}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <NativeFilePreviewLink file={students.find(s => s.studentId === r.studentId)?.preOJTRequirements.find(req => req.name === r.reqName)?.file}>
                          {r.fileName}
                        </NativeFilePreviewLink>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      {r.status === 'Needs Revision' ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200">Revision Requested</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200">Under Review</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-center">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedReq(r);
                          setRemarks(r.remarks || '');
                          setReviewDialogOpen(true);
                        }}
                        className="bg-[#800000] hover:bg-[#6b0000] text-white text-[10px] h-7 font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        Audit file
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Review Dialog */}
      {selectedReq && (
        <Dialog open={reviewDialogOpen} onOpenChange={() => setReviewDialogOpen(false)}>
          <DialogContent className="w-[calc(100%-2rem)] sm:max-w-[min(96vw,1400px)] max-h-[92vh] overflow-y-auto font-sans">
            <DialogHeader>
              <DialogTitle>Audit Pre-OJT Intake File</DialogTitle>
              <DialogDescription>
                Auditing <span className="font-semibold text-slate-800">{selectedReq.reqName}</span> submitted by {selectedReq.studentName}.
              </DialogDescription>
            </DialogHeader>
<DocumentReviewWorkspace file={students.find(s => s.studentId === selectedReq.studentId)?.preOJTRequirements.find(r => r.name === selectedReq.reqName)?.file}>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <NativeFilePreviewLink file={students.find(s => s.studentId === selectedReq.studentId)?.preOJTRequirements.find(r => r.name === selectedReq.reqName)?.file}>
                      {selectedReq.fileName}
                    </NativeFilePreviewLink>
                    <p className="text-[10px] text-slate-400 font-medium">Submission record</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="preReqRemarks" className="text-xs">Add Audit Remarks</Label>
                <Input
                  id="preReqRemarks"
                  placeholder="e.g. Signature verified, document is cleared."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="secondary"
                disabled={!(students.find(s => s.studentId === selectedReq?.studentId)?.preOJTRequirements.find(r => r.name === selectedReq?.reqName)?.file?.url || ['Practicum kit (expanded envelope)', 'Attendance OJT Orientation'].includes(selectedReq?.reqName || ''))} onClick={() => handleReviewAction('Needs Revision')}
                className="text-xs cursor-pointer"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Request Revision
              </Button>
              <Button
                disabled={!(students.find(s => s.studentId === selectedReq?.studentId)?.preOJTRequirements.find(r => r.name === selectedReq?.reqName)?.file?.url || ['Practicum kit (expanded envelope)', 'Attendance OJT Orientation'].includes(selectedReq?.reqName || ''))} onClick={() => handleReviewAction('Approved')}
                className="bg-green-600 hover:bg-green-700 text-white text-xs font-bold cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Approve clearance
              </Button>
            </DialogFooter>
          </DocumentReviewWorkspace>
</DialogContent>
        </Dialog>
      )}
    </div>
  );
}
