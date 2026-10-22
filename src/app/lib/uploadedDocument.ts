export interface UploadedDocument {
  /** Protected files resolve through the authorized download endpoint on demand. */
  backendDocumentId?: string;
  backendRole?: 'student' | 'adviser' | 'coordinator';
  url: string;
  name: string;
  type?: string;
}

// Keep the actual bytes in the existing persisted OJT record, not a transient
// page-local blob URL. A filename alone never constitutes an uploaded file.
export function readUploadedDocument(file: File, name = file.name): Promise<UploadedDocument> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Unable to read the selected file. Please try again.'));
    reader.onload = () => resolve({ url: String(reader.result), name, type: file.type });
    reader.readAsDataURL(file);
  });
}

export function documentKind(file: UploadedDocument) {
  if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return 'pdf';
  if (/^image\/(png|jpeg|gif|webp|bmp|avif)$/.test(file.type || '') || /\.(png|jpe?g|gif|webp|bmp|avif)$/i.test(file.name)) return 'image';
  return 'other';
}

export function isDocumentUrl(url: string) {
  return /^(https?:\/\/|blob:|data:[^,]+,|\/(?!\/))/i.test(url);
}

export function documentBlob(file: UploadedDocument): Blob | null {
  if (!file.url.startsWith('data:')) return null;
  const match = file.url.match(/^data:([^;,]*)(;base64)?,([\s\S]*)$/);
  if (!match) return null;
  const data = match[2] ? atob(match[3]) : decodeURIComponent(match[3]);
  const bytes = Uint8Array.from(data, char => char.charCodeAt(0));
  const kind = documentKind(file);
  // Active HTML/SVG uploads must not execute in the application's origin.
  const type = kind === 'pdf' ? 'application/pdf' : kind === 'image' ? (file.type || match[1]) : 'application/octet-stream';
  return new Blob([bytes], { type });
}
