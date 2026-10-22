import {useCoordinatorModuleData} from '../../context/CoordinatorModuleData';
import React, { useState } from 'react';
import { Template } from '../../context/OJTContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table';
import { Plus, Edit, FileText, ToggleLeft, ToggleRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../../components/ui/dialog';

const templateStages = ['Pre-OJT', 'During-OJT', 'Post-OJT'] as const;
type TemplateStage = typeof templateStages[number];
const templateStage = (category: Template['category']): TemplateStage =>
  category === 'Portfolio' || category === 'Evaluation' ? 'Post-OJT' : category;

export function TemplateManagement() {
  const { templates, addTemplate, updateTemplate, directory, loading, error, busy, refresh } = useCoordinatorModuleData();
  const [programId,setProgramId] = useState('');
  const selectedProgram=programId||directory?.programs[0]?.id||'';
  const [activeStage,setActiveStage] = useState<TemplateStage>('Pre-OJT');
  const programTemplates=templates.filter(t=>!t.programId||t.programId===selectedProgram);
  const visibleTemplates=programTemplates.filter(t=>templateStage(t.category)===activeStage);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateStage>('Pre-OJT');
  const [description, setDescription] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [editName, setEditName] = useState('');
  const [editCategory, setEditCategory] = useState<TemplateStage>('Pre-OJT');
  const [editDescription, setEditDescription] = useState('');
  const [editLinkUrl, setEditLinkUrl] = useState('');

  const handleAddTemplate = async (e: React.FormEvent) => {
    try {
    e.preventDefault();
    if (!name.trim() || !linkUrl.trim()) return;

    await addTemplate({
      name,
      category,
      description,
      linkUrl,
      status: 'Published'
      ,programId:selectedProgram
    });

    toast.success(`Academic template "${name}" published!`);
    setActiveStage(category);
    setAddDialogOpen(false);
    setName('');
    setDescription('');
    setLinkUrl('');
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  const openEditDialog = (template: Template) => {
    setEditingTemplateId(template.id);
    setEditName(template.name);
    setEditCategory(templateStage(template.category));
    setEditDescription(template.description);
    setEditLinkUrl(template.linkUrl);
    setEditDialogOpen(true);
  };

  const handleEditTemplate = async (e: React.FormEvent) => {
    try {
    e.preventDefault();
    if (!editingTemplateId || !editName.trim() || !editLinkUrl.trim()) return;

    await updateTemplate(editingTemplateId, {
      name: editName,
      category: editCategory,
      description: editDescription,
      linkUrl: editLinkUrl
    });

    toast.success(`Template "${editName}" updated.`);
    setActiveStage(editCategory);
    setEditDialogOpen(false);
    setEditingTemplateId(null);
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  const downloadTemplate=async(id:string)=>{const popup=window.open('about:blank','_blank');if(popup)popup.opener=null;try{const {getSupabaseClient}=await import('../../lib/supabaseClient');const {data,error}=await getSupabaseClient().functions.invoke('template-files',{body:{action:'download',templateId:id,role:'coordinator'}});if(error||!data?.url)throw new Error();if(popup)popup.location.replace(data.url);}catch{popup?.close();toast.error('Unable to download this private template.');}};
  const handleToggleStatus = async (template: Template) => {
    try {
    const nextStatus = template.status === 'Published' ? 'Disabled' : 'Published';
    await updateTemplate(template.id, { status: nextStatus });
    toast.success(`Template ${template.name} is now ${nextStatus}`);
  
    } catch(error) { toast.error(error instanceof Error?error.message:"Unable to save. Please retry."); }
  };

  return (
    <div className="space-y-6 font-sans">
      {error&&<p role="alert" className="text-sm text-red-700">{error} <button className="underline" onClick={refresh}>Retry</button></p>}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Template Management</h1>
          <p className="text-slate-500 text-sm mt-0.5 font-light">Publish and maintain official document templates for students to download.</p>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={()=>setCategory(activeStage)} className="bg-[#800000] hover:bg-[#6b0000] text-white text-xs h-9 flex items-center gap-1.5 cursor-pointer">
              <Plus className="h-4 w-4" /> Add Template
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md font-sans">
            <form onSubmit={handleAddTemplate}>
              <DialogHeader>
                <DialogTitle>Upload Template Link</DialogTitle>
                <DialogDescription>Link official Google Docs or PDF documents for interns.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="tName">Template Name</Label>
                  <Input id="tName" placeholder="e.g. Midterm Progress Report" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tCat">Document Category</Label>
                  <select
                    id="tCat"
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TemplateStage)}
                    className="w-full bg-white border border-slate-205 rounded p-2 text-xs"
                  >
                    <option value="Pre-OJT">Pre-OJT</option>
                    <option value="During-OJT">During-OJT</option>
                    <option value="Post-OJT">Post-OJT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tDesc">Description</Label>
                  <Input id="tDesc" placeholder="Student-facing descriptions" value={description} onChange={(e) => setDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tUrl">Template Download URL</Label>
                  <Input id="tUrl" type="url" placeholder="https://docs.google.com/..." value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                <Button disabled={busy||loading||!selectedProgram} type="submit" className="bg-[#800000] hover:bg-[#6b0000] text-white">Publish</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md font-sans">
            <form onSubmit={handleEditTemplate}>
              <DialogHeader>
                <DialogTitle>Edit Template Link</DialogTitle>
                <DialogDescription>Update the student-facing template name, category, description, or URL.</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-3.5 text-xs">
                <div className="space-y-1">
                  <Label htmlFor="editTName">Template Name</Label>
                  <Input id="editTName" value={editName} onChange={(e) => setEditName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editTCat">Document Category</Label>
                  <select
                    id="editTCat"
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value as TemplateStage)}
                    className="w-full bg-white border border-slate-205 rounded p-2 text-xs"
                  >
                    <option value="Pre-OJT">Pre-OJT</option>
                    <option value="During-OJT">During-OJT</option>
                    <option value="Post-OJT">Post-OJT</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editTDesc">Description</Label>
                  <Input id="editTDesc" value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="editTUrl">Template Download URL</Label>
                  <Input id="editTUrl" type="url" value={editLinkUrl} onChange={(e) => setEditLinkUrl(e.target.value)} required />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>Cancel</Button>
                <Button disabled={busy||loading} type="submit" className="bg-[#800000] hover:bg-[#6b0000] text-white">Save Changes</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {directory&&directory.programs.length>1&&<div className="flex items-center gap-3"><Label htmlFor="templateProgram">Program</Label><select id="templateProgram" className="border border-slate-200 rounded p-2 text-sm bg-white" value={selectedProgram} onChange={e=>setProgramId(e.target.value)}>{directory.programs.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select></div>}

      <Tabs value={activeStage} onValueChange={value=>setActiveStage(value as TemplateStage)}>
        <TabsList aria-label="Template stage" className="grid w-full grid-cols-3">
          {templateStages.map(stage=><TabsTrigger key={stage} value={stage} className="gap-2 data-[state=active]:text-[#800000]">
            {stage}<span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{programTemplates.filter(t=>templateStage(t.category)===stage).length}</span>
          </TabsTrigger>)}
        </TabsList>
      <TabsContent value={activeStage} className="mt-4">
      {/* Roster list */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader>
          <CardTitle className="text-base font-bold text-slate-800">{activeStage} Templates</CardTitle>
          <CardDescription>{activeStage==='Post-OJT'?'Completion, evaluation, and final portfolio templates.':activeStage==='During-OJT'?'Templates used throughout internship training.':'Templates required before internship deployment.'}</CardDescription>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50/50">
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Document Outline</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">OJT Category</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase">Description</TableHead>
                <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase w-32">Status</TableHead>
                  <TableHead className="py-3 px-4 font-semibold text-xs text-slate-500 uppercase text-center w-44">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading&&<TableRow><TableCell colSpan={5} role="status" className="p-4 text-slate-500">Loading saved templates…</TableCell></TableRow>}
              {!loading&&!error&&!visibleTemplates.length&&<TableRow><TableCell colSpan={5} className="p-4 text-slate-500">No {activeStage} templates saved for this program.</TableCell></TableRow>}
              {visibleTemplates.map((t) => (
                <TableRow key={t.id} className="hover:bg-slate-50/50 transition-colors">
                  <TableCell className="py-3.5 px-4 font-sans font-bold text-slate-800 text-xs">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-[#800000]" />
                      {t.linkUrl?<a className="text-left hover:underline" href={t.linkUrl} target="_blank" rel="noopener noreferrer">{t.name}</a>:<button type="button" className="text-left hover:underline" onClick={()=>void downloadTemplate(t.id)}>{t.name}</button>}
                    </div>
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-xs font-semibold text-slate-650">
                    {templateStage(t.category)}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-xs text-slate-500 font-light truncate max-w-xs">
                    {t.description || '—'}
                  </TableCell>
                  <TableCell className="py-3.5 px-4">
                    {t.status === 'Published' ? (
                      <Badge className="bg-green-100 text-green-800 border-green-200">Published</Badge>
                    ) : (
                      <Badge className="bg-slate-100 text-slate-500 border-slate-200">Disabled</Badge>
                    )}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy||loading||t.backendTemplate}
                        onClick={() => openEditDialog(t)}
                        className="text-[10px] h-8 text-slate-600 hover:text-[#800000] hover:bg-red-50 flex items-center gap-1 cursor-pointer"
                      >
                        <Edit className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={busy||loading||t.backendTemplate} title={t.backendTemplate?'Use the private template workflow to archive a file version':undefined} onClick={() => handleToggleStatus(t)}
                        className="text-[10px] h-8 text-slate-600 hover:text-[#800000] hover:bg-red-50 flex items-center gap-1 cursor-pointer"
                      >
                        {t.status === 'Published' ? (
                          <>
                            <ToggleLeft className="h-4.5 w-4.5 text-green-600" />
                            Disable
                          </>
                        ) : (
                          <>
                            <ToggleRight className="h-4.5 w-4.5 text-slate-400" />
                            Publish
                          </>
                        )}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </TabsContent>
      </Tabs>
    </div>
  );
}
