import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/alert';
import {
  AlertCircle,
  ChevronRight,
  Download,
  ExternalLink,
  FileCheck,
  FileText,
  Info
} from 'lucide-react';

const documents = [
  {
    title: 'Updated guidelines for the resumption of face-to-face issuance of student medical clearance',
    href: 'https://drive.google.com/file/d/1GZuFdsdJ9Ond3oVS3HEKa9K44jxNFNS7/view?usp=drive_link'
  },
  {
    title: 'Internship Guidelines',
    href: 'https://drive.google.com/file/d/1kLIANF_2C6lJL_70VRGvBpcAsj_5OmdI/view?usp=sharing'
  },
  {
    title: 'Process Manual 2021',
    href: 'https://drive.google.com/file/d/16mGSkwxllPjGjgEiGKf5jWm2kJBDJ42W/view?usp=drive_link'
  }
];

const forms = [
  {
    title: 'OJT Monitoring Sheet',
    href: 'https://docs.google.com/document/d/1Ss4C_sed_nXMoqT-uq8ftU5SX7zLRi_5/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'
  },
  {
    title: 'Letter for Company Visitation',
    href: 'https://docs.google.com/document/d/1oozJ2WTrK9E6k7kTnw9s9pcqprfklcPY/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'
  },
  {
    title: 'OJT Visitation Narrative Sample Format',
    href: 'https://docs.google.com/document/d/1_Ep_aK7nbnUc-rBRDV4iMAMZG3Q32R8g/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'
  },
  {
    title: 'Certificate of Appearance OJT Visitation',
    href: 'https://docs.google.com/document/d/1-pri8cgNaiCajkuwb4zloAbfM-KPBc5q/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'
  },
  {
    title: 'Rubric for OJT Portfolio',
    href: 'https://docs.google.com/document/d/1YrfMmuZujn4OqgIaJDxXnpafharUzkHx/edit?usp=sharing&ouid=108649410443671808721&rtpof=true&sd=true'
  }
];

function ResourceList({ items }: { items: { title: string; href?: string }[] }) {
  return (
    <ul className="space-y-2.5 text-sm">
      {items.map((item) => (
        <li key={item.title} className="flex items-center gap-2">
          <ChevronRight className="h-4 w-4 text-[#800000] shrink-0" />
          {item.href ? (
            <a
              href={item.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-slate-650 hover:text-[#800000] hover:underline flex items-center gap-1 font-medium cursor-pointer transition-colors"
            >
              {item.title}
              <ExternalLink className="h-3.5 w-3.5 text-slate-400 shrink-0" />
            </a>
          ) : (
            <span className="text-slate-650 font-medium">{item.title}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AdviserFormsTemplates() {
  return (
    <div className="space-y-4 w-full max-w-[1400px] mx-auto font-sans">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 font-sans">Forms and Templates</h1>
        <p className="text-slate-550 text-sm md:text-base mt-1">
          Open official adviser documents and template links for monitoring, visitation, and portfolio review.
        </p>
      </div>

      <Alert className="border-blue-200 bg-blue-50/50 p-4">
        <Info className="h-5 w-5 text-blue-700 mt-0.5" />
        <AlertTitle className="text-blue-950 font-bold text-sm uppercase tracking-wider">Download Instructions</AlertTitle>
        <AlertDescription className="text-blue-900 text-sm mt-1.5 leading-relaxed">
          All forms should be directly downloaded in your device (pc/laptop). <strong>Do not edit the file directly in the google doc.</strong>
        </AlertDescription>
      </Alert>

      <div className="space-y-4">
        <p className="text-sm text-slate-650 leading-relaxed">
          Click the specific button links below to access OJT documents, forms, and templates needed for adviser monitoring. Specific form and template has specific instructions included. Kindly read the instructions carefully.
        </p>

        <Card className="shadow-sm border-slate-200 overflow-hidden">
          <CardHeader className="bg-slate-50/50 border-b border-slate-105 px-5 !pt-4 !pb-4">
            <CardTitle className="text-sm font-bold text-[#800000] flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0" />
              Documents
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-1.5 space-y-3.5">
            <p className="text-sm text-slate-500">
              Reference documents for adviser review, student clearance guidance, and internship procedures.
            </p>

            <ResourceList items={documents} />

            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-550 italic flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-[#800000] shrink-0" />
              <span>Review the latest official copy before advising students or endorsing requirements.</span>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-slate-200">
          <CardHeader className="bg-slate-50/50 border-b border-slate-105 px-5 !pt-4 !pb-4">
            <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-[#800000]" />
              Forms
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 pt-1.5 space-y-3.5">
            <p className="text-sm text-slate-500">
              Templates used for OJT monitoring, company visitation, appearance certification, and portfolio evaluation.
            </p>

            <ResourceList items={forms} />

            <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs text-slate-550 italic flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-[#800000] shrink-0" />
              <span>Note: Yellow highlight should be removed once appropriate details are encoded before finalization and printing.</span>
            </div>
          </CardContent>
        </Card>

        <div className="pt-1.5">
          <Button asChild className="bg-[#800000] hover:bg-[#6b0000] text-white text-sm font-semibold px-5 py-2.5 h-10 cursor-pointer transition-colors shadow-sm">
            <a
              href="https://drive.google.com/file/d/1kLIANF_2C6lJL_70VRGvBpcAsj_5OmdI/view?usp=sharing"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5"
            >
              <Download className="h-4 w-4" />
              Internship Guidelines
              <ExternalLink className="h-3.5 w-3.5 ml-0.5" />
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
