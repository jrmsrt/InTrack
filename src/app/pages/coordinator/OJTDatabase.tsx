import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import React, { useState } from 'react';
import { HTEPartner } from '../../context/OJTContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
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
  Download, 
  FileSpreadsheet, 
  FileText,
  Plus,
  Edit
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';

const blankPartnerForm: Omit<HTEPartner, 'id'> = {
  companyName: '',
  address: '',
  supervisorName: '',
  email: '',
  phone: '',
  dateNotarized: '',
  status: 'Active',
};

export function OJTDatabase() {
  const { students, htePartners, addHTEPartner, updateHTEPartner, exportDatabase } = useCoordinatorModuleData();
  const [searchTerm, setSearchTerm] = useState('');
  const [partnerSearchTerm, setPartnerSearchTerm] = useState('');
  const [partnerDialogOpen, setPartnerDialogOpen] = useState(false);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [partnerForm, setPartnerForm] = useState<Omit<HTEPartner, 'id'>>(blankPartnerForm);

  const filteredStudents = students.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.studentNumber.includes(searchTerm) ||
    s.companyName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExport=async(type:'Excel'|'CSV'|'PDF')=>{
    if(type!=='CSV'){toast.error('This export format is not connected yet. Use CSV.');return;}
    try{const rows=await exportDatabase();const columns=['studentName','programCode','component','lifecycle','outcome','requiredMinutes','creditedMinutes','remainingMinutes','clearance','moaStatus'];const cell=(value:unknown)=>'"'+String(value??'').replace(/^[=+@-]/,m=>"'"+m).replaceAll('"','""')+'"';const csv='\uFEFF'+[columns.map(cell).join(','),...rows.map(row=>columns.map(c=>cell(row[c])).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='intrack-enrollments.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast.success('Saved enrollment CSV exported.');}catch(error){toast.error(error instanceof Error?error.message:'Export failed.');}
  };

  const filteredPartners = htePartners.filter(partner =>
    partner.companyName.toLowerCase().includes(partnerSearchTerm.toLowerCase()) ||
    partner.address.toLowerCase().includes(partnerSearchTerm.toLowerCase()) ||
    partner.supervisorName.toLowerCase().includes(partnerSearchTerm.toLowerCase()) ||
    partner.email.toLowerCase().includes(partnerSearchTerm.toLowerCase())
  );

  const openNewPartnerDialog = () => {
    setEditingPartnerId(null);
    setPartnerForm(blankPartnerForm);
    setPartnerDialogOpen(true);
  };

  const openEditPartnerDialog = (partner: HTEPartner) => {
    setEditingPartnerId(partner.id);
    setPartnerForm({
      companyName: partner.companyName,
      address: partner.address,
      supervisorName: partner.supervisorName,
      email: partner.email,
      phone: partner.phone,
      dateNotarized: partner.dateNotarized,
      status: partner.status,
    });
    setPartnerDialogOpen(true);
  };

  const handlePartnerSubmit = async (event: React.FormEvent) => {
    try {
    event.preventDefault();
    if (!partnerForm.companyName.trim()) return;

    if (editingPartnerId) {
      await updateHTEPartner(editingPartnerId, partnerForm);
      toast.success(`${partnerForm.companyName} updated in the HTE partners list.`);
    } else {
      await addHTEPartner(partnerForm);
      toast.success(`${partnerForm.companyName} added to the HTE partners list.`);
    }

    setPartnerDialogOpen(false);
    setEditingPartnerId(null);
    setPartnerForm(blankPartnerForm);
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  return (
    <div className="space-y-6 font-sans">
      <p role="status" className="text-xs text-slate-500">HTE partner editing is awaiting its backend adapter. CSV exports contain up to 100 saved enrollments.</p>
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">OJT Deployed Database</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-light">Comprehensive directory database of all interns currently deployed or cleared.</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            onClick={() => handleExport('Excel')}
            className="text-xs h-9 border-slate-250 text-slate-700 flex items-center gap-1.5 cursor-pointer font-bold hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-green-600" /> Export Excel
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport('CSV')}
            className="text-xs h-9 border-slate-250 text-slate-700 flex items-center gap-1.5 cursor-pointer font-bold hover:bg-slate-50"
          >
            <FileText className="h-4 w-4 text-blue-600" /> Export CSV
          </Button>
          <Button 
            variant="outline" 
            onClick={() => handleExport('PDF')}
            className="text-xs h-9 border-slate-250 text-slate-700 flex items-center gap-1.5 cursor-pointer font-bold hover:bg-slate-50"
          >
            <Download className="h-4 w-4 text-red-600" /> Export PDF Booklet
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-800">Master Database Records</CardTitle>
            <CardDescription>Tracing cohort deployment and clearances details.</CardDescription>
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              type="search"
              placeholder="Search by student name or company..."
              className="pl-10 text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#800000]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Student Name</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Student Number</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase font-sans">Program</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Section</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Company Partner</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase font-sans font-normal">Section Adviser</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Total Rendered</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Portfolio status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.map((s) => (
                <TableRow key={s.studentId} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="py-3 px-4 font-bold text-slate-800 text-xs">{s.name}</TableCell>
                  <TableCell className="py-3 px-4 text-xs font-semibold text-slate-600">{s.studentNumber}</TableCell>
                  <TableCell className="py-3 px-4 text-xs text-slate-500 truncate max-w-[120px]">{s.program.split('—')[0]}</TableCell>
                  <TableCell className="py-3 px-4 text-xs font-semibold text-slate-650">{s.section}</TableCell>
                  <TableCell className="py-3 px-4 text-xs font-semibold text-slate-700">{s.companyName}</TableCell>
                  <TableCell className="py-3 px-4 text-xs text-slate-500 font-medium">Prof. {s.adviserName}</TableCell>
                  <TableCell className="py-3 px-4 text-xs font-extrabold text-slate-800">{s.totalHoursRendered.toFixed(1)} / {s.requiredHours} hrs</TableCell>
                  <TableCell className="py-3 px-4">
                    {s.coordinatorPortfolioStatus === 'Approved' ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">Final Approved</Badge>
                    ) : s.portfolioApproved ? (
                      <Badge className="bg-violet-100 text-violet-800 border-violet-200">Adviser Endorsed</Badge>
                    ) : s.coordinatorPortfolioStatus === 'Needs Revision' ? (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-200">Needs Revision</Badge>
                    ) : s.portfolioSubmitted ? (
                      <Badge className="bg-blue-100 text-blue-800 border-blue-200">Adviser Review</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 border-slate-200">Pending</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 flex flex-col sm:flex-row justify-between sm:items-center gap-4">
          <div>
            <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-green-700" />
              Final Active MOA HTE Partners List
            </CardTitle>
            <CardDescription>Edit the Excel-style HTE list shown as read-only in the student MOA portal.</CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                type="search"
                placeholder="Search HTE partners..."
                className="pl-10 text-xs bg-slate-50 border-slate-200 focus-visible:ring-[#800000]"
                value={partnerSearchTerm}
                onChange={(e) => setPartnerSearchTerm(e.target.value)}
              />
            </div>
            <Dialog open={partnerDialogOpen} onOpenChange={setPartnerDialogOpen}>
              <DialogTrigger asChild>
                <Button
                  onClick={openNewPartnerDialog}
                  className="h-9 bg-[#800000] text-xs font-bold text-white hover:bg-[#6b0000]"
                >
                  <Plus className="h-4 w-4" /> Add HTE
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-2xl">
                <form onSubmit={handlePartnerSubmit}>
                  <DialogHeader>
                    <DialogTitle>{editingPartnerId ? 'Edit HTE Partner' : 'Add HTE Partner'}</DialogTitle>
                    <DialogDescription>Changes saved here immediately update the student portal HTE spreadsheet preview.</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-3 py-4 text-xs sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="partner-company">Company name</Label>
                      <Input id="partner-company" value={partnerForm.companyName} onChange={(e) => setPartnerForm(current => ({ ...current, companyName: e.target.value }))} required />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="partner-supervisor">Supervisor / Trainer</Label>
                      <Input id="partner-supervisor" value={partnerForm.supervisorName} onChange={(e) => setPartnerForm(current => ({ ...current, supervisorName: e.target.value }))} />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label htmlFor="partner-address">Complete company address</Label>
                      <Input id="partner-address" value={partnerForm.address} onChange={(e) => setPartnerForm(current => ({ ...current, address: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="partner-email">Email address</Label>
                      <Input id="partner-email" type="email" value={partnerForm.email} onChange={(e) => setPartnerForm(current => ({ ...current, email: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="partner-phone">Contact number</Label>
                      <Input id="partner-phone" value={partnerForm.phone} onChange={(e) => setPartnerForm(current => ({ ...current, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="partner-date">Date notarized / remarks</Label>
                      <Input id="partner-date" value={partnerForm.dateNotarized} onChange={(e) => setPartnerForm(current => ({ ...current, dateNotarized: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="partner-status">List status</Label>
                      <select
                        id="partner-status"
                        value={partnerForm.status}
                        onChange={(e) => setPartnerForm(current => ({ ...current, status: e.target.value as HTEPartner['status'] }))}
                        className="w-full rounded border border-slate-205 bg-white p-2 text-xs"
                      >
                        <option value="Active">Active</option>
                        <option value="Pending">Pending</option>
                        <option value="Archived">Archived</option>
                      </select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setPartnerDialogOpen(false)}>Cancel</Button>
                    <Button disabled title="HTE partner editing is not connected yet" type="submit" className="bg-[#800000] text-white hover:bg-[#6b0000]">Save HTE</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Company Name</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Address</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Supervisor</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Email</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Phone</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Date Notarized</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Status</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredPartners.map(partner => (
                <TableRow key={partner.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="py-3 px-4 text-xs font-bold text-slate-800">{partner.companyName}</TableCell>
                  <TableCell className="py-3 px-4 text-xs text-slate-600 min-w-64">{partner.address}</TableCell>
                  <TableCell className="py-3 px-4 text-xs text-slate-600">{partner.supervisorName}</TableCell>
                  <TableCell className="py-3 px-4 text-xs text-blue-700">{partner.email}</TableCell>
                  <TableCell className="py-3 px-4 text-xs text-slate-600">{partner.phone}</TableCell>
                  <TableCell className="py-3 px-4 text-xs text-slate-600">{partner.dateNotarized}</TableCell>
                  <TableCell className="py-3 px-4">
                    <Badge className={
                      partner.status === 'Active'
                        ? 'bg-green-100 text-green-800 border-green-200'
                        : partner.status === 'Pending'
                          ? 'bg-amber-100 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                    }>
                      {partner.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3 px-4 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditPartnerDialog(partner)}
                      className="h-8 text-xs text-slate-600 hover:bg-red-50 hover:text-[#800000]"
                    >
                      <Edit className="h-4 w-4" /> Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
