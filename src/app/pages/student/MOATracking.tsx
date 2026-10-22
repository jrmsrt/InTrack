import { NativeFilePreviewLink } from '../../components/forms/FileViewer';
import {officialOjtCoordinator} from '../../data/institution';
import { readUploadedDocument } from '../../lib/uploadedDocument';
import React, { useState, useRef } from 'react';
import { useOJT } from '../../context/OJTContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { 
  FileText, 
  Download, 
  Upload, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle,
  HelpCircle,
  Calendar,
  ExternalLink,
  FileCheck,
  FileSpreadsheet,
  Search
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog';

interface HTERecord {
  companyName: string;
  address: string;
  supervisorName: string;
  email: string;
  phone: string;
  dateNotarized: string;
}

export function MOATracking() {
  const { user } = useAuth();
  const { students, templates, htePartners, uploadMOA, isBackendConnected, uploadRequirementFile } = useOJT();
  
  const [mockFileName, setMockFileName] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const uploadingRef = useRef(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Drag and drop states
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keep track of actual uploaded file references & object URLs for dynamic preview
  

  // File Preview state
  

  // Excel HTE grid preview states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCell, setSelectedCell] = useState<{ col: string; row: number }>({ col: 'A', row: 3 });
  const [selectedCellText, setSelectedCellText] = useState('TechCorp Inc.');
  const [activeTab, setActiveTab] = useState('Active HTEs');

  const student = students.find(s => s.studentId === user?.id || s.email === user?.email);
  const moaTemplate = templates.find(template => template.status === 'Published' && (template.name.toLowerCase().includes('memorandum') || template.name.toLowerCase().includes('moa')));

  if (!student) {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-slate-650 mt-2 font-semibold">Student record not found.</p>
      </div>
    );
  }

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

  // Format uploaded file name helper
  const formatUploadedFileName = (
    studentName: string,
    program: string,
    section: string,
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

    let extension = '.pdf';
    const extMatch = originalFileName.match(/\.[a-zA-Z0-9]+$/);
    if (extMatch) {
      extension = extMatch[0].toLowerCase();
    }

    return `${lastName}_${course}_${yearSection}_MOA${extension}`;
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
        description: "Only PDF documents are allowed for MOA uploads."
      });
      return;
    }
    setSelectedFile(file);
    const formatted = formatUploadedFileName(
      student.name,
      student.program,
      student.section,
      file.name
    );
    setMockFileName(formatted);
  };

  const resetUploadState = () => {
    setSelectedFile(null);
    setMockFileName('');
    setDragActive(false);
    setUploadDialogOpen(false);
  };

  const handleMOAUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockFileName.trim()) return;

    if (!selectedFile) return;
    if (uploadingRef.current) return;
    uploadingRef.current = true; setIsUploading(true);
    try {
      if (isBackendConnected) {
        if (!uploadRequirementFile) throw new Error('Upload service unavailable. Please refresh.');
        await uploadRequirementFile('pre', 'Notarize Memorandum of Agreement (MOA)', new File([selectedFile], mockFileName, {type:selectedFile.type || 'application/pdf'}));
      } else { await uploadMOA(student.studentId, mockFileName, await readUploadedDocument(selectedFile, mockFileName)); }
      toast.success(`Successfully uploaded MOA: ${mockFileName}`, {description:'Saved for coordinator review. MOA routing status is updated by the coordinator.'});
      resetUploadState();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Upload failed. Please retry.'); }
    finally { uploadingRef.current = false; setIsUploading(false); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SAS COPY SUBMITTED':
        return <Badge className="bg-green-100 text-green-800 border-green-200 font-semibold">SAS COPY SUBMITTED</Badge>;
      case 'SIGNED AND NOTARIZED':
        return <Badge className="bg-green-100 text-green-800 border-green-200 font-semibold">SIGNED AND NOTARIZED</Badge>;
      case 'FOR NOTARIZATION':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200 font-semibold">FOR NOTARIZATION</Badge>;
      case 'IN-PROCESS FOR REVISION':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200 font-semibold">IN-PROCESS FOR REVISION</Badge>;
      case 'IN-PROCESS FOR REVIEW OF ULCO':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200 font-semibold">IN-PROCESS FOR REVIEW OF ULCO</Badge>;
      case 'FOR COMPANY REVIEW':
        return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200 font-semibold">FOR COMPANY REVIEW</Badge>;
      case 'NO MOA':
      default:
        return <Badge className="bg-slate-100 text-slate-500 border-slate-200 font-semibold">NO MOA</Badge>;
    }
  };

  const steps = [
    { label: 'NO MOA', desc: 'Prepare and review company partnership status.' },
    { label: 'FOR COMPANY REVIEW', desc: 'Send draft copy to HTE management.' },
    { label: 'IN-PROCESS FOR REVIEW OF ULCO', desc: 'University Legal Counsel checking.' },
    { label: 'FOR NOTARIZATION', desc: 'Signatures and notary public stamping.' },
    { label: 'SIGNED AND NOTARIZED', desc: 'Coordinator confirms the signed and notarized agreement.' },
    { label: 'SAS COPY SUBMITTED', desc: 'Coordinator confirms the signed and notarized MOA copy was submitted to SAS.' }
  ];

  const tabs = ['Active HTEs', 'Pending Partnerships', 'Archived Agreements'];

  const getHteData = () => {
    switch (activeTab) {
      case 'Pending Partnerships':
        return htePartners.filter(partner => partner.status === 'Pending');
      case 'Archived Agreements':
        return htePartners.filter(partner => partner.status === 'Archived');
      case 'Active HTEs':
      default:
        return htePartners.filter(partner => partner.status === 'Active');
    }
  };

  const filteredHteData = getHteData().filter(row => 
    row.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.supervisorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    row.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleCellClick = (col: string, row: number, value: string) => {
    setSelectedCell({ col, row });
    setSelectedCellText(value);
  };

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    const data = tab === 'Active HTEs'
      ? htePartners.filter(partner => partner.status === 'Active')
      : tab === 'Pending Partnerships'
        ? htePartners.filter(partner => partner.status === 'Pending')
        : htePartners.filter(partner => partner.status === 'Archived');
    if (data.length > 0) {
      setSelectedCell({ col: 'A', row: 3 });
      setSelectedCellText(data[0].companyName);
    } else {
      setSelectedCell({ col: 'A', row: 3 });
      setSelectedCellText('');
    }
  };

  const isCellSelected = (col: string, row: number) => {
    return selectedCell.col === col && selectedCell.row === row;
  };

  

  return (
    <div className="space-y-6 font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">MOA Tracking Module</h1>
        <p className="text-slate-500 text-sm mt-0.5 font-normal">Track the official review, endorsement, and approval of your company's Memorandum of Agreement.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Info & Template Downloads */}
        <div className="space-y-6 lg:col-span-2">
          {/* Guide Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-800">MOA Processing Guide</CardTitle>
              <CardDescription className="text-slate-500 text-xs font-normal">Follow these official steps to process company agreements correctly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="font-bold text-slate-800">1. Prepare Agreement</p>
                  <p className="text-slate-500 mt-1 font-normal leading-relaxed">
                    Download the template, fill out company coordinates, name, and address. Do not edit standard legal clauses.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="font-bold text-slate-800">2. Review & Route</p>
                  <p className="text-slate-500 mt-1 font-normal leading-relaxed">
                    Upload the filled draft here. The OJT Coordinator, {officialOjtCoordinator.name}, will review it. If legal revisions are requested, amend the draft.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="font-bold text-slate-800">3. Corporate Signatures</p>
                  <p className="text-slate-500 mt-1 font-normal leading-relaxed">
                    Once routed "For Signature", get corporate manager signature and company seal. Standardized stamp required.
                  </p>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg">
                  <p className="font-bold text-slate-800">4. Upload Final</p>
                  <p className="text-slate-500 mt-1 font-normal leading-relaxed">
                    Upload the signed scanned copy. Coordinator will verify and approve, locking the deployment clearance.
                  </p>
                </div>
              </div>

              {/* Template Download Area */}
              <div className="bg-[#800000]/5 border border-red-100 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex gap-3 items-center">
                  <div className="h-10 w-10 bg-red-100 text-[#800000] rounded-lg flex items-center justify-center">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-900">Memorandum of Agreement Template</p>
                    <p className="text-xs text-slate-550 font-normal">
                      {moaTemplate ? `Latest update: ${moaTemplate.lastUpdated}` : 'Ask the coordinator to publish the MOA template link.'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {moaTemplate && (
                    <a 
                      href={moaTemplate.linkUrl}
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-[#800000] hover:underline font-bold flex items-center gap-1 self-center"
                    >
                      See Template <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <Button 
                    asChild
                    disabled={!moaTemplate}
                    className="bg-[#800000] hover:bg-[#6b0000] text-white text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                  >
                    <a 
                      href={moaTemplate?.linkUrl || '#'} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4" /> Download Template
                    </a>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline Card */}
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-800">Processing Timeline & History</CardTitle>
              <CardDescription className="text-slate-500 text-xs font-normal">Trace the log path of your agreement routing.</CardDescription>
            </CardHeader>
            <CardContent>
              {student.moaState.timeline.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-sm font-semibold">
                  No submissions recorded yet. Upload a draft copy to start tracking.
                </div>
              ) : (
                <div className="relative border-l-2 border-slate-200 ml-3 pl-6 space-y-6">
                  {student.moaState.timeline.map((log, index) => {
                    const isLast = index === student.moaState.timeline.length - 1;
                    return (
                      <div key={index} className="relative">
                        {/* Bullet */}
                        <div className={`absolute -left-[31px] top-1.5 h-4 w-4 rounded-full border-2 border-white flex items-center justify-center ${isLast ? 'bg-[#800000] ring-4 ring-red-100' : 'bg-slate-300'}`} />
                        <div className="text-xs flex justify-between items-center">
                          <span className={`font-bold ${isLast ? 'text-[#800000] text-sm' : 'text-slate-800'}`}>
                            {log.status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-bold flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {log.date}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1 font-normal leading-relaxed">
                          {log.remarks}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Current status block & upload */}
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-bold text-slate-800">Agreement Status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Current State:</span>
                {getStatusBadge(student.moaState.status)}
              </div>

              {student.moaState.pendingUpload && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="mb-2">New upload awaiting coordinator review. Current status remains the previous coordinator decision.</p>
                  <NativeFilePreviewLink file={student.moaState.pendingUpload.file}>{student.moaState.pendingUpload.fileName}</NativeFilePreviewLink>
                </div>
              )}
              {student.moaState.fileName && (
                <div className="p-3 bg-red-50/20 border border-red-100/50 rounded-lg flex items-center gap-2 text-xs">
                  <NativeFilePreviewLink file={student.moaState.file}>{student.moaState.fileName}</NativeFilePreviewLink>
                </div>
              )}

              {/* Upload actions */}
              <div className="pt-2">
                <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
                  if (!open && !uploadingRef.current) resetUploadState();
                }}>
                  <Button 
                    onClick={() => setUploadDialogOpen(true)}
                    className="w-full bg-[#800000] hover:bg-[#6b0000] text-white font-bold py-2.5 flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Upload className="h-4 w-4" /> 
                    {student.moaState.fileName ? 'Upload Revised Copy' : 'Upload Agreement Draft'}
                  </Button>
                  <DialogContent className="sm:max-w-md">
                    <form onSubmit={handleMOAUploadSubmit}>
                      <DialogHeader>
                        <DialogTitle className="text-slate-900 font-sans font-bold">
                          {student.moaState.fileName ? 'Re-upload MOA Copy' : 'Upload MOA Copy'}
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 font-normal text-xs">
                          Upload PDF draft or signed scanned copies for OJT Coordinator checking.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="py-4 space-y-4 font-sans">
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
                              <Label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Auto-Formatted Filename</Label>
                              <div className="mt-1 p-2 bg-[#800000]/5 text-[#800000] font-mono text-[10px] rounded border border-[#800000]/10 truncate" title={mockFileName}>
                                {mockFileName}
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
                          disabled={isUploading || !selectedFile || !mockFileName.trim()}
                        >
                          Upload File
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {/* Coordinator Remarks */}
              {student.moaState.remarks && (
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-sans">Coordinator Feedback</p>
                  <p className="text-xs text-amber-700 font-semibold mt-1 leading-relaxed bg-amber-50/50 p-2.5 rounded border border-amber-100 flex items-start gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    "{student.moaState.remarks}"
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Active HTE spreadsheet list */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2 font-sans">
                <FileSpreadsheet className="h-5 w-5 text-green-700" />
                Active MOA HTE Partners List
              </CardTitle>
              <CardDescription className="text-slate-500 text-xs font-normal">
                Official list of Host Training Establishments (HTE) with signed and active Memorandum of Agreement (MOA).
              </CardDescription>
            </div>
            <Button
              onClick={() => {
                toast.success("Downloading Active_HTE_Partners_List.xlsx", {
                  description: "Your spreadsheet download will begin shortly."
                });
              }}
              variant="outline"
              size="sm"
              className="border-green-600 text-green-700 hover:bg-green-50 hover:text-green-800 hover:border-green-700 text-xs font-bold flex items-center gap-1.5 self-start sm:self-auto cursor-pointer transition-colors"
            >
              <Download className="h-4 w-4" /> Download Excel (.xlsx)
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* SEARCH BAR & CELL ADDRESS BAR */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
            <div className="flex items-center gap-2 flex-grow max-w-md">
              <div className="relative w-full">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Search by Company Name, Address, or Supervisor..."
                  className="pl-8 text-xs h-8 border-slate-200 focus-visible:ring-green-600 bg-white"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>

            {/* Excel Formula & Cell Indicator Area */}
            <div className="flex items-center gap-2 border border-slate-200 bg-slate-50 rounded px-2 py-1 text-xs font-mono h-8">
              <div className="bg-white border border-slate-350 rounded px-1.5 py-0.5 text-center min-w-[36px] font-bold text-slate-600">
                {selectedCell.col && selectedCell.row ? `${selectedCell.col}${selectedCell.row}` : 'A1'}
              </div>
              <span className="text-slate-400 font-sans italic font-bold">fx</span>
              <div className="bg-white border border-slate-355 rounded px-2 py-0.5 min-w-[150px] sm:min-w-[200px] truncate max-w-[300px] text-slate-800">
                {selectedCellText || 'Select a cell to view content...'}
              </div>
            </div>
          </div>

          {/* SPREADSHEET VIEWER CONTAINER */}
          <div className="border border-slate-300 rounded-lg overflow-hidden shadow-inner bg-[#f3f2f1] p-1.5">
            {/* Excel Header Bar */}
            <div className="flex items-center justify-between bg-[#107c41] text-white px-3 py-1.5 text-xs font-sans rounded-t">
              <div className="flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4" />
                <span className="font-bold">Active_HTE_Partners_List.xlsx</span>
              </div>
              <div className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded">
                Student Read-Only Preview
              </div>
            </div>

            {/* Table Area */}
            <div className="overflow-x-auto max-h-[350px]">
              <table className="intrack-table w-full text-[11px] border-collapse bg-white font-mono min-w-[900px]">
                <thead>
                  {/* Alphabetical Column Indicators */}
                  <tr className="bg-[#f3f2f1] border-b border-slate-300 text-slate-500 text-center font-bold">
                    <th className="w-8 border border-slate-300 font-sans text-[9px] bg-[#f3f2f1]"></th>
                    {['A', 'B', 'C', 'D', 'E', 'F'].map(col => (
                      <th key={col} className="border border-slate-300 font-sans py-0.5 text-[9px] bg-[#f3f2f1]">
                        {col}
                      </th>
                    ))}
                  </tr>

                  {/* Header Row 1 */}
                  <tr className="bg-[#f3f2f1] text-slate-700 font-bold border-b border-slate-300 text-center">
                    <td className="text-center font-sans font-bold text-slate-400 border border-slate-300 bg-[#f3f2f1] w-8">1</td>
                    <td data-interactive="true" 
                      onClick={() => handleCellClick('A', 1, 'Company Name')}
                      className={`border border-slate-300 p-2 cursor-pointer hover:bg-green-50/50 align-middle ${isCellSelected('A', 1) ? 'ring-2 ring-green-600 bg-green-50/30 font-bold' : ''}`}
                      rowSpan={2}
                    >
                      Company Name
                    </td>
                    <td data-interactive="true" 
                      onClick={() => handleCellClick('B', 1, 'Complete Company Address')}
                      className={`border border-slate-300 p-2 cursor-pointer hover:bg-green-50/50 align-middle ${isCellSelected('B', 1) ? 'ring-2 ring-green-600 bg-green-50/30 font-bold' : ''}`}
                      rowSpan={2}
                    >
                      Complete Company Address
                    </td>
                    <td data-interactive="true" 
                      onClick={() => handleCellClick('C', 1, "Supervisor/Trainer's Name")}
                      className={`border border-slate-300 p-2 cursor-pointer hover:bg-green-50/50 align-middle ${isCellSelected('C', 1) ? 'ring-2 ring-green-600 bg-green-50/30 font-bold' : ''}`}
                      rowSpan={2}
                    >
                      Supervisor/Trainer's Name
                    </td>
                    <td data-interactive="true" 
                      onClick={() => handleCellClick('D', 1, 'Contact Details')}
                      className={`border border-slate-300 p-2 cursor-pointer hover:bg-green-50/50 align-middle ${isCellSelected('D', 1) ? 'ring-2 ring-green-600 bg-green-50/30 font-bold' : ''}`}
                      colSpan={2}
                    >
                      Contact Details
                    </td>
                    <td data-interactive="true" 
                      onClick={() => handleCellClick('F', 1, 'Date Notarized')}
                      className={`border border-slate-300 p-2 cursor-pointer hover:bg-green-50/50 align-middle ${isCellSelected('F', 1) ? 'ring-2 ring-green-600 bg-green-50/30 font-bold' : ''}`}
                      rowSpan={2}
                    >
                      Date Notarized
                    </td>
                  </tr>

                  {/* Header Row 2 */}
                  <tr className="bg-[#f3f2f1] text-slate-700 font-bold border-b border-slate-300 text-center">
                    <td className="text-center font-sans font-bold text-slate-400 border border-slate-300 bg-[#f3f2f1] w-8">2</td>
                    <td data-interactive="true" 
                      onClick={() => handleCellClick('D', 2, 'Email Address')}
                      className={`border border-slate-300 p-2 cursor-pointer hover:bg-green-50/50 ${isCellSelected('D', 2) ? 'ring-2 ring-green-600 bg-green-50/30 font-bold' : ''}`}
                    >
                      Email Address
                    </td>
                    <td data-interactive="true" 
                      onClick={() => handleCellClick('E', 2, 'Contact Number')}
                      className={`border border-slate-300 p-2 cursor-pointer hover:bg-green-50/50 ${isCellSelected('E', 2) ? 'ring-2 ring-green-600 bg-green-50/30 font-bold' : ''}`}
                    >
                      Contact Number
                    </td>
                  </tr>
                </thead>
                <tbody>
                  {filteredHteData.length === 0 ? (
                    <tr>
                      <td className="text-center font-sans font-bold text-slate-400 border border-slate-300 bg-[#f3f2f1] w-8">3</td>
                      <td colSpan={6} className="text-center p-8 text-slate-400 italic bg-slate-50 font-sans">
                        No records found matching "{searchQuery}" in sheet tab "{activeTab}".
                      </td>
                    </tr>
                  ) : (
                    filteredHteData.map((row, idx) => {
                      const excelRowNumber = idx + 3; // Data rows start at row index 3
                      return (
                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                          {/* Left Index Column */}
                          <td className="text-center font-sans font-bold text-slate-450 border border-slate-300 bg-[#f3f2f1] w-8">
                            {excelRowNumber}
                          </td>
                          
                          {/* Cells */}
                          <td data-interactive="true" 
                            onClick={() => handleCellClick('A', excelRowNumber, row.companyName)}
                            className={`border border-slate-200 p-2 cursor-pointer font-sans font-semibold text-slate-805 ${isCellSelected('A', excelRowNumber) ? 'ring-2 ring-green-600 bg-green-50/55' : ''}`}
                          >
                            {row.companyName}
                          </td>
                          <td data-interactive="true" 
                            onClick={() => handleCellClick('B', excelRowNumber, row.address)}
                            className={`border border-slate-200 p-2 cursor-pointer font-sans text-slate-650 ${isCellSelected('B', excelRowNumber) ? 'ring-2 ring-green-600 bg-green-50/55' : ''}`}
                          >
                            {row.address}
                          </td>
                          <td data-interactive="true" 
                            onClick={() => handleCellClick('C', excelRowNumber, row.supervisorName)}
                            className={`border border-slate-200 p-2 cursor-pointer font-sans text-slate-700 ${isCellSelected('C', excelRowNumber) ? 'ring-2 ring-green-600 bg-green-50/55' : ''}`}
                          >
                            {row.supervisorName}
                          </td>
                          <td data-interactive="true" 
                            onClick={() => handleCellClick('D', excelRowNumber, row.email)}
                            className={`border border-slate-200 p-2 cursor-pointer text-blue-600 underline font-sans ${isCellSelected('D', excelRowNumber) ? 'ring-2 ring-green-600 bg-green-50/55' : ''}`}
                          >
                            {row.email}
                          </td>
                          <td data-interactive="true" 
                            onClick={() => handleCellClick('E', excelRowNumber, row.phone)}
                            className={`border border-slate-200 p-2 cursor-pointer text-slate-700 font-sans ${isCellSelected('E', excelRowNumber) ? 'ring-2 ring-green-600 bg-green-50/55' : ''}`}
                          >
                            {row.phone}
                          </td>
                          <td data-interactive="true" 
                            onClick={() => handleCellClick('F', excelRowNumber, row.dateNotarized)}
                            className={`border border-slate-200 p-2 cursor-pointer text-slate-600 font-sans text-center ${isCellSelected('F', excelRowNumber) ? 'ring-2 ring-green-600 bg-green-50/55' : ''}`}
                          >
                            {row.dateNotarized}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Bottom Tabs mimicking Excel sheets */}
            <div className="bg-[#f3f2f1] flex items-center border-t border-slate-300 text-xs px-2 py-1 gap-1 select-none font-sans rounded-b">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => handleTabClick(tab)}
                  className={`px-3 py-1 border border-t-0 rounded-b font-semibold transition-all cursor-pointer text-[10.5px] ${
                    activeTab === tab 
                      ? 'bg-white border-slate-300 border-b-white text-green-700 border-t-2 border-t-green-600 -translate-y-[2px] shadow-sm' 
                      : 'bg-[#f3f2f1] border-transparent text-slate-600 hover:bg-[#e1dfdd] hover:text-slate-800'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* DOCUMENT PREVIEW DIALOG */}
      
    </div>
  );
}
