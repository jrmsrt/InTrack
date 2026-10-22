import { toast } from 'sonner';
import type { StudentOJTProfile } from '../../context/OJTContext';
import { documentBlob, isDocumentUrl, UploadedDocument } from '../../lib/uploadedDocument';

export interface RequirementFilePreview {
  studentId?: string;
  studentName: string;
  reqName: string;
  fileName: string;
  stage: 'Pre-OJT' | 'During-OJT' | 'Post-OJT' | 'MOA' | 'Portfolio';
}

export function resolveRequirementDocument(students: StudentOJTProfile[], preview: RequirementFilePreview): UploadedDocument | null {
  const matches = students.filter(s => preview.studentId ? s.studentId === preview.studentId : s.name === preview.studentName);
  if (matches.length !== 1) return null;
  const student = matches[0];
  if (preview.stage === 'MOA') return student.moaState.file ?? null;
  const requirements = preview.stage === 'Pre-OJT' ? student.preOJTRequirements : preview.stage === 'During-OJT' ? student.duringOJTRequirements : student.postOJTRequirements;
  return requirements.find(r => r.name === preview.reqName)?.file ?? null;
}

// For existing action menus, open synchronously in the user gesture so the
// browser does not treat the new tab as an unsolicited popup.
export function openNativeDocument(file?: UploadedDocument | null) {
  if(file?.backendDocumentId){
    const popup=window.open('about:blank','_blank');
    if(popup)popup.opener=null;
    void import('../../lib/requirementGateway').then(({requirementDownload})=>requirementDownload(file.backendDocumentId!,file.backendRole||'coordinator')).then(url=>{if(popup)popup.location.replace(url);else toast.error('Allow the document window, then retry.');}).catch(()=>{popup?.close();toast.error('Unable to open this protected file. Check access and retry.');});
    return;
  }
  if (!file?.url || !isDocumentUrl(file.url)) return;
  try {
    const blob = documentBlob(file);
    const url = blob ? URL.createObjectURL(blob) : file.url;
    window.open(url, '_blank', 'noopener,noreferrer');
    if (blob) window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch { toast.error('Unable to open the uploaded file.'); }
}
