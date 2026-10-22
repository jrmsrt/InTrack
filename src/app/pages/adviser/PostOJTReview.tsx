import { NativeFilePreviewLink } from '../../components/forms/FileViewer';
import { DocumentReviewWorkspace } from '../../components/forms/FileViewer';
import React, { useState } from 'react';
import { useOJT } from '../../context/OJTContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { RequirementFilePreview, openNativeDocument, resolveRequirementDocument } from '../../components/forms/requirementFiles';
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

interface RequirementReviewFilters {
  embedded?: boolean;
  searchTerm?: string;
  programFilter?: string;
  sectionFilter?: string;
}

function getComparableSection(section: string) {
  const normalizedSection = section.trim().toUpperCase();
  const legacyMatch = normalizedSection.match(/\b([34])([AB])$/);

  if (legacyMatch) {
    return `${legacyMatch[1]}-${legacyMatch[2] === 'A' ? '1' : '2'}`;
  }

  return section.trim();
}

export function PostOJTReview({ embedded = false, searchTerm = '', programFilter = 'all', sectionFilter = 'all' }: RequirementReviewFilters) {
  const { students, reviewPostOJTReq } = useOJT();
  
  const [selectedReq, setSelectedReq] = useState<{ studentId: string; studentName: string; reqName: string; fileName: string; status: string; remarks: string } | null>(null);
  
  const [remarks, setRemarks] = useState('');
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);

  // Flatten submitted Post-OJT requirements across students
  const submittedReqs = students.flatMap(s => 
    s.postOJTRequirements
      .filter(r => r.status === 'Submitted' || r.status === 'Under Review' || r.status === 'Needs Revision' || r.status === 'Approved')
      .map(r => ({
        studentId: s.studentId,
        studentName: s.name,
        studentNumber: s.studentNumber,
        program: s.program,
        section: s.section,
        reqName: r.name,
        fileName: r.fileName || '',
        status: r.status,
        remarks: r.remarks
      }))
  );

  const filteredReqs = submittedReqs.filter(r => 
    r.studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.reqName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.studentNumber.includes(searchTerm)
  ).filter(r =>
    (programFilter === 'all' || r.program.includes(programFilter)) &&
    (sectionFilter === 'all' || getComparableSection(r.section) === sectionFilter)
  );

  const handleReviewAction = (status: 'Approved' | 'Needs Revision') => {
    if (!selectedReq || !(students.find(s => s.studentId === selectedReq?.studentId)?.postOJTRequirements.find(r => r.name === selectedReq?.reqName)?.file?.url)) return;

    reviewPostOJTReq(selectedReq.studentId, selectedReq.reqName, status, remarks);
    toast.success(`Requirement ${selectedReq.reqName} is now ${status === 'Approved' ? 'Approved' : 'Returned'}`);
    
    setReviewDialogOpen(false);
    setSelectedReq(null);
    setRemarks('');
  };

  return (
    <div className="space-y-6 font-sans">
      {!embedded && (
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Post-OJT Requirement Review</h1>
            <p className="text-slate-500 text-sm mt-0.5">Endorse clearances, assessments, and completion certificates after OJT hours end.</p>
          </div>
        </div>
      )}

      <Card className="shadow-sm border-slate-200 rounded-xl overflow-hidden">
        <CardHeader className="border-b border-slate-100 bg-white px-5 py-4">
          <CardTitle className="text-base font-bold text-slate-800">Post-OJT Queue</CardTitle>
          <CardDescription>Verify final self-assessments, company certificates, and recommendations logs.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {filteredReqs.length === 0 ? (
            <div className="p-10 text-center">
              <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
              <p className="font-semibold text-slate-700 text-sm">No Post-OJT files need review</p>
              <p className="text-slate-400 text-xs mt-1">All Post-OJT clearances are cleared.</p>
            </div>
          ) : (
            <Table className="min-w-[960px] table-fixed">
              <TableHeader>
                <TableRow className="bg-slate-50 border-b border-slate-200">
                  <TableHead className="py-3.5 px-5 font-bold text-[11px] text-slate-500 uppercase w-[230px]">Intern</TableHead>
                  <TableHead className="py-3.5 px-5 font-bold text-[11px] text-slate-500 uppercase w-[210px]">Requirement</TableHead>
                  <TableHead className="py-3.5 px-5 font-bold text-[11px] text-slate-500 uppercase w-[240px]">Uploaded File</TableHead>
                  <TableHead className="py-3.5 px-5 font-bold text-[11px] text-slate-500 uppercase w-[150px]">Status</TableHead>
                  <TableHead className="py-3.5 px-5 font-bold text-[11px] text-slate-500 uppercase text-right w-[130px]">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReqs.map((r, i) => (
                  <TableRow key={i} className="hover:bg-red-50/30 transition-colors border-b border-slate-100">
                    <TableCell className="py-4 px-5 align-top whitespace-normal">
                      <span className="font-bold text-slate-800 text-xs block">{r.studentName}</span>
                      <span className="text-[10px] text-slate-400 font-semibold">{r.studentNumber} | {r.section}</span>
                    </TableCell>
                    <TableCell className="py-4 px-5 align-top font-semibold text-xs text-slate-700 whitespace-normal">
                      {r.reqName}
                    </TableCell>
                    <TableCell className="py-4 px-5 align-top text-xs whitespace-normal">
                      <div className="flex items-start gap-2 text-slate-600">
                        <NativeFilePreviewLink file={resolveRequirementDocument(students, { studentName: r.studentName, reqName: r.reqName, fileName: r.fileName, stage: 'Post-OJT' })}>
                          {r.fileName}
                        </NativeFilePreviewLink>
                      </div>
                    </TableCell>
                    <TableCell className="py-4 px-5 align-top">
                      {r.status === 'Needs Revision' ? (
                        <Badge className="bg-amber-100 text-amber-800 border-amber-200 rounded-md">Revision Requested</Badge>
                      ) : r.status === 'Approved' ? (
                        <Badge className="bg-green-100 text-green-800 border-green-200 rounded-md">Approved</Badge>
                      ) : (
                        <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1 w-fit rounded-md"><Clock className="h-3 w-3" /> Under Review</Badge>
                      )}
                    </TableCell>
                    <TableCell className="py-4 px-5 align-top text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedReq(r);
                          setRemarks(r.remarks || '');
                          setReviewDialogOpen(true);
                        }}
                        className="bg-[#800000] hover:bg-[#6b0000] text-white text-[10px] h-8 font-bold cursor-pointer rounded-md px-3"
                      >
                        Verify File
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
              <DialogTitle>Verify Post-OJT Document</DialogTitle>
              <DialogDescription>
                Auditing <span className="font-semibold text-slate-800">{selectedReq.reqName}</span> submitted by {selectedReq.studentName}.
              </DialogDescription>
            </DialogHeader>
<DocumentReviewWorkspace file={students.find(s => s.studentId === selectedReq.studentId)?.postOJTRequirements.find(r => r.name === selectedReq.reqName)?.file}>

            <div className="py-4 space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded border flex items-center gap-2">
                <div>
                  <NativeFilePreviewLink file={resolveRequirementDocument(students, {
                      studentName: selectedReq.studentName,
                      reqName: selectedReq.reqName,
                      fileName: selectedReq.fileName,
                      stage: 'Post-OJT'
                    })}>
                    {selectedReq.fileName}
                  </NativeFilePreviewLink>
                  <p className="text-[10px] text-slate-400 font-medium">Format: Scanned PDF Clearance Certificate</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="reqRemarks" className="text-xs">Add Audit Remarks</Label>
                <Input
                  id="reqRemarks"
                  placeholder="e.g. Scanned copy clear and contains supervisor seal. Approved."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={!(students.find(s => s.studentId === selectedReq?.studentId)?.postOJTRequirements.find(r => r.name === selectedReq?.reqName)?.file?.url)} onClick={() => handleReviewAction('Needs Revision')}
                className="font-semibold cursor-pointer"
              >
                <X className="h-3.5 w-3.5 mr-1" /> Request Revision
              </Button>
              <Button
                size="sm"
                disabled={!(students.find(s => s.studentId === selectedReq?.studentId)?.postOJTRequirements.find(r => r.name === selectedReq?.reqName)?.file?.url)} onClick={() => handleReviewAction('Approved')}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold cursor-pointer"
              >
                <Check className="h-3.5 w-3.5 mr-1" /> Endorse Clearance
              </Button>
            </DialogFooter>
          </DocumentReviewWorkspace>
</DialogContent>
        </Dialog>
      )}

      
    </div>
  );
}
