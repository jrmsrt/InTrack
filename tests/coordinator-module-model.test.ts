import {test} from 'node:test';
import assert from 'node:assert/strict';
import {projectCoordinatorStudents,type CoordinatorModuleSnapshot} from '../src/app/lib/coordinatorModuleModel.ts';

const snapshot=():CoordinatorModuleSnapshot=>({enrollments:[],requirements:[],directory:{programs:[],policies:[],terms:[],memberships:[],eligibleStudents:[]},portfolios:{},notifications:[],announcements:[],templates:[]});
test('restored module layouts receive no sample students when no real enrollments exist',()=>{
 const data=snapshot();data.directory.eligibleStudents.push({id:'eligible',name:'Not enrolled',profileId:'profile',programId:'program',studentNumber:'S1',email:'student@example.test',section:'4-1'});
 assert.deepEqual(projectCoordinatorStudents(data),[]);
});
test('original requirement cards preserve distinct adviser and coordinator decisions and protected document IDs',()=>{
 const data=snapshot();data.enrollments.push({id:'enrollment',studentId:'profile',studentName:'Complete Display Name',programId:'program',programCode:'BSIT',policyVersionId:'policy',component:1,termId:'term',lifecycle:'during_ojt',outcome:'active',revision:3,requiredMinutes:30000,creditedMinutes:120,remainingMinutes:29880,adviserId:null,clearance:'issued',moaStatus:'NO MOA',moaVersionId:null,openSessions:0});
 data.requirements.push({id:'requirement',requirementRevision:0,title:'Resume',code:'CV',reviewer:'both',evidenceType:'file',allowedStages:['pre_ojt'],dueAt:null,waived:false,enrollmentId:'enrollment',enrollmentRevision:3,lifecycle:'during_ojt',outcome:'active',studentName:'Complete Display Name',programCode:'BSIT',submission:{id:'submission',version:1,revision:2,status:'under_review',submittedAt:'2026-10-16T00:00:00Z',documentId:'document',reviewStartedAt:null},history:[{id:'submission',version:1,status:'under_review',submittedAt:'2026-10-16T00:00:00Z',documentId:'document',current:true,verifications:[],reviews:[{role:'adviser',decision:'approved',remarks:'Reviewed',at:'2026-10-16T00:01:00Z'}]}]});
 const student=projectCoordinatorStudents(data)[0];
 assert.equal(student.name,'Complete Display Name');
 assert.equal(student.stage,'Stage 2: During OJT');
 assert.equal(student.totalHoursRendered,2);
 assert.equal(student.requiredHours,500);
 assert.equal(student.preOJTRequirements[0].status,'Approved');
 assert.equal(student.preOJTRequirements[0].coordinatorStatus,'Pending');
 assert.equal(student.preOJTRequirements[0].file?.backendDocumentId,'document');
 assert.equal(student.companyName,'');
 assert.equal(student.portfolioApproved,false);
});
