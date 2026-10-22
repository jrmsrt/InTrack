import { portfolioTemplateTitle } from '../../domain/portfolioContents';
import { NativeFilePreviewLink } from '../../components/forms/FileViewer';
import { readUploadedDocument } from '../../lib/uploadedDocument';
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOJT } from '../../context/OJTContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  FileText,
  Lock,
  FileCheck,
  CalendarCheck,
  Inbox,
  Camera
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';

export function DuringOJT() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { students, uploadDuringOJTReq, isBackendConnected, uploadRequirementFile, submitPhysicalRequirement } = useOJT();
  
  const [isUploading, setIsUploading] = useState(false);
  const uploadingRef = useRef(false);
  const [selectedReq, setSelectedReq] = useState<string | null>(null);
  const [formattedFileName, setFormattedFileName] = useState('');
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Drag and drop states
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep track of actual uploaded file references & object URLs for dynamic preview
  

  // File Preview state
  

  const student = students.find(s => s.studentId === user?.id || s.email === user?.email);

  if (!student) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-red-600 font-sans">Error</h2>
        <p className="text-slate-600 mt-2">Student record not found.</p>
      </div>
    );
  }

  const dtrPeriods = Array.from(new Set(student.dtrHistory.map(dtr => dtr.month)));
  const approvedDtrs = student.dtrHistory.filter(dtr => dtr.status === 'Approved').length;
  const pendingDtrs = student.dtrHistory.filter(dtr => dtr.status === 'Submitted' || dtr.status === 'Under Review').length;

  const isCleared = student.stage !== 'Stage 1: Pre-OJT';

  if (!isCleared) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px] text-center gap-3 bg-white rounded-xl border border-slate-200 shadow-sm font-sans">
        <div className="bg-red-50 text-[#800000] h-12 w-12 rounded-full flex items-center justify-center">
          <Lock className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-800">During-OJT Checklist is Locked</h2>
        <p className="text-slate-500 text-xs max-w-md leading-relaxed">
          “Complete and wait for approval of your Pre-OJT requirements before accessing During-OJT features.”
        </p>
      </div>
    );
  }

  // Helper check for non-document items
  const isNonDocumentReq = (name: string) => {
    return false;
  };

  // Translate A->1, B->2, etc.
  const sectionLetterToNumber = (sec: string) => {
    const char = sec.trim().toUpperCase();
    if (char.length === 1) {
      const code = char.charCodeAt(0) - 64; // A=1, B=2, C=3, etc.
      if (code >= 1 && code <= 26) return String(code);
    }
    return char;
  };

  // Extract Year-Section (e.g., 4-1 from BSIT 4A)
  const getYearSection = (section: string) => {
    if (!section) return 'Year-Section';
    const match = section.match(/(\d)\s*-?\s*([A-Z0-9]+)$/i);
    if (match) {
      const year = match[1];
      const secPart = match[2];
      if (/^[A-Z]$/i.test(secPart)) {
        return `${year}-${sectionLetterToNumber(secPart)}`;
      }
      return `${year}-${secPart}`;
    }
    return section.replace(/\s+/g, '-');
  };

  // Map requirement name to file suffix
  const getFileNamePart = (reqName: string) => {
    if (reqName.startsWith('Weekly Journal (Week')) {
      const weekNum = reqName.match(/\d+/)?.[0] || '1';
      return `WeeklyJournal_Week${weekNum}`;
    }
    if (reqName.startsWith('Pictures / Documentation (Week')) {
      const weekNum = reqName.match(/\d+/)?.[0] || '1';
      return `PicturesDocs_Week${weekNum}`;
    }
    switch (reqName) {
      case 'Daily Time Record':
        return 'DTR';
      case 'Self-Reflection':
        return 'SelfReflection';
      default:
        return reqName.replace(/[^a-zA-Z0-9]/g, '');
    }
  };

  // Format uploaded file name helper
  const formatUploadedFileName = (
    studentName: string,
    program: string,
    section: string,
    documentName: string,
    originalFileName: string
  ) => {
    const nameParts = studentName.trim().split(/\s+/);
    const lastName = studentName.includes(',') ? studentName.split(',')[0].trim() : nameParts[nameParts.length - 1] || 'Student';

    let course = 'Course';
    if (program) {
      const parts = program.split(/[—–-]/);
      course = parts.length > 0 ? parts[0].trim() : program.trim();
    }

    const yearSection = getYearSection(section);
    const filePart = getFileNamePart(documentName);

    let extension = '.pdf';
    const extMatch = originalFileName.match(/\.[a-zA-Z0-9]+$/);
    if (extMatch) {
      extension = extMatch[0].toLowerCase();
    }

    return `${lastName}_${course}_${yearSection}_${filePart}${extension}`;
  };

  // Dynamic descriptions for each requirement
  const getReqDescription = (name: string) => {
    if (name.startsWith('Weekly Journal (Week')) {
      const weekNum = name.match(/\d+/)?.[0] || '1';
      return `Weekly accomplishment report and learning journal for Week ${weekNum}`;
    }
    if (name.startsWith('Pictures / Documentation (Week')) {
      const weekNum = name.match(/\d+/)?.[0] || '1';
      return `Photo documentation of tasks and workspace during Week ${weekNum}`;
    }
    switch (name) {
      case 'Daily Time Record':
        return 'Consolidated time card showing daily punch-in and punch-out records';
      case 'Self-Reflection':
        return 'Detailed narrative reflection of lessons learned and career insights';
      default:
        return 'Internship deployment milestone report';
    }
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      handleFileSelected(file);
    }
  };

  const handleFileSelected = (file: File) => {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      toast.error("Invalid file format", {
        description: "Only PDF documents are allowed for During-OJT uploads."
      });
      return;
    }
    setSelectedFile(file);
    if (selectedReq) {
      const formatted = formatUploadedFileName(
        student.name,
        student.program,
        student.section,
        selectedReq,
        file.name
      );
      setFormattedFileName(formatted);
    }
  };

  const resetUploadState = () => {
    setSelectedFile(null);
    setFormattedFileName('');
    setDragActive(false);
    setSelectedReq(null);
    setUploadDialogOpen(false);
  };

  // Submit handlers
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedReq || !selectedFile || !formattedFileName.trim()) return;

    if (uploadingRef.current) return;
    uploadingRef.current = true; setIsUploading(true);
    try {
      if (isBackendConnected) {
        if (!uploadRequirementFile) throw new Error('Upload service unavailable. Please refresh.');
        await uploadRequirementFile('during', selectedReq, new File([selectedFile], formattedFileName, {type:selectedFile.type || 'application/pdf'}));
      } else {
        const uploadedDocument = await readUploadedDocument(selectedFile, formattedFileName);
        await uploadDuringOJTReq(student.studentId, selectedReq, formattedFileName, uploadedDocument);
      }
      toast.success(`Successfully uploaded document: ${formattedFileName}`, {
        description: 'Your submission is saved and awaiting review.'
      });
      resetUploadState();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed. Please retry with the same file.');
    } finally { uploadingRef.current = false; setIsUploading(false); }
  };

  const openUploadModal = (reqName: string) => {
    setSelectedReq(reqName);
    setUploadDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Approved/Received</Badge>;
      case 'Rejected':
        return <Badge className="bg-red-100 text-red-800 hover:bg-red-100 border-red-200 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Rejected</Badge>;
      case 'Needs Revision':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Needs Revision</Badge>;
      case 'Submitted':
      case 'Under Review':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 flex items-center gap-1"><Clock className="h-3 w-3" /> Under Review</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-100 border-slate-200">Not Submitted</Badge>;
    }
  };

  // Preview renderer for the documents modal
  

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">During-OJT Requirements</h1>
          <p className="text-slate-500 text-sm mt-0.5">Submit all weekly documentation and milestone reports generated during your company deployment.</p>
        </div>
      </div>

      <Card className="requirement-checklist gap-0 shadow-sm border-slate-200 -mt-3.5">
        <CardHeader className="!pt-5 !pb-4 border-b border-slate-100">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-base font-bold text-slate-800">Deployment Deliverables</CardTitle>
              <CardDescription>File checklist for weekly reporting, time logs, and narrative self-reflections.</CardDescription>
            </div>
            <Badge className="bg-green-50 text-green-700 border-green-105 font-semibold flex items-center gap-1">
              Active Stage: During-OJT
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="intrack-table w-full min-w-[760px] table-fixed text-left text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold text-xs uppercase tracking-wider">
                <th className="py-4 pl-12 pr-6 font-semibold">Requirement Description</th>
                <th className="py-4 px-6 font-semibold">Verification/Upload</th>
                <th className="py-4 px-6 font-semibold w-32">Status</th>
                <th className="py-4 px-6 font-semibold">Remarks & Notes</th>
              </tr>
            </thead>
            <tbody>
              {student.duringOJTRequirements.map((req, idx) => (
                <tr 
                  key={idx}
                  className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  <td className="py-5.5 pl-12 pr-6">
                    <span className="font-semibold text-slate-800 block">
                      {idx + 1}. {req.name}
                    </span>
                    <span className="requirement-description whitespace-pre-line text-[10px] text-slate-400 font-medium">{req.description || getReqDescription(req.name)}</span>
                  </td>
                  <td className="py-5.5 px-6">
                    {req.name === 'Daily Time Record' ? (
                      <div className="flex flex-wrap items-center gap-2"><div className="text-xs text-slate-600"><span className="font-bold text-slate-800">{approvedDtrs} approved</span> · {pendingDtrs} pending review · {dtrPeriods.length} generated period{dtrPeriods.length === 1 ? '' : 's'}</div><Button variant="outline" size="sm" className="h-8 cursor-pointer border-slate-200 text-xs hover:bg-slate-100" onClick={() => navigate('/attendance')}><FileText className="h-3.5 w-3.5" />View DTR</Button></div>
                    ) : req.file?.url ? (
                      <div className="flex items-center gap-2">
                        <NativeFilePreviewLink file={req.file}>{req.fileName || req.file.name}</NativeFilePreviewLink>
                        {req.status !== 'Approved' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 text-xs text-[#800000] hover:text-white hover:bg-[#800000] font-bold ml-1 cursor-pointer transition-colors px-2 rounded"
                            onClick={() => openUploadModal(req.name)}
                          >
                            Re-upload
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="h-8 border-slate-200 text-slate-600 hover:text-white hover:bg-[#800000] hover:border-[#800000] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
                        onClick={() => openUploadModal(req.name)}
                      >
                        <Upload className="h-3.5 w-3.5" />
                        Upload File
                      </Button>
                    )}
                  </td>
                  <td className="py-5.5 px-6 font-semibold">
                    {req.name === 'Daily Time Record' ? <Badge className={approvedDtrs > 0 ? 'bg-green-100 text-green-800' : pendingDtrs > 0 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600'}>{approvedDtrs > 0 ? 'DTR progress' : pendingDtrs > 0 ? 'Pending review' : 'No DTR submitted'}</Badge> : getStatusBadge(req.status)}
                  </td>
                  <td className="py-5.5 px-6 text-xs text-slate-500 max-w-xs leading-relaxed font-light">
                    {req.name === 'Daily Time Record' ? 'Generate and submit each reporting period from Attendance & DTR. No file upload is required here.' : req.remarks ? req.remarks : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* SINGLE DIALOG FOR FILE UPLOAD */}
      <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
        if (!open && !uploadingRef.current) resetUploadState();
      }}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleUploadSubmit}>
            <DialogHeader>
              <DialogTitle className="text-slate-900 font-sans font-bold">
                {selectedReq && student.duringOJTRequirements.find(r => r.name === selectedReq)?.file?.url
                  ? 'Re-upload Document' 
                  : 'Upload OJT Document'}
              </DialogTitle>
              <DialogDescription className="text-slate-500 font-light text-xs">
                Upload file validation copy for <span className="font-semibold text-slate-800">{selectedReq}</span>
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {/* DRAG AND DROP ZONE */}
              <div data-interactive="true" 
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  dragActive 
                    ? "border-[#800000] bg-red-50/30" 
                    : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
                }`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept=".pdf"
                />
                
                <div className="flex flex-col items-center gap-2">
                  <Upload className={`h-8 w-8 transition-colors ${dragActive ? "text-[#800000]" : "text-slate-400"}`} />
                  <p className="text-xs font-semibold text-slate-700">
                    Drag & drop your PDF file here, or <span className="text-[#800000] hover:underline font-bold">browse</span>
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Supports PDF only (Max 10MB)
                  </p>
                </div>
              </div>

              {/* DYNAMIC FILE SELECTION DISPLAY & NAME FORMAT PREVIEW */}
              {selectedFile && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-slate-700 font-medium">
                      <FileCheck className="h-4 w-4 text-[#800000]" />
                      <span className="truncate max-w-[200px]" title={selectedFile.name}>{selectedFile.name}</span>
                    </div>
                    <span className="text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
                  </div>
                  
                  <div className="pt-2 border-t border-slate-200">
                    <Label className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Auto-Formatted Filename</Label>
                    <div className="mt-1 p-2 bg-[#800000]/5 text-[#800000] font-mono text-[10px] rounded border border-[#800000]/10 truncate" title={formattedFileName}>
                      {formattedFileName}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={resetUploadState} disabled={isUploading} className="text-xs hover:bg-slate-100 hover:text-slate-900 border-slate-200 cursor-pointer transition-colors">
                Cancel
              </Button>
              <Button 
                type="submit" 
                className="bg-[#800000] hover:bg-[#6b0000] text-white text-xs font-semibold cursor-pointer transition-colors shadow-sm"
                disabled={isUploading || !selectedFile || !formattedFileName.trim()}
              >
                Upload File
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DYNAMIC DOCUMENT PREVIEW DIALOG */}
      
    </div>
  );
}
