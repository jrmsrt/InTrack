import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2 } from 'lucide-react';
import { buttonVariants } from '../ui/button';
import { cn } from '../ui/utils';
import { documentBlob, documentKind, isDocumentUrl, UploadedDocument } from '../../lib/uploadedDocument';
import {openNativeDocument} from './requirementFiles';

export function NoFileState() {
  return null;
}

function useDocumentUrl(file?: UploadedDocument | null) {
  const [resolved, setResolved] = useState<{ source: string; url: string } | null>(null);
  useEffect(() => {
    if (!file?.url || !isDocumentUrl(file.url)) { setResolved(null); return; }
    let url = '';
    try {
      const blob = documentBlob(file);
      url = blob ? URL.createObjectURL(blob) : file.url;
      setResolved({ source: file.url, url });
    } catch { setResolved({ source: file.url, url: '' }); }
    return () => { if (url.startsWith('blob:') && url !== file.url) URL.revokeObjectURL(url); };
  }, [file?.url, file?.type, file?.name]);
  return resolved?.source === file?.url ? resolved?.url : null;
}

export function NativeFilePreviewLink({ file, children = 'Open File', className }: {
  file?: UploadedDocument | null; children?: React.ReactNode; className?: string;
}) {
  const url = useDocumentUrl(file);
  if(file?.backendDocumentId)return <button type="button" onClick={()=>openNativeDocument(file)} className={cn('inline-flex min-w-0 max-w-full items-center gap-1.5 text-sm font-medium text-[#800000] hover:underline',className)}><ExternalLink className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{children}</span></button>;
  if (!file?.url || !isDocumentUrl(file.url)) return <NoFileState />;
  if (!url) return <span role="status" className="text-sm text-slate-500">{url === '' ? 'File unavailable' : 'Preparing file…'}</span>;
  return <a href={url} target="_blank" rel="noopener noreferrer"
    className={cn(
      'inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-sm align-middle text-sm font-medium text-[#800000] underline-offset-2 transition-colors hover:text-[#600000] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#800000]/35 focus-visible:ring-offset-2 cursor-pointer',
      className
    )}>
    <ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0 truncate">{children}</span>
  </a>;
}

export function IntegratedFileViewer({ file }: { file?: UploadedDocument | null }) {
  const url = useDocumentUrl(file);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setLoaded(false); setFailed(false); }, [url]);
  if (!file?.url || !isDocumentUrl(file.url)) return <NoFileState />;
  const kind = documentKind(file);
  return <section className="min-w-0 space-y-3" aria-label="Document preview">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="min-w-0 break-all text-sm font-medium text-slate-700">{file.name}</p>
      <NativeFilePreviewLink file={file}>Open in New Tab</NativeFilePreviewLink>
    </div>
    {kind === 'other' ? <p className="rounded-lg border p-4 text-sm text-slate-600">This format cannot be embedded. Open the actual file using the action above; your review remains here.</p> :
      <div className="relative min-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-100">
        {!loaded && !failed && <p role="status" className="flex items-center gap-2 p-3 text-sm text-slate-600"><Loader2 className="h-4 w-4 animate-spin" />Loading document…</p>}
        {failed || url === '' ? <p role="alert" className="p-4 text-sm text-red-700">Unable to display this file. Try Open in New Tab.</p> : url && (kind === 'image' ?
          <img src={url} alt={file.name} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="mx-auto max-h-[70vh] max-w-full object-contain" /> :
          <iframe src={url} title={file.name} onLoad={() => setLoaded(true)} onError={() => setFailed(true)} className="h-[55vh] min-h-80 w-full lg:h-[70vh]" />)}
      </div>}
    {kind === 'pdf' && <p className="text-xs text-slate-500">If your browser cannot display the PDF here, use Open in New Tab. Your remarks will stay in this review.</p>}
  </section>;
}

export function DocumentReviewWorkspace({ file, children, document }: {
  file?: UploadedDocument | null; children: React.ReactNode; document?: React.ReactNode;
}) {
  return <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,1fr)]">
    <div className="min-w-0">{document || <IntegratedFileViewer file={file} />}</div>
    <section aria-label="Review panel" className="min-w-0 space-y-4 lg:sticky lg:top-0 lg:self-start">{children}</section>
  </div>;
}

/** Existing system-generated records are real records, not uploaded files. */
export function GeneratedRecordViewer({ url, title }: { url: string; title: string }) {
  return <section className="min-w-0 space-y-3" aria-label="Generated document">
    <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{title}</p>
      <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: 'secondary', size: 'sm' })}><ExternalLink className="h-4 w-4" />Open in New Tab</a>
    </div>
    <iframe title={title} src={url} className="h-[55vh] min-h-80 w-full rounded-lg border border-slate-200 bg-white lg:h-[70vh]" />
  </section>;
}

export function PortfolioFiles({ files, mode = 'preview' }: { files: UploadedDocument[]; mode?: 'preview' | 'review' }) {
  const [selected, setSelected] = useState(0);
  if (!files.length) return <NoFileState />;
  if (mode === 'preview') return <div className="flex flex-col items-start gap-2">{files.map((file, index) => <NativeFilePreviewLink key={index} file={file}>{file.name}</NativeFilePreviewLink>)}</div>;
  return <div className="space-y-3"><label className="block text-sm font-medium">Portfolio attachment
    <select value={Math.min(selected, files.length - 1)} onChange={event => setSelected(Number(event.target.value))} className="mt-2 block w-full rounded-md border border-slate-200 bg-slate-100 p-2 text-sm">
      {files.map((file, index) => <option key={index} value={index}>{file.name}</option>)}
    </select></label><IntegratedFileViewer file={files[Math.min(selected, files.length - 1)]} /></div>;
}

