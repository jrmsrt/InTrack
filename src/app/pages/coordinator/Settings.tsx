import {Link} from 'react-router-dom';
import {officialOjtCoordinator} from '../../data/institution';
import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import React, { useState } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { toast } from 'sonner';
import { Save, RefreshCw, ShieldAlert, Database } from 'lucide-react';

export function Settings() {
  const { systemSettings, updateSystemSettings, resetAllDemoData } = useCoordinatorModuleData();

  // Local form states
  const [academicYear, setAcademicYear] = useState(systemSettings.academicYear);
  const [semester, setSemester] = useState(systemSettings.semester);
  const [requiredHours, setRequiredHours] = useState(systemSettings.requiredHours);
  const [defaultRadius, setDefaultRadius] = useState(systemSettings.defaultRadius);

  const handleSave = async (e: React.FormEvent) => {
    try {
    e.preventDefault();
    await updateSystemSettings({
      academicYear,
      semester,
      requiredHours: Number(requiredHours),
      defaultRadius: Number(defaultRadius)
    });
    toast.success("System configurations updated successfully!");
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  return (
    <div className="space-y-6 font-sans">
      <p role="status" className="text-xs text-slate-500">Settings are managed per approved program policy. Global edits and mock reset are unavailable for real records.</p>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">System Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5 font-light">Configure global academic term dates, targets, and location constraints.</p>
        <p className="text-slate-500 text-sm mt-1">Official {officialOjtCoordinator.title}: {officialOjtCoordinator.name}</p>
      </div>

      <Button asChild className="bg-[#800000] text-white"><Link to="/coordinator/enrollment">Manage classes and program requirements</Link></Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings form */}
        <Card className="lg:col-span-2 shadow-sm border-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold text-slate-800">OJT System Constants</CardTitle>
            <CardDescription>Configure core system constants referenced by all flow stages.</CardDescription>
          </CardHeader>
          <CardContent className="pt-2 text-xs">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ay">Academic Year</Label>
                  <Input id="ay" value={academicYear} onChange={(e) => setAcademicYear(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sem">Semester</Label>
                  <select
                    id="sem"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                    className="w-full bg-white border border-slate-205 rounded p-2.5 text-xs focus:ring-[#800000] focus:border-[#800000]"
                  >
                    <option value="First Semester">First Semester</option>
                    <option value="Second Semester">Second Semester</option>
                    <option value="Summer Term">Summer Term</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="reqHrs">Standard Required Hours</Label>
                  <Input id="reqHrs" type="number" value={requiredHours} onChange={(e) => setRequiredHours(Number(e.target.value))} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rad">Default Attendance Radius (m)</Label>
                  <Input id="rad" type="number" value={defaultRadius} onChange={(e) => setDefaultRadius(Number(e.target.value))} required />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end">
                <Button 
                  disabled title="Approved program policy settings are managed separately" type="submit" 
                  className="bg-[#800000] hover:bg-[#6b0000] text-white text-xs font-bold px-5 flex items-center gap-1.5 cursor-pointer"
                >
                  <Save className="h-4 w-4" /> Save System Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Database administration / backup */}
        <div className="space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800">Database Administration</CardTitle>
              <CardDescription>Core operations to back up or flush current system cache.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3.5 text-xs">
              <Button
                variant="outline"
                disabled title="Backups are managed by the system operator"
                className="w-full h-10 text-slate-700 hover:bg-slate-50 flex items-center justify-start px-3 gap-2 border-slate-205 cursor-pointer font-semibold"
              >
                <Database className="h-4 w-4 text-[#800000]" />
                Compile System Backup
              </Button>

              <Button
                variant="ghost"
                disabled title="Mock reset is unavailable for real records"
                className="w-full h-10 text-red-700 hover:bg-red-50 hover:text-red-700 flex items-center justify-start px-3 gap-2 cursor-pointer font-bold"
              >
                <RefreshCw className="h-4 w-4 shrink-0" />
                Reset Mock DB to Defaults
              </Button>

              <div className="p-3 bg-red-50/50 border border-red-100 rounded-lg text-slate-600 flex gap-2">
                <ShieldAlert className="h-4.5 w-4.5 text-[#800000] shrink-0" />
                <p className="font-light">
                  <span className="font-semibold text-slate-800">Security Warning:</span> Database flushes immediately erase student file logs, attendance logs, and evaluation scorecards. Confirm before resetting.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
