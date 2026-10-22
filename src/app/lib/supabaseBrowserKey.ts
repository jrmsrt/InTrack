/** Configuration guard only; Supabase verifies the key/session cryptographically. */
export function assertBrowserSupabaseKey(key:string):void {
  if(key.startsWith('sb_publishable_'))return;
  if(key.startsWith('sb_secret_'))throw new Error('Use a publishable key in the browser, never a secret key.');
  try{
    const parts=key.split('.');if(parts.length!==3)throw new Error('Invalid API key');
    const encoded=parts[1].replaceAll('-','+').replaceAll('_','/');
    const payload=JSON.parse(atob(encoded+'='.repeat((4-encoded.length%4)%4)));
    if(payload.role==='anon')return;
  }catch{ /* Never print key material. */ }
  throw new Error('Use a Supabase publishable key or legacy anon API key in the browser. Service-role keys and user tokens are not browser API keys.');
}
