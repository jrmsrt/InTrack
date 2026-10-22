import {test} from 'node:test';
import assert from 'node:assert/strict';
import {loadAdviserPortalData} from '../src/app/lib/adviserPortalData.ts';
const person={id:'teacher',displayName:'Test Adviser'};
test('an adviser without classes receives empty records without fabricated students or detail requests',async()=>{
 const calls:string[]=[];
 const data=await loadAdviserPortalData(person,'/adviser/dashboard',{
  enrollments:async()=>[],requirements:async()=>[],rpc:async(name:string)=>{calls.push(name);return name==='intrack_class_join_administration'?{classes:[],requests:[]}:{items:[]};},
 } as any);
 assert.deepEqual(data.students,[]);assert.deepEqual(data.classes,[]);
 assert.deepEqual(calls.sort(),['intrack_class_join_administration','intrack_list_notifications']);
});
test('only assigned students and owned class metadata enter the original adviser modules',async()=>{
 const calls:{name:string;args:any}[]=[];
 const own={id:'enrollment',studentId:'student',studentName:'Dela Cruz, Juan R.',programId:'it',programCode:'BSIT',policyVersionId:'policy',component:1,termId:'term',lifecycle:'pre_ojt',outcome:'active',revision:0,requiredMinutes:30000,creditedMinutes:0,remainingMinutes:30000,adviserId:'teacher',clearance:'not_issued',moaStatus:'NO MOA',moaVersionId:null,openSessions:0};
 const data=await loadAdviserPortalData(person,'/adviser/students',{
  enrollments:async()=>[own,{...own,id:'foreign-enrollment',studentId:'foreign',adviserId:'other'}],requirements:async()=>[],
  rpc:async(name:string,args:any)=>{calls.push({name,args});if(name==='intrack_class_join_administration')return{classes:[{id:'owned',adviserId:'teacher'},{id:'foreign-class',adviserId:'other'}]};if(name==='intrack_class_roster')return[{id:'enrollment',studentId:'student',name:own.studentName,studentNumber:'2026-001',email:'student@example.test',section:'4-1'}];return{items:[]};},
 } as any);
 assert.equal(data.students.length,1);assert.equal(data.students[0].email,'student@example.test');assert.equal(data.students[0].section,'4-1');assert.equal(data.students[0].adviserId,'teacher');
 assert.equal(calls.filter(c=>c.name==='intrack_class_roster').length,1);assert.ok(calls.every(c=>c.args.actor_role==='adviser'));assert.ok(!calls.some(c=>c.args.class_id==='foreign-class'));
});
test('record loading errors remain errors instead of being presented as an empty class',async()=>{
 await assert.rejects(loadAdviserPortalData(person,'/adviser/journals',{enrollments:async()=>{throw new Error('Scope denied');},requirements:async()=>[],rpc:async()=>({classes:[],items:[]})} as any),/Scope denied/);
});
