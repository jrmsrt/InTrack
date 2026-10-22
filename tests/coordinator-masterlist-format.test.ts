import {test} from 'node:test';
import assert from 'node:assert/strict';
import {COORDINATOR_MASTERLIST_COLUMNS,formatImportedStudentName,parseCoordinatorMasterlistCsv,parseCoordinatorMasterlistRows} from '../src/app/lib/masterlistCsv.ts';

test('explicit surname and first-name columns preserve compound names and produce middle initials',()=>{
 assert.equal(formatImportedStudentName('Dela Cruz','Juan Carlo','Reyes'),'Dela Cruz, Juan Carlo R.');
 assert.equal(formatImportedStudentName(' De los Santos ',' Ana  María ','R. D.'),'De los Santos, Ana María R.D.');
 assert.equal(formatImportedStudentName('Santos','Maria',''),'Santos, Maria');
 assert.equal(formatImportedStudentName('Peña','José','iñigo'),'Peña, José I.');
 assert.throws(()=>formatImportedStudentName('','Juan','Reyes'),/required/);
 assert.throws(()=>formatImportedStudentName('Dela Cruz','','Reyes'),/required/);
});
test('coordinator CSV maps all seven columns into the existing backend import contract',()=>{
 const text=COORDINATOR_MASTERLIST_COLUMNS.join(',')+'\r\n2023-00001-PQ-0,juan@iskolarngbayan.pup.edu.ph,Dela Cruz,Juan Carlo,Reyes,BSIT,4-1';
 assert.deepEqual(parseCoordinatorMasterlistCsv(text),[{studentNumber:'2023-00001-PQ-0',email:'juan@iskolarngbayan.pup.edu.ph',name:'Dela Cruz, Juan Carlo R.',programCode:'BSIT',section:'4-1'}]);
});
test('header whitespace and case are accepted, missing/duplicate columns and incomplete names fail',()=>{
 const headers=['Student   Number','PUP Webmail','Last Name','First Name','Middle Name','Program','Year &   Section'];
 assert.equal(parseCoordinatorMasterlistRows([headers,['00001','j@example.test','Dela Cruz','Juan Carlo','','BSIT','4-1']])[0].name,'Dela Cruz, Juan Carlo');
 assert.throws(()=>parseCoordinatorMasterlistRows([headers,['00001','j@example.test','','Juan','','BSIT','4-1']]),/Last Name/);
 assert.throws(()=>parseCoordinatorMasterlistRows([headers.slice(0,6),['a','b','c','d','e','f']]),/headers/);
 assert.throws(()=>parseCoordinatorMasterlistRows([['PUP Webmail',...headers.slice(1)],['a','b','c','d','e','f','g']]),/headers/);
 assert.throws(()=>parseCoordinatorMasterlistCsv('studentNumber,email,name,programCode,section\na,b,c,d,e'),/headers/);
});
