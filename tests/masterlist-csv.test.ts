import {test} from 'node:test';
import assert from 'node:assert/strict';
import {parseMasterlistCsv,csvCell} from '../src/app/lib/masterlistCsv.ts';
test('CSV preserves full names, quoted commas, quotes, BOM and CRLF without guessing identity',()=>{
  const rows=parseMasterlistCsv('\uFEFFstudentNumber,email,name,programCode,section\r\nT1,test@example.test,"Last, Full ""Name""",BSIT,4-1\r\n');
  assert.equal(rows[0].name,'Last, Full "Name"');assert.equal(rows[0].studentNumber,'T1');
});
test('CSV rejects malformed quotes, duplicate headers, missing columns and empty input',()=>{
  for(const text of ['', 'email,email,name,programCode,section\na,b,c,d,e','studentNumber,email,name,programCode,section\na,b,"missing,d,e',
    'studentNumber,email,name,programCode,section\na,b,c,d','studentNumber,email,name,programCode,section\na,b,"name"x,d,e'])assert.throws(()=>parseMasterlistCsv(text));
});
test('CSV spreadsheet cells neutralize formulas including whitespace prefixes and escape quotes',()=>{
  for(const text of ['=1+1','  =HYPERLINK("url")','+1','-1','@SUM(A1)','\tcommand'])assert.ok(csvCell(text).startsWith('"\''));
  assert.equal(csvCell('plain "name"'),'"plain ""name"""');assert.equal(csvCell(null),'""');
});
