import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import React, { useState } from 'react';

import {useCoordinatorIdentity} from '../../components/shared/CoordinatorPortal';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Plus, Megaphone, Trash, Bell, AlertTriangle, Calendar } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';

export function Announcements() {
  const identity=useCoordinatorIdentity(); const user={name:identity.profile.displayName};
  const { announcements, addAnnouncement, deleteAnnouncement } = useCoordinatorModuleData();
  const [addDialogOpen, setAddDialogOpen] = useState(false);

  // Form states
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'Info' | 'Important' | 'Urgent'>('Info');
  const [targetRole, setTargetRole] = useState<'all' | 'student' | 'adviser'>('all');

  const handleSubmit = async (e: React.FormEvent) => {
    try {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    await addAnnouncement({
      title,
      message,
      priority,
      targetRole,
      author: user?.name || 'OJT Coordinator'
    });

    toast.success("OJT Announcement published successfully!");
    setAddDialogOpen(false);
    setTitle('');
    setMessage('');
    setPriority('Info');
    setTargetRole('all');
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  const handleDelete = async (id: string) => {
    try {
    await deleteAnnouncement(id);
    toast.success("Announcement deleted.");
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  const getPriorityBadge = (prio: string) => {
    switch (prio) {
      case 'Urgent':
        return <Badge className="bg-red-100 text-red-800 border-red-200 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Urgent</Badge>;
      case 'Important':
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">Important</Badge>;
      default:
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Info</Badge>;
    }
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Announcements Management</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-light">Publish alerts and reminders to student dashboards and Adviser accounts.</p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-[#800000] hover:bg-[#6b0000] text-white text-xs h-9 flex items-center gap-1.5 cursor-pointer font-bold">
              <Plus className="h-4 w-4" /> New Announcement
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md font-sans">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Publish OJT Announcement</DialogTitle>
                <DialogDescription>Broadcast warning advisories or checklists reminders.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="annTitle">Title</Label>
                  <Input id="annTitle" placeholder="e.g. Pre-Deployment Submission Deadline" value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="annMsg">Message</Label>
                  <Textarea id="annMsg" placeholder="Write full details here..." value={message} onChange={(e) => setMessage(e.target.value)} rows={3} required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="annPrio">Priority</Label>
                    <select
                      id="annPrio"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                      className="w-full bg-white border border-slate-205 rounded p-2 text-xs"
                    >
                      <option value="Info">Info</option>
                      <option value="Important">Important</option>
                      <option value="Urgent">Urgent</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="annTarget">Target Role</Label>
                    <select
                      id="annTarget"
                      value={targetRole}
                      onChange={(e) => setTargetRole(e.target.value as any)}
                      className="w-full bg-white border border-slate-205 rounded p-2 text-xs"
                    >
                      <option value="all">All Users</option>
                      <option value="student">Students Only</option>
                      <option value="adviser">Advisers Only</option>
                    </select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="bg-[#800000] hover:bg-[#6b0000] text-white">Broadcast Alert</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Grid List */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800">Broadcast Alerts Log</CardTitle>
          <CardDescription>Track all bulletins currently active on the platform dashboards.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table className="min-w-[780px] table-fixed">
            <colgroup>
              <col className="w-[52%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[16%]" />
              <col className="w-[6%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Bulletin</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Priority</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Target Audience</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase font-sans">Date Published</TableHead>
                <TableHead className="py-3 px-3 font-semibold text-xs text-slate-500 uppercase text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {announcements.map((ann) => (
                <TableRow key={ann.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="py-3.5 px-4 font-sans align-top">
                    <span title={ann.title} className="block truncate font-bold text-slate-805 text-xs">{ann.title}</span>
                    <p title={ann.message} className="mt-0.5 overflow-hidden text-[11px] font-light leading-normal text-slate-500 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">{ann.message}</p>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 align-top">
                    {ann.priority==='Not recorded'?<Badge>Not recorded</Badge>:getPriorityBadge(ann.priority)}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 align-top text-xs font-semibold text-slate-650 capitalize whitespace-nowrap">
                    {ann.targetRole}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 align-top font-semibold text-xs text-slate-450 font-sans whitespace-nowrap">
                    <span className="flex items-center gap-1 whitespace-nowrap">
                      <Calendar className="h-3.5 w-3.5" />
                      {ann.publishDate}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 px-3 align-top text-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(ann.id)}
                      className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <Trash className="h-4 w-4" />
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
