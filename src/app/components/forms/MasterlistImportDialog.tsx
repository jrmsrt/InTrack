import React, { useRef, useState } from 'react';
import { FileSpreadsheet, Upload } from 'lucide-react';
import { Button } from '../ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { parseMasterlistFile } from '../../lib/masterlistImport';

export interface MasterlistStudent {
  studentNumber: string;
  name: string;
  email: string;
  program: string;
  section: string;
}

interface MasterlistImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (students: MasterlistStudent[]) => { imported: number; skipped: number } | Promise<{ imported: number; skipped: number }>;
  title?: string;
}

export function MasterlistImportDialog({ open, onOpenChange, onImport, title = 'Import Masterlist' }: MasterlistImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError,setImportError]=useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => { setFile(null); setIsImporting(false);setImportError(''); };
  const close = () => { if(isImporting)return; reset(); onOpenChange(false); };

  const importFile = async () => {
    if (!file) return;
    setIsImporting(true);
    setImportError('');
    try {
      const records=(await parseMasterlistFile(file)).map(row=>({studentNumber:row.studentNumber,name:row.name,email:row.email,program:row.programCode,section:row.section}));
      const result=await onImport(records);
      toast.success(`Masterlist imported: ${result.imported} student${result.imported === 1 ? '' : 's'} whitelisted.`, { description: result.skipped ? `${result.skipped} duplicate or invalid record(s) skipped.` : 'Students can now activate their accounts using the default password.' });
      setFile(null);onOpenChange(false);
    } catch (error) {
      const message=error instanceof Error ? error.message : 'Unable to import this masterlist.';
      setImportError(message);toast.error(message);
    } finally { setIsImporting(false); }
  };

  return <Dialog open={open} onOpenChange={nextOpen => nextOpen ? onOpenChange(true) : close()}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-[#800000]" />{title}</DialogTitle><DialogDescription>Upload a CSV or Excel (.xlsx) file to whitelist students for account activation and monitoring.</DialogDescription></DialogHeader><div className="space-y-4 py-2"><div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-600"><p className="font-bold text-slate-800">Required columns (first row)</p><p className="mt-1">Student Number | PUP Webmail | Last Name | First Name | Middle Name | Program | Year & Section</p><p className="mt-2 text-[10px] text-slate-400">Excel: use the first worksheet and format cells as Text. Maximum 500 students, 512 KB.</p><p className="mt-2 text-[10px] text-slate-400">Name example: Dela Cruz + Juan Carlo + Reyes → Dela Cruz, Juan Carlo R. Leave Middle Name blank if none.</p></div><div className="space-y-1.5"><Label htmlFor="masterlistFile">Masterlist CSV or Excel file</Label><Input ref={fileRef} id="masterlistFile" type="file" disabled={isImporting} accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={event => {setFile(event.target.files?.[0] || null);setImportError('');}} className="cursor-pointer" />{file && <p className="text-xs font-semibold text-green-700">Ready to import: {file.name}</p>}</div></div><DialogFooter><Button variant="outline" onClick={close}>Cancel</Button><Button onClick={importFile} disabled={!file || isImporting} className="gap-1.5 bg-[#800000] hover:bg-[#6b0000]"><Upload className="h-4 w-4" />{isImporting ? 'Importing...' : 'Whitelist students'}</Button></DialogFooter>{importError&&<p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{importError}</p>}</DialogContent></Dialog>;
}
