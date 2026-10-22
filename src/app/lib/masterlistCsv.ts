export interface MasterlistCsvRow {studentNumber:string;email:string;name:string;programCode:string;section:string;}
/** Bounded RFC-style CSV parser. Domain validity and authority are rechecked by SQL. */
export function readMasterlistCsvRecords(input:string):string[][] {
  if(new TextEncoder().encode(input).length>524288)throw new Error('CSV exceeds 512 KB.');
  const text=input.replace(/^\uFEFF/,'');const rows:string[][]=[];
  let row:string[]=[],field='',quoted=false,afterQuote=false;
  const cell=()=>{row.push(field);field='';afterQuote=false;};
  const record=()=>{cell();if(row.some(value=>value.trim()))rows.push(row);row=[];if(rows.length>501)throw new Error('Import supports at most 500 student rows.');};
  for(let i=0;i<text.length;i++){
    const char=text[i];
    if(quoted){if(char==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;afterQuote=true;}}else field+=char;continue;}
    if(afterQuote && ![',','\r','\n'].includes(char))throw new Error('Unexpected text after a quoted CSV field.');
    if(char==='"'){if(field)throw new Error('Quote must start a CSV field.');quoted=true;}
    else if(char===',')cell();
    else if(char==='\r'||char==='\n'){record();if(char==='\r'&&text[i+1]==='\n')i++;}
    else field+=char;
  }
  if(quoted)throw new Error('Unclosed CSV quote.');
  if(field||row.length||afterQuote)record();
  return rows;
}
/** Internal/operator format remains compatible with existing administration tools. */
export function parseMasterlistCsv(input:string):MasterlistCsvRow[] {
  const rows=readMasterlistCsvRecords(input);
  const headers=rows.shift()?.map(v=>v.trim());const required=['studentNumber','email','name','programCode','section'];
  if(!headers||headers.length!==5||new Set(headers).size!==5||required.some(h=>!headers.includes(h)))throw new Error(`CSV headers must be ${required.join(',')}.`);
  if(!rows.length)throw new Error('CSV contains no students.');
  return rows.map((values,index)=>{if(values.length!==5)throw new Error(`CSV row ${index+2} has the wrong number of columns.`);
    return Object.fromEntries(headers.map((key,i)=>[key,values[i]])) as unknown as MasterlistCsvRow;});
}

export const COORDINATOR_MASTERLIST_COLUMNS=['Student Number','PUP Webmail','Last Name','First Name','Middle Name','Program','Year & Section'] as const;
const cleanNamePart=(value:string)=>value.trim().replace(/\s+/gu,' ');
/** Uses explicit name columns, never guesses which words belong to a surname. */
export function formatImportedStudentName(lastName:string,firstName:string,middleName:string):string {
  const last=cleanNamePart(lastName),first=cleanNamePart(firstName);
  if(!last||!first)throw new Error('Last Name and First Name are required.');
  const initials=cleanNamePart(middleName).replace(/\./g,' ').split(/\s+/u).filter(Boolean).map(part=>{
    const initial=part.match(/\p{L}/u)?.[0];
    if(!initial)throw new Error('Middle Name must contain a name or be left blank.');
    return initial.toLocaleUpperCase()+'.';
  }).join('');
  return `${last}, ${first}${initials?' '+initials:''}`;
}
export function parseCoordinatorMasterlistRows(input:string[][]):MasterlistCsvRow[]{
  const rows=input.filter(row=>row.some(value=>value.trim()));
  const headers=rows.shift()?.map(value=>value.trim().replace(/\s+/gu,' ').toLowerCase());
  const required=COORDINATOR_MASTERLIST_COLUMNS.map(value=>value.toLowerCase());
  if(!headers||headers.length!==7||new Set(headers).size!==7||required.some(h=>!headers.includes(h)))throw new Error(`Masterlist headers must be ${COORDINATOR_MASTERLIST_COLUMNS.join(', ')}.`);
  if(!rows.length)throw new Error('Masterlist contains no students.');
  if(rows.length>500)throw new Error('Import supports at most 500 student rows.');
  if(new TextEncoder().encode(JSON.stringify(input)).length>524288)throw new Error('Masterlist data exceeds 512 KB.');
  return rows.map((values,index)=>{
    if(values.length!==7)throw new Error(`Masterlist row ${index+2} has the wrong number of columns.`);
    const value=(header:string)=>values[headers.indexOf(header)].trim();
    try{return {studentNumber:value('student number'),email:value('pup webmail'),name:formatImportedStudentName(value('last name'),value('first name'),value('middle name')),programCode:value('program'),section:value('year & section')};}
    catch(error){throw new Error(`Masterlist row ${index+2}: ${error instanceof Error?error.message:'Invalid name.'}`);}
  });
}
export function parseCoordinatorMasterlistCsv(input:string):MasterlistCsvRow[]{return parseCoordinatorMasterlistRows(readMasterlistCsvRecords(input));}
export function csvCell(value:unknown):string {
  let text=value==null?'':String(value);
  if(/^[\s\uFEFF]*[=+\-@]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
}
