import { DocumentReviewWorkspace, NativeFilePreviewLink } from '../../components/forms/FileViewer';
import type { UploadedDocument } from '../../lib/uploadedDocument';
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { RequirementStatusBadge } from '../../components/forms/RequirementStatusBadge';
import {
  coordinatorUploadQueue,
  formsAnnouncements,
  formsTemplates,
  requirementReviewHistory,
  type RequirementSubmissionStatus,
} from '../../data/referenceData';
import {
  CheckCircle2,
  Edit,
  ExternalLink,
  Eye,
  History,
  Megaphone,
  MessageSquare,
  Plus,
  Power,
  PowerOff,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react';

const statusClass: Record<string, string> = {
  Published: 'bg-green-100 text-green-800 hover:bg-green-100',
  Draft: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
};

const priorityClass: Record<string, string> = {
  Normal: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  Important: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  Urgent: 'bg-red-100 text-red-800 hover:bg-red-100',
};

function TemplateDialog({ mode }: { mode: 'Add' | 'Edit' }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {mode === 'Add' ? (
          <Button className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            <Plus className="h-4 w-4" />
            Add Template
          </Button>
        ) : (
          <Button variant="outline" size="sm" className="gap-2">
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode} Template Link</DialogTitle>
          <DialogDescription>
            Template access uses external links only. Requirement submission remains in deployment compliance.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor={`${mode}-name`}>Template name</Label>
            <Input id={`${mode}-name`} placeholder="MOA Template" />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select defaultValue="Before OJT">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Before OJT">Before OJT</SelectItem>
                <SelectItem value="During OJT">During OJT</SelectItem>
                <SelectItem value="After OJT">After OJT</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor={`${mode}-description`}>Description</Label>
            <Textarea id={`${mode}-description`} placeholder="Short student-facing description" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor={`${mode}-url`}>External link URL</Label>
            <Input id={`${mode}-url`} placeholder="https://example.com/templates/moa" />
          </div>
          <div className="space-y-2">
            <Label>Required/Optional setting</Label>
            <Select defaultValue="Required">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Required">Required</SelectItem>
                <SelectItem value="Optional">Optional</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Visibility status</Label>
            <Select defaultValue="Published">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Published">Published</SelectItem>
                <SelectItem value="Draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor={`${mode}-notes`}>Notes/instructions</Label>
            <Textarea id={`${mode}-notes`} placeholder="Internal notes or student-facing instructions" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700">Save Template</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnnouncementDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Megaphone className="h-4 w-4" />
          New Advisory
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Announcement</DialogTitle>
          <DialogDescription>Post reminders and advisories to student dashboards and Forms & Templates.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="announcement-title">Title</Label>
            <Input id="announcement-title" placeholder="Document submission deadline" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="announcement-message">Message</Label>
            <Textarea id="announcement-message" placeholder="Write the announcement message" />
          </div>
          <div className="space-y-2">
            <Label>Priority label</Label>
            <Select defaultValue="Normal">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Important">Important</SelectItem>
                <SelectItem value="Urgent">Urgent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select defaultValue="General">
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Before OJT">Before OJT</SelectItem>
                <SelectItem value="During OJT">During OJT</SelectItem>
                <SelectItem value="After OJT">After OJT</SelectItem>
                <SelectItem value="General">General</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="publish-date">Publish date</Label>
            <Input id="publish-date" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="expiration-date">Expiration date</Label>
            <Input id="expiration-date" type="date" />
          </div>
          <label className="md:col-span-2 flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            Pin announcement
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline">Cancel</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700">Publish Advisory</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReviewDialog({
  documentName,
  file,
  disabled = false,
  onStatusChange,
}: {
  documentName: string;
  file?: UploadedDocument | null;
  disabled?: boolean;
  onStatusChange: (status: RequirementSubmissionStatus, remarks: string) => void;
}) {
  const [remarks, setRemarks] = useState('');

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2" disabled={disabled || !file?.url}>
          <MessageSquare className="h-4 w-4" />
          Review
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[min(96vw,1400px)] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Document</DialogTitle>
          <DialogDescription>{documentName}</DialogDescription>
        </DialogHeader>
        <DocumentReviewWorkspace file={file}>
          <div className="space-y-2">
            <Label htmlFor={`remarks-${documentName}`}>Remarks/comments</Label>
            <Textarea
              id={`remarks-${documentName}`}
              placeholder="Add review comments for the student"
              value={remarks}
              onChange={(event) => setRemarks(event.target.value)}
            />
          </div>
        <DialogFooter className="sm:justify-between">
          <Button
            variant="outline"
            className="gap-2 border-orange-300 text-orange-700 hover:bg-orange-50"
            onClick={() => onStatusChange('Needs Revision', remarks || 'Please revise and re-upload the document.')}
          >
            <RefreshCw className="h-4 w-4" />
            Needs Revision
          </Button>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="gap-2 border-red-300 text-red-700 hover:bg-red-50"
              onClick={() => onStatusChange('Rejected', remarks || 'Document rejected. See remarks for correction.')}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </Button>
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => onStatusChange('Approved', remarks || 'Approved.')}
            >
              <CheckCircle2 className="h-4 w-4" />
              Approve
            </Button>
          </div>
        </DialogFooter>
        </DocumentReviewWorkspace>
      </DialogContent>
    </Dialog>
  );
}

function RequirementReviewPanel() {
  const [uploads, setUploads] = useState(coordinatorUploadQueue.map(upload => ({ ...upload, file: null as UploadedDocument | null })));
  const [studentFilter, setStudentFilter] = useState('All');
  const [sectionFilter, setSectionFilter] = useState('All');
  const [companyFilter, setCompanyFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');

  const unique = (key: 'student' | 'section' | 'company' | 'documentType' | 'category' | 'status') => [
    'All',
    ...Array.from(new Set(uploads.map((upload) => upload[key]))),
  ];

  const filteredUploads = uploads.filter((upload) => {
    return (
      (studentFilter === 'All' || upload.student === studentFilter) &&
      (sectionFilter === 'All' || upload.section === sectionFilter) &&
      (companyFilter === 'All' || upload.company === companyFilter) &&
      (typeFilter === 'All' || upload.documentType === typeFilter) &&
      (categoryFilter === 'All' || upload.category === categoryFilter) &&
      (statusFilter === 'All' || upload.status === statusFilter)
    );
  });

  const updateReview = (id: number, status: RequirementSubmissionStatus, remarks: string) => {
    setUploads((current) =>
      current.map((upload) =>
        upload.id === id
          ? {
              ...upload,
              status,
              remarks,
            }
          : upload,
      ),
    );
  };

  const sarahRequired = uploads.filter((upload) => upload.student === 'Sarah Johnson' && upload.requiredForDeployment);
  const approvedSarahRequired = sarahRequired.filter((upload) => upload.status === 'Approved').length;
  const missingRequirements = uploads.filter((upload) => upload.status === 'Not Submitted');
  const reviewProgress = Math.round((uploads.filter((upload) => upload.status === 'Approved').length / uploads.length) * 100);

  const renderFilter = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    options: string[],
  ) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option} value={option}>{option}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Uploaded files</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{uploads.filter((upload) => upload.fileName).length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">Missing requirements</p>
            <p className="text-2xl font-semibold text-slate-900 mt-1">{missingRequirements.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">Review progress</p>
              <span className="text-sm font-medium text-indigo-700">{reviewProgress}%</span>
            </div>
            <Progress value={reviewProgress} className="mt-3 bg-indigo-100 [&_[data-slot=progress-indicator]]:bg-indigo-600" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-indigo-600" />
            Review Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
            {renderFilter('Student', studentFilter, setStudentFilter, unique('student'))}
            {renderFilter('Section', sectionFilter, setSectionFilter, unique('section'))}
            {renderFilter('Company/HTE', companyFilter, setCompanyFilter, unique('company'))}
            {renderFilter('Document type', typeFilter, setTypeFilter, unique('documentType'))}
            {renderFilter('Category', categoryFilter, setCategoryFilter, unique('category'))}
            {renderFilter('Status', statusFilter, setStatusFilter, unique('status'))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student Upload Review Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Section</TableHead>
                <TableHead>Company/HTE</TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>File</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="text-right">Review</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUploads.map((upload) => (
                <TableRow key={upload.id}>
                  <TableCell className="font-medium text-slate-900">{upload.student}</TableCell>
                  <TableCell>{upload.section}</TableCell>
                  <TableCell>{upload.company}</TableCell>
                  <TableCell>{upload.documentType}</TableCell>
                  <TableCell>{upload.category}</TableCell>
                  <TableCell className="min-w-48 whitespace-normal">
                    {upload.fileName ? (
                      <NativeFilePreviewLink file={upload.file}>View</NativeFilePreviewLink>
                    ) : (
                      <span className="text-slate-500">Missing</span>
                    )}
                  </TableCell>
                  <TableCell><RequirementStatusBadge status={upload.status} /></TableCell>
                  <TableCell className="min-w-56 whitespace-normal text-slate-600">{upload.remarks}</TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <NativeFilePreviewLink file={upload.file}>View</NativeFilePreviewLink>
                      <ReviewDialog
                        file={upload.file}
                        documentName={`${upload.student} · ${upload.documentType}`}
                        disabled={!upload.file?.url}
                        onStatusChange={(status, remarks) => updateReview(upload.id, status, remarks)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Missing Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {missingRequirements.map((requirement) => (
                <div key={requirement.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{requirement.student}</p>
                      <p className="text-sm text-slate-600">{requirement.documentType} · {requirement.category}</p>
                    </div>
                    <RequirementStatusBadge status={requirement.status} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-indigo-600" />
              Deployment Clearance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">Sarah Johnson</p>
                  <p className="text-sm text-slate-500">Required deployment files approved: {approvedSarahRequired}/{sarahRequired.length}</p>
                </div>
                <Badge className={approvedSarahRequired === sarahRequired.length ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
                  {approvedSarahRequired === sarahRequired.length ? 'Cleared' : 'Pending'}
                </Badge>
              </div>
              <Progress
                value={Math.round((approvedSarahRequired / sarahRequired.length) * 100)}
                className="mt-4 bg-indigo-100 [&_[data-slot=progress-indicator]]:bg-indigo-600"
              />
              <Button className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 gap-2" disabled={approvedSarahRequired !== sarahRequired.length}>
                <ShieldCheck className="h-4 w-4" />
                Mark Cleared for Deployment
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-indigo-600" />
            Review History / Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {requirementReviewHistory.map((event) => (
              <div key={event.id} className="flex gap-3">
                <div className="mt-1 h-3 w-3 rounded-full bg-indigo-600 flex-shrink-0" />
                <div className="border-b border-slate-200 pb-4 flex-1 last:border-b-0">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-medium text-slate-900">{event.documentType} · {event.action}</p>
                    <span className="text-xs text-slate-500">{event.date}</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{event.remarks}</p>
                  <p className="text-xs text-slate-500 mt-1">By {event.actor}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function FormsTemplatesManagement() {
  const [disabledIds, setDisabledIds] = useState<number[]>([]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">Forms & Templates Management</h1>
          <p className="text-slate-600 mt-1">Manage the external template links and student-facing advisories.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <AnnouncementDialog />
          <TemplateDialog mode="Add" />
        </div>
      </div>

      <Tabs defaultValue="templates" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:w-fit">
          <TabsTrigger value="templates">Template Links</TabsTrigger>
          <TabsTrigger value="reviews">Requirement Review</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Template Links</CardTitle>
              <p className="text-sm text-slate-500">Templates remain external links only. Completed requirements are reviewed separately.</p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Template</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Link URL</TableHead>
                    <TableHead>Tag</TableHead>
                    <TableHead>Last Updated</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formsTemplates.map((template) => {
                    const disabled = disabledIds.includes(template.id);
                    return (
                      <TableRow key={template.id} className={disabled ? 'opacity-60' : ''}>
                        <TableCell>{template.category}</TableCell>
                        <TableCell className="font-medium text-slate-900">{template.name}</TableCell>
                        <TableCell className="min-w-64 whitespace-normal text-slate-600">{template.description}</TableCell>
                        <TableCell>
                          <a href={template.linkUrl} className="inline-flex items-center gap-1 text-indigo-700 hover:underline" target="_blank" rel="noopener noreferrer">
                            Placeholder
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </TableCell>
                        <TableCell><Badge variant="outline">{template.requirement}</Badge></TableCell>
                        <TableCell>{template.lastUpdated}</TableCell>
                        <TableCell><Badge className={disabled ? statusClass.Draft : statusClass[template.status]}>{disabled ? 'Draft' : template.status}</Badge></TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-2">
                            <TemplateDialog mode="Edit" />
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-2"
                              onClick={() =>
                                setDisabledIds((current) =>
                                  disabled ? current.filter((id) => id !== template.id) : [...current, template.id],
                                )
                              }
                            >
                              {disabled ? <Power className="h-4 w-4" /> : <PowerOff className="h-4 w-4" />}
                              {disabled ? 'Enable' : 'Disable'}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <RequirementReviewPanel />
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>Announcements & Advisories</CardTitle>
          <Megaphone className="h-5 w-5 text-indigo-600" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {formsAnnouncements.map((announcement) => (
              <div key={announcement.id} className="rounded-lg border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-medium text-slate-900">{announcement.title}</h3>
                  <Badge className={priorityClass[announcement.priority]}>{announcement.priority}</Badge>
                </div>
                <p className="text-sm text-slate-600 mt-2">{announcement.message}</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Badge variant="outline">{announcement.category}</Badge>
                  {announcement.pinned && <Badge className="bg-indigo-100 text-indigo-800 hover:bg-indigo-100">Pinned</Badge>}
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  Published {announcement.publishDate} · Expires {announcement.expirationDate}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

