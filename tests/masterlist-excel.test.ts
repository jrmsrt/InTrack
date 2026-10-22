import {test} from 'node:test';
import assert from 'node:assert/strict';
import {zipSync,strToU8} from 'fflate';
import {parseMasterlistFile,excelRowsToMasterlist,assertMasterlistXlsxArchive} from '../src/app/lib/masterlistImport.ts';

const headers=['Student Number','PUP Webmail','Last Name','First Name','Middle Name','Program','Year & Section'];
const student=['2023-00001-PQ-0','student@iskolarngbayan.pup.edu.ph','Dela Cruz','Juan Carlo','Reyes','BSIT','3-1'];
function workbook(rows:string[][],extra:Record<string,Uint8Array>={}){
 const escape=(s:string)=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
 const sheet=`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows.map((r,i)=>`<row r="${i+1}">${r.map((v,j)=>`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${escape(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
 const entries={
  '[Content_Types].xml':strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>'),
  'xl/workbook.xml':strToU8('<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Masterlist" sheetId="1" r:id="rId1"/></sheets></workbook>'),
  'xl/_rels/workbook.xml.rels':strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'),
  'xl/worksheets/sheet1.xml':strToU8(sheet),...extra
 };
 return new File([zipSync(entries)],'masterlist.xlsx');
}
test('real XLSX bytes use the same records and preserve complete names and identifiers',async()=>{
 const rows=await parseMasterlistFile(workbook([headers,student]));
 assert.deepEqual(rows,[{studentNumber:student[0],email:student[1],name:'Dela Cruz, Juan Carlo R.',programCode:'BSIT',section:'3-1'}]);
});
test('Excel supports reordered columns and blank rows but never silently drops incomplete students',()=>{
 const rows=excelRowsToMasterlist([['Last Name','PUP Webmail','Student Number','Year & Section','Program','Middle Name','First Name'],[],['Dela Cruz','student@example.test','00001','3-1','BSIT','','Juan'],['Santos',null,'00002','3-1','BSIT','','Maria']]);
 assert.equal(rows[0].studentNumber,'00001');assert.equal(rows[1].email,'');assert.equal(rows.length,2);
 assert.throws(()=>excelRowsToMasterlist([headers,['00001','student@example.test','Santos','Juan',null,'BSIT',123]]),/Text/);
 assert.throws(()=>excelRowsToMasterlist([headers,[...student,'unmapped']]),/extra columns/);
 assert.throws(()=>excelRowsToMasterlist([headers,...Array.from({length:501},()=>student)]),/500/);
});
test('unsupported, encrypted-looking and oversized archives fail before any whitelist action',async()=>{
 await assert.rejects(()=>parseMasterlistFile(new File(['x'],'old.xls')),/Save older/);
 await assert.rejects(()=>parseMasterlistFile(new File(['not Excel'],'fake.xlsx')),/valid/);
 await assert.rejects(()=>parseMasterlistFile(new File([new Uint8Array(524289)],'large.xlsx')),/512 KB/);
 const oversized=workbook([headers,student],{'xl/oversized.xml':new Uint8Array(8*1024*1024+1)});
 await assert.rejects(()=>parseMasterlistFile(oversized),/8 MB/);
 const macros=workbook([headers,student],{'xl/vbaProject.bin':new Uint8Array([1])});
 await assert.rejects(()=>parseMasterlistFile(macros),/valid/);
 const corrupt=await workbook([headers,student]).arrayBuffer();new DataView(corrupt).setUint16(6,1,true);
 // Mark the central entry encrypted too; neither encrypted nor malformed input is accepted.
 const bytes=new DataView(corrupt);for(let i=0;i<corrupt.byteLength-4;i++)if(bytes.getUint32(i,true)===0x02014b50){bytes.setUint16(i+8,1,true);break;}
 assert.throws(()=>assertMasterlistXlsxArchive(corrupt),/valid/);
});
test('CSV remains supported without invoking the Excel reader',async()=>{
 const file=new File([headers.join(',')+'\n'+student.map(v=>'"'+v+'"').join(',')],'masterlist.csv');
 assert.equal((await parseMasterlistFile(file))[0].name,'Dela Cruz, Juan Carlo R.');
});

function datedSection(format:string){
 const cells=[headers,student].map((row,i)=>`<row r="${i+1}">${row.map((v,j)=>i===1&&j===6?'<c r="G2" s="0"><v>46025</v></c>':`<c r="${String.fromCharCode(65+j)}${i+1}" t="inlineStr"><is><t>${v.replaceAll('&','&amp;')}</t></is></c>`).join('')}</row>`).join('');
 return workbook([headers,student],{
  'xl/styles.xml':strToU8(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><numFmts count="1"><numFmt numFmtId="164" formatCode="${format}"/></numFmts><cellXfs count="1"><xf numFmtId="164" applyNumberFormat="1"/></cellXfs></styleSheet>`),
  'xl/worksheets/sheet1.xml':strToU8(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${cells}</sheetData></worksheet>`)
 });
}
test('date-converted sections follow the explicit Excel display order rather than guessing',async()=>{
 assert.equal((await parseMasterlistFile(datedSection('d-m')))[0].section,'3-1');
 assert.equal((await parseMasterlistFile(datedSection('m-d')))[0].section,'1-3');
 assert.equal((await parseMasterlistFile(datedSection('dd-mm')))[0].section,'03-01');
});
test('ambiguous/full-date sections remain rejected with the precise row and column',async()=>{
 await assert.rejects(()=>parseMasterlistFile(datedSection('yyyy-mm-dd')),/row 2, Year & Section.*date/);
});
