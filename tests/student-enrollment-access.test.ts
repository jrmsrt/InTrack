import {test} from 'node:test';
import assert from 'node:assert/strict';
import {studentRouteNeedsEnrollment} from '../src/app/lib/studentEnrollmentAccess.ts';

test('unenrolled students may open only the dashboard, including direct module and print URLs',()=>{
 assert.equal(studentRouteNeedsEnrollment('/dashboard',false),false);
 assert.equal(studentRouteNeedsEnrollment('/dashboard/',false),false);
 for(const path of ['/pre-ojt','/moa','/forms-templates','/attendance','/tasks','/weekly-journal','/during-ojt','/post-ojt','/portfolio','/messages','/settings','/print-dtr/record','/print-weekly-journal/record'])assert.equal(studentRouteNeedsEnrollment(path,false),true,path);
});
test('enrollment removes only the initial account lock; individual module stage rules remain separate',()=>{
 for(const path of ['/dashboard','/pre-ojt','/forms-templates','/attendance','/messages','/settings'])assert.equal(studentRouteNeedsEnrollment(path,true),false,path);
});
