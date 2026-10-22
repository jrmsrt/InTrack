import test from 'node:test';
import assert from 'node:assert/strict';
import { documentBlob, documentKind, isDocumentUrl } from '../src/app/lib/uploadedDocument.ts';

test('uploaded bytes survive persistence without a sample fallback', async () => {
  const bytes = '%PDF-1.7\nactual uploaded bytes\n';
  const stored = JSON.parse(JSON.stringify({ url: `data:application/pdf;base64,${btoa(bytes)}`, name: 'requirement.pdf', type: 'application/pdf' }));
  const blob = documentBlob(stored);
  assert.equal(await blob?.text(), bytes);
  assert.equal(blob?.type, 'application/pdf');
});
test('PDF and raster images are embedded, active content is downloadable', () => {
  assert.equal(documentKind({url:'/actual.pdf',name:'actual.pdf'}),'pdf');
  assert.equal(documentKind({url:'/photo',name:'photo.png',type:'image/png'}),'image');
  assert.equal(documentKind({url:'/image.svg',name:'image.svg',type:'image/svg+xml'}),'other');
  assert.equal(documentKind({url:'/page.html',name:'page.html',type:'text/html'}),'other');
});
test('HTML upload bytes are served as a download rather than executable HTML', () => {
  const blob=documentBlob({url:`data:text/html;base64,${btoa('<script>alert(1)</script>')}`,name:'page.html',type:'text/html'});
  assert.equal(blob?.type,'application/octet-stream');
});
test('actual URL references are retained without inventing file content', () => {
  assert.equal(documentBlob({url:'/files/123',name:'report.pdf'}),null);
  assert.ok(isDocumentUrl('https://example.com/actual.pdf'));
  assert.ok(isDocumentUrl('/files/123'));
  assert.equal(isDocumentUrl(''),false);
  assert.equal(isDocumentUrl('javascript:alert(1)'),false);
  assert.equal(isDocumentUrl('//untrusted.example/file'),false);
});
test('malformed persisted data never becomes a sample document', () => {
  assert.equal(documentBlob({url:'data:invalid',name:'report.pdf'}),null);
  assert.throws(()=>documentBlob({url:'data:application/pdf;base64,%%%invalid',name:'report.pdf'}));
});
