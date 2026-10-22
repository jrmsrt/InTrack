import {test} from 'node:test';
import assert from 'node:assert/strict';
import {coordinatorDashboardModel} from '../src/app/lib/coordinatorDashboard.ts';
import type {EnrollmentProjection} from '../src/app/lib/backendGateway.ts';

test('dashboard uses saved approved minutes and scoped programs without sample activity',()=>{
 const row=(overrides:Partial<EnrollmentProjection>)=>({id:'one',studentId:'student',programId:'it',requiredMinutes:30000,creditedMinutes:600,...overrides}) as EnrollmentProjection;
 const result=coordinatorDashboardModel([row({}),row({id:'two',requiredMinutes:3000,creditedMinutes:60})],[{id:'it',code:'BSIT'},{id:'oa',code:'BSOA'}],8,[]);
 assert.deepEqual(result.stats,{totalInterns:8,activePrograms:2,totalHoursLogged:11});
 assert.equal(result.programs[0].students,1);
 assert.equal(result.programs[0].completion,2);
 assert.equal(result.programs[1].hours,0);
 assert.deepEqual(result.activities,[]);
});

test('empty database shows empty counts and only server notifications become activity',()=>{
 const result=coordinatorDashboardModel([],[],0,[{id:'notice',created_at:'2026-10-16T00:00:00Z',content:{kind:'requirement_submitted'}}]);
 assert.equal(result.stats.totalHoursLogged,0);
 assert.equal(result.activities[0].action,'requirement submitted');
 assert.equal(result.activities.length,1);
 assert.deepEqual(result.hours,[]);
});
