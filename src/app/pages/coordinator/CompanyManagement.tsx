import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import React, { useState } from 'react';
import { Company } from '../../context/OJTContext';
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
import { Plus, Building, MapPin, Phone, Mail, Compass } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';

export function CompanyManagement() {
  const { companies, addCompany, students } = useCoordinatorModuleData();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Form states
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [email, setEmail] = useState('');
  const [latitude, setLatitude] = useState(14.5547);
  const [longitude, setLongitude] = useState(121.0244);
  const [allowedRadius, setAllowedRadius] = useState(200);

  const handleAddCompanySubmit = async (e: React.FormEvent) => {
    try {
    e.preventDefault();
    if (!name.trim() || !address.trim() || !email.trim()) return;

    await addCompany({
      name,
      address,
      contactPerson,
      contactNumber,
      email,
      latitude: Number(latitude),
      longitude: Number(longitude),
      allowedRadius: Number(allowedRadius)
    });

    toast.success(`HTE Partner: ${name} added! Geofence boundaries configured.`);
    setAddDialogOpen(false);
    clearForm();
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  const clearForm = () => {
    setName('');
    setAddress('');
    setContactPerson('');
    setContactNumber('');
    setEmail('');
    setLatitude(14.5547);
    setLongitude(121.0244);
    setAllowedRadius(200);
  };

  return (
    <div className="space-y-6 font-sans">
      <p role="status" className="text-xs text-slate-500">The company directory is awaiting its backend adapter. Saved placements remain in Supabase.</p>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Company & Deployment</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-light">Register host companies, set GPS coordinates, and allowed geofence attendance radius.</p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#800000] hover:bg-[#6b0000] text-white text-xs h-9 flex items-center gap-1.5 cursor-pointer">
              <Plus className="h-4 w-4" /> Add Company HTE
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg font-sans">
            <form onSubmit={handleAddCompanySubmit}>
              <DialogHeader>
                <DialogTitle>Register Host HTE Company</DialogTitle>
                <DialogDescription>Input corporate office coordinates and allowable radius for geofence validation checks.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="compName">Company Name</Label>
                  <Input id="compName" placeholder="e.g. TechCorp Solutions Inc." value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="compAddr">Company Address</Label>
                  <Input id="compAddr" placeholder="Street, City, Province" value={address} onChange={(e) => setAddress(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="compContact">Contact Person</Label>
                    <Input id="compContact" placeholder="HR Manager Name" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="compPhone">Contact Number</Label>
                    <Input id="compPhone" placeholder="Landline / Mobile" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="compMail">Contact Email</Label>
                  <Input id="compMail" type="email" placeholder="hr@company.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="grid grid-cols-3 gap-3 border-t pt-3 mt-3">
                  <div className="space-y-1">
                    <Label htmlFor="compLat">Latitude Target</Label>
                    <Input id="compLat" type="number" step="any" value={latitude} onChange={(e) => setLatitude(Number(e.target.value))} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="compLng">Longitude Target</Label>
                    <Input id="compLng" type="number" step="any" value={longitude} onChange={(e) => setLongitude(Number(e.target.value))} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="compRad">Geofence Radius (m)</Label>
                    <Input id="compRad" type="number" value={allowedRadius} onChange={(e) => setAllowedRadius(Number(e.target.value))} required />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button disabled title="Company directory editing is not connected yet" type="submit" className="bg-[#800000] hover:bg-[#6b0000] text-white">Save Company</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* List Grid */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800">Company geofence Registry</CardTitle>
          <CardDescription>Tracing HTE companies coordinates limits for location punch validations.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">HTE Company</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Audit Coordinates</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase w-32">Punch Radius</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Contact details</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center w-28">Deployed Interns</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {companies.map((c) => {
                // Calculate assigned student count
                const deployedCount = students.filter(s => s.companyId === c.id || s.companyName === c.name).length;

                return (
                  <TableRow key={c.id} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-3.5 px-4">
                      <span className="font-bold text-slate-800 text-xs block">{c.name}</span>
                      <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {c.address}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 font-mono text-[10px] text-slate-505">
                      <span className="flex items-center gap-1 font-semibold">
                        <Compass className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {c.latitude.toFixed(6)}, {c.longitude.toFixed(6)}
                      </span>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-xs font-extrabold text-slate-750">
                      Circle: {c.allowedRadius} meters
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-[10px] font-medium text-slate-500 leading-normal">
                      <p>HR: {c.contactPerson || '—'}</p>
                      <p>Email: {c.email}</p>
                      <p>Tel: {c.contactNumber || '—'}</p>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-center font-bold text-slate-800 text-xs">
                      {deployedCount} interns
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
