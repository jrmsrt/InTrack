import { PortfolioFiles } from '../../components/forms/FileViewer';
import React, { useState } from 'react';
import { useOJT } from '../../context/OJTContext';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { toast } from 'sonner';
import { 
  Award, 
  CheckCircle2, 
  AlertTriangle, 
  FileText, 
  Download, 
  ChevronRight,
  BookOpen,
  Lock,
  Sparkles
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { portfolioContents } from '../../domain/portfolioContents';

export function PortfolioBuilder() {
  const { user } = useAuth();
  const { students, submitPortfolio } = useOJT();

  const [generating, setGenerating] = useState(false);
  const [downloadReady, setDownloadReady] = useState(false);

  const student = students.find(s => s.studentId === user?.id || s.email === user?.email);

  if (!student) {
    return (
      <div className="p-6 text-center font-sans">
        <h2 className="text-xl font-bold text-red-600">Error</h2>
        <p className="text-slate-600 mt-2">Student record not found.</p>
      </div>
    );
  }

  // Check approval of all documents
  const preApproved = student.preOJTRequirements.every(r => r.status === 'Approved');
  const moaApproved = student.moaState.status === 'Approved';
  const duringApproved = student.duringOJTRequirements.every(r => r.status === 'Approved');
  const postApproved = student.postOJTRequirements.every(r => r.status === 'Approved');
  
  const allClear = preApproved && moaApproved && duringApproved && postApproved;

  // Compile missing items
  const missingRequirements: string[] = [];
  if (!preApproved) {
    student.preOJTRequirements.forEach(r => {
      if (r.status !== 'Approved') missingRequirements.push(`Pre-OJT: ${r.name}`);
    });
  }
  if (!moaApproved) {
    missingRequirements.push("Pre-OJT: Approved Memorandum of Agreement (MOA)");
  }
  if (!duringApproved) {
    student.duringOJTRequirements.forEach(r => {
      if (r.status !== 'Approved') missingRequirements.push(`During-OJT: ${r.name}`);
    });
  }
  if (!postApproved) {
    student.postOJTRequirements.forEach(r => {
      if (r.status !== 'Approved') missingRequirements.push(`Post-OJT: ${r.name}`);
    });
  }

  const handleGeneratePortfolio = () => {
    if (!allClear) {
      toast.error("Generation Locked", {
        description: "You must resolve all missing checklists before compiling."
      });
      return;
    }

    setGenerating(true);
    setTimeout(() => {
      setGenerating(false);
      setDownloadReady(true);
      submitPortfolio(student.studentId);
      
      // Celebrate!
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });
      toast.success("Portfolio submitted for review", {
        description: "Your submission status has been updated. Open the available attachments below."
      });
    }, 2500);
  };

  const handleDownload = () => {
    toast.info("No compiled PDF file is available. Open the uploaded portfolio attachments below.");
  };

  return (
    <div className="space-y-6 font-sans">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Portfolio Builder</h1>
          <p className="text-slate-500 text-sm mt-0.5">Assemble and generate your final OJT compilation report with official appendices.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
      {/* Status Checklist and Verification */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800">Portfolio Status</CardTitle>
              <CardDescription>System checks on requirements approval.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 text-xs font-semibold">
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border">
                  <span className="text-slate-600">Pre-OJT Clearances</span>
                  {preApproved && moaApproved ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Incomplete</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border">
                  <span className="text-slate-600">During-OJT Clearances</span>
                  {duringApproved ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Incomplete</Badge>
                  )}
                </div>
                <div className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border">
                  <span className="text-slate-600">Post-OJT Clearances</span>
                  {postApproved ? (
                    <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>
                  ) : (
                    <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Incomplete</Badge>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <Button
                  onClick={handleGeneratePortfolio}
                  disabled={!allClear || generating}
                  className="w-full bg-[#800000] hover:bg-[#6b0000] text-white font-bold py-2.5 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  {generating ? (
                    <>Compiling Chapters...</>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate Portfolio
                    </>
                  )}
                </Button>

                <Button
                  onClick={handleDownload}
                  disabled
                  className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40"
                >
                  <Download className="h-4 w-4" />
                  No compiled PDF available
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Missing Indicator panel */}
          {missingRequirements.length > 0 && (
            <Card className="border-red-200 bg-red-50/20 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-1.5 text-red-700 font-bold text-sm">
                  <AlertTriangle className="h-4.5 w-4.5 shrink-0" />
                  <h4>Missing Requirements Indicator</h4>
                </div>
                <CardDescription className="text-xs text-red-600">You must secure Adviser approval for these files before downloading.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="text-xs text-slate-600 space-y-1.5 list-disc pl-4 font-light max-h-48 overflow-y-auto">
                  {missingRequirements.map((item, index) => (
                    <li key={index} className="leading-tight">{item}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {student.coordinatorPortfolioStatus === 'Approved' ? (
            <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-start gap-1.5 font-bold">
              <CheckCircle2 className="h-4.5 w-4.5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p>Final Portfolio Approved</p>
                <p className="text-[10px] text-slate-500 font-normal mt-0.5">Coordinator remarks: "{student.coordinatorPortfolioRemarks || 'Final requirements verified.'}"</p>
              </div>
            </div>
          ) : student.portfolioApproved ? (
            <div className="p-3 bg-green-50 border border-green-200 text-green-800 rounded-xl text-xs flex items-start gap-1.5 font-bold">
              <CheckCircle2 className="h-4.5 w-4.5 text-green-600 shrink-0 mt-0.5" />
              <div>
                <p>Adviser Endorsed</p>
                <p className="text-[10px] text-slate-500 font-normal mt-0.5">Awaiting final coordinator review.</p>
              </div>
            </div>
          ) : student.coordinatorPortfolioStatus === 'Needs Revision' ? (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-xs flex items-start gap-1.5 font-bold">
              <AlertTriangle className="h-4.5 w-4.5 shrink-0 mt-0.5" />
              <div><p>Coordinator Requested Revision</p><p className="text-[10px] font-normal mt-0.5">{student.coordinatorPortfolioRemarks || 'Please revise and resubmit the portfolio.'}</p></div>
            </div>
          ) : null}
        </div>

        {/* Portfolio Table of Contents Preview */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-sm border-slate-200">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800">Portfolio Table of Contents</CardTitle>
              <CardDescription>Based on the coordinator’s template list. Page references show the template example; your final pagination may differ.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {[...new Set(portfolioContents.map(item => item.group))].map(group => (
                <section key={group} aria-label={group}>
                  <h2 className="text-sm font-semibold text-[#800000] mb-2">{group}</h2>
                  <ol className="space-y-2 text-sm">
                    {portfolioContents.filter(item => item.group === group).map(item => (
                      <li key={item.id} className="flex justify-between gap-4 border-b border-slate-100 pb-2">
                        <span>{item.title}</span><span className="text-slate-500 shrink-0">{item.templatePage}</span>
                      </li>
                    ))}
                  </ol>
                </section>
              ))}
              <p className="text-xs text-slate-500">Existing requirements remain in your checklists, including items outside this template. This outline does not certify that sections are uploaded or approved.</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-slate-200">
            <CardHeader className="border-b border-slate-100">
              <CardTitle className="text-base font-bold text-slate-800">Uploaded Portfolio Attachments</CardTitle>
              <CardDescription>Open an actual uploaded attachment in a new tab.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 text-xs text-slate-700 space-y-4"><PortfolioFiles files={[...student.preOJTRequirements, ...student.duringOJTRequirements, ...student.postOJTRequirements, student.moaState].flatMap(item => item.file ? [item.file] : [])} /></CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
