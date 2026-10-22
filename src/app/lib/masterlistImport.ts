import {parseCoordinatorMasterlistCsv,parseCoordinatorMasterlistRows,type MasterlistCsvRow} from './masterlistCsv.ts';

export const MASTERLIST_MAX_BYTES=524288;
const attributes=(xml:string)=>Object.fromEntries(Array.from(xml.matchAll(/([\w:]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g),m=>[m[1],m[2]??m[3]]));

/** Recover only an explicit day/month display in Year & Section, never infer
 * date order from the locale, filename, or date value alone. */
export async function restoreDisplayedSections(bytes:ArrayBuffer,rows:unknown[][]):Promise<unknown[][]>{
 const column=rows[0]?.findIndex(value=>typeof value==='string'&&value.trim().replace(/\s+/g,' ').toLowerCase()==='year & section')??-1;
 if(column<0||!rows.some(row=>row[column] instanceof Date))return rows;
 assertMasterlistXlsxArchive(bytes);
 const {unzipSync,strFromU8}=await import('fflate');
 const files=unzipSync(new Uint8Array(bytes));
 const xml=(name:string)=>files[name]?strFromU8(files[name]):'';
 const workbook=xml('xl/workbook.xml');
 const sheet=workbook.match(/<sheet\b([^>]*)\/?\s*>/);
 const relationId=sheet?attributes(sheet[1])['r:id']:null;
 const relation=Array.from(xml('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?\s*>/g)).map(m=>attributes(m[1])).find(r=>r.Id===relationId&&r.TargetMode!=='External');
 if(!relation?.Target)return rows;
 const path=new URL(relation.Target,'https://workbook.invalid/xl/workbook.xml').pathname.slice(1);
 const styles=xml('xl/styles.xml');
 const formats=new Map(Array.from(styles.matchAll(/<numFmt\b([^>]*)\/?\s*>/g)).map(m=>{const a=attributes(m[1]);return [a.numFmtId,a.formatCode] as const;}));
 const cellFormats=Array.from((styles.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1]||'').matchAll(/<xf\b([^>]*)>/g)).map(m=>attributes(m[1]).numFmtId);
 const result=rows.map(row=>[...row]);
 for(const match of xml(path).matchAll(/<c\b([^>]*)>[\s\S]*?<\/c>/g)){
  const cell=attributes(match[1]),position=cell.r?.match(/^([A-Z]+)(\d+)$/);if(!position)continue;
  const cellColumn=Array.from(position[1]).reduce((n,char)=>n*26+char.charCodeAt(0)-64,0)-1,row=Number(position[2])-1;
  if(cellColumn!==column)continue;
  const date=result[row]?.[column];if(!(date instanceof Date)||Number.isNaN(date.getTime()))continue;
  const format=formats.get(cellFormats[Number(cell.s||0)])?.toLowerCase().replace(/\\([/-])/g,'$1').replace(/"([/-])"/g,'$1');
  const parts=format?.match(/^(d{1,2}|m{1,2})([-/])(d{1,2}|m{1,2})$/);
  if(!parts||parts[1][0]===parts[3][0])continue;
  const value=(token:string)=>String(token[0]==='d'?date.getUTCDate():date.getUTCMonth()+1).padStart(token.length,'0');
  result[row][column]=value(parts[1])+parts[2]+value(parts[3]);
 }
 return result;
}
/** Bound the ZIP contents before parsing the workbook XML. No macros are accepted. */
export function assertMasterlistXlsxArchive(bytes:ArrayBuffer){
 const view=new DataView(bytes),data=new Uint8Array(bytes);
 const invalid=()=>{throw new Error('Choose a valid, unencrypted Excel .xlsx workbook.');};
 if(bytes.byteLength>MASTERLIST_MAX_BYTES)throw new Error('Masterlist exceeds 512 KB.');
 if(bytes.byteLength<22||view.getUint32(0,true)!==0x04034b50)invalid();
 let end=-1;
 for(let i=data.length-22;i>=Math.max(0,data.length-65557);i--)if(view.getUint32(i,true)===0x06054b50&&i+22+view.getUint16(i+20,true)===data.length){end=i;break;}
 if(end<0)invalid();
 const count=view.getUint16(end+10,true),offset=view.getUint32(end+16,true),size=view.getUint32(end+12,true);
 if(view.getUint16(end+4,true)||view.getUint16(end+6,true)||view.getUint16(end+8,true)!==count||count<1||count>128||offset+size!==end)invalid();
 let cursor=offset,expanded=0;const names=new Set<string>();
 for(let i=0;i<count;i++){
  if(cursor+46>end||view.getUint32(cursor,true)!==0x02014b50)invalid();
  const flags=view.getUint16(cursor+8,true),method=view.getUint16(cursor+10,true),compressed=view.getUint32(cursor+20,true),uncompressed=view.getUint32(cursor+24,true),nameLength=view.getUint16(cursor+28,true),extra=view.getUint16(cursor+30,true),comment=view.getUint16(cursor+32,true),local=view.getUint32(cursor+42,true);
  if((flags&1)||![0,8].includes(method)||!nameLength||cursor+46+nameLength+extra+comment>end||local+30>offset||view.getUint32(local,true)!==0x04034b50)invalid();
  const name=new TextDecoder().decode(data.subarray(cursor+46,cursor+46+nameLength));
  if(names.has(name)||/vbaProject\.bin$/i.test(name)||name.includes('..')||(view.getUint16(local+6,true)&1)||view.getUint16(local+8,true)!==method)invalid();
  const bodyStart=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
  if(bodyStart+compressed>offset)invalid();
  expanded+=uncompressed;
  if(expanded>8*1024*1024)throw new Error('Excel workbook expands beyond 8 MB. Remove unused rows, columns and extra worksheets.');
  names.add(name);cursor+=46+nameLength+extra+comment;
 }
 if(cursor!==end||!names.has('[Content_Types].xml')||!names.has('xl/workbook.xml'))invalid();
}

/** Preserve text identifiers; dates/numbers may have already lost their formatting. */
export function excelRowsToMasterlist(rows:unknown[][]):MasterlistCsvRow[]{
 const meaningful=rows.filter(row=>row.some(value=>value!=null&&value!==''));
 if(meaningful.length>501)throw new Error('Import supports at most 500 student rows.');
 const records=meaningful.map((row,index)=>{
  const cells=[...row];while(cells.length&&cells.at(-1)==null)cells.pop();
  if(cells.length>7)throw new Error(`Excel row ${index+1} has extra columns.`);
  if(index>0)while(cells.length<7)cells.push(null);
  return cells.map((value,column)=>{
   if(value!=null&&typeof value!=='string')throw new Error(`Excel row ${index+1}, ${String(meaningful[0]?.[column]||'column '+(column+1))}: Excel stored this cell as a ${value instanceof Date?'date':'number or other non-text value'}. Set the cell to Text and re-enter its intended value. No students were imported.`);
   return String(value??'');
  });
 });
 return parseCoordinatorMasterlistRows(records);
}

export async function parseMasterlistFile(file:Pick<File,'name'|'size'|'text'|'arrayBuffer'>):Promise<MasterlistCsvRow[]>{
 if(file.size>MASTERLIST_MAX_BYTES)throw new Error('Masterlist exceeds 512 KB.');
 if(/\.csv$/i.test(file.name))return parseCoordinatorMasterlistCsv(await file.text());
 if(!/\.xlsx$/i.test(file.name))throw new Error('Choose CSV or Excel .xlsx. Save older .xls files as .xlsx first.');
 const bytes=await file.arrayBuffer();assertMasterlistXlsxArchive(bytes);
 let rows:unknown[][];
 try{const {readSheet}=await import('read-excel-file/universal');rows=await readSheet(bytes,1);}
 catch{throw new Error('Unable to read this workbook. Save it as an unencrypted .xlsx file with the masterlist on the first worksheet.');}
 return excelRowsToMasterlist(await restoreDisplayedSections(bytes,rows));
}
