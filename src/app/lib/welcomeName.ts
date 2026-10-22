/** Greetings only: keep full display names in records, tables and account details. */
export function welcomeName(displayName: string | null | undefined): string {
  const name=displayName?.trim()||'';
  if(!name)return 'there';
  const comma=name.indexOf(',');
  if(comma>=0){
    const given=name.slice(comma+1).trim().replace(/(?:\s+[A-Za-z]\.?)+$/u,'').trim();
    return given||'there';
  }
  return name.split(/\s+/)[0];
}
