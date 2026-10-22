import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studentAccountProjection,type StudentPortalProfile} from '../src/app/lib/studentPortalModel.ts';
const profile:StudentPortalProfile={id:'self',name:'Own Student',studentNumber:'OWN',email:'self@example.test',section:'4-1',programs:[{id:'it',code:'BSIT'}],policies:[{programId:'it',component:1,requiredMinutes:30000,yearLevel:4}],advisers:[],placements:[]};
test('unenrolled student dashboard uses saved account and curriculum without fabricated progress or clearance',()=>{
 const student=studentAccountProjection(profile);
 assert.equal(student.name,'Own Student');assert.equal(student.studentId,'self');assert.equal(student.requiredHours,500);assert.equal(student.totalHoursRendered,0);assert.equal(student.stage,'Stage 1: Pre-OJT');assert.equal(student.moaState.status,'NO MOA');assert.deepEqual(student.attendanceHistory,[]);assert.equal(student.portfolioApproved,false);
});
import {mergeRequirementChecklist,createRequirementChecklist} from '../src/app/domain/requirementChecklist.ts';
test('student requirement checklists remain visible before enrollment with no invented submissions',()=>{
 const student=studentAccountProjection(profile);
 assert.equal(student.preOJTRequirements.length,15);
 assert.ok(student.preOJTRequirements.some(r=>r.name==='Good Moral Certificate'));
 assert.ok(student.preOJTRequirements.some(r=>r.name==='Attendance OJT Orientation'));
 assert.ok(student.preOJTRequirements.some(r=>r.name==='Certificate (OJT Orientation)'));
 assert.ok(student.preOJTRequirements.every(r=>r.status==='Not Submitted'&&r.fileName===null));
 assert.equal(student.duringOJTRequirements.length,26);assert.equal(student.postOJTRequirements.length,5);
});
test('saved statuses and extra requirements survive the original checklist merge',()=>{
 const saved=[{name:'Registration Card/Form',status:'Approved' as const,fileName:'registration.pdf',remarks:'Reviewed'}, {name:'Extra Program Requirement',status:'Needs Revision' as const,fileName:'extra.pdf',remarks:'Update required'}];
 const merged=mergeRequirementChecklist('pre',saved);
 const registration=merged.find(r=>r.name==='Certificate of Registration (COR)')!;
 assert.equal(registration.status,'Approved');assert.equal(registration.fileName,'registration.pdf');assert.equal(registration.remarks,'Reviewed');
 assert.equal(merged.length,16);assert.equal(merged.at(-1)?.name,'Extra Program Requirement');
 assert.equal(merged.find(r=>r.name==='Resume')?.status,'Not Submitted');
 merged[1].status='Approved';assert.equal(createRequirementChecklist('pre')[1].status,'Not Submitted');
 assert.equal(saved[0].name,'Registration Card/Form');
});
