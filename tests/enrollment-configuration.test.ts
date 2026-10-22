import {test} from 'node:test';
import assert from 'node:assert/strict';
import {proposedPracticumRequirements,publicationRequirements,termLabel,fixedEvidenceReviewer} from '../src/app/lib/enrollmentConfiguration.ts';
test('proposed configuration retains every original requirement without inventing reviewer approval',()=>{
 const rows=proposedPracticumRequirements();assert.equal(rows.length,46);assert.ok(rows.every(r=>r.reviewer===''));
 assert.ok(rows.some(r=>r.title==='Good Moral Certificate'));assert.ok(rows.some(r=>r.title==='Attendance OJT Orientation'));assert.ok(rows.some(r=>r.title==='Certificate (OJT Orientation)'));
 assert.equal(rows.find(r=>r.title.includes('(MOA)'))?.evidenceType,'moa');
 assert.throws(()=>publicationRequirements(rows),/reviewer/);
});
test('published deadlines use end of day in Manila, while blank deadlines remain explicit nulls',()=>{
 const rows=proposedPracticumRequirements().map(r=>({...r,reviewer:fixedEvidenceReviewer(r.evidenceType)||'adviser'}));rows[0].deadline='2026-11-01';
 const payload=publicationRequirements(rows);assert.equal(payload[0].recurrence.dueAt,'2026-11-01T15:59:59.000Z');assert.equal(payload[1].recurrence.dueAt,null);assert.equal('deadline' in payload[0],false);
 assert.equal(termLabel('summer'),'Summer term');assert.equal(termLabel('2'),'Second semester');
});
