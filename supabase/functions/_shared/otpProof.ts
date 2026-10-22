/** Call only with claims verified by Supabase Auth, never browser/user metadata. */
export function hasOtpProof(claims: unknown): boolean {
  if (!claims || typeof claims !== 'object' || !('amr' in claims)) return false;
  return Array.isArray(claims.amr) && claims.amr.some(method =>
    method && typeof method === 'object' && method.method === 'otp');
}

/** Only use claims returned by Auth getClaims() after token verification. */
export function hasVerifiedLoginProof(claims: unknown): boolean {
  return hasPasswordProof(claims) && typeof claims === 'object' && claims !== null && 'aal' in claims && claims.aal === 'aal2';
}

export function hasPasswordProof(claims:unknown):boolean {
  if(!claims||typeof claims!=='object'||!('amr' in claims))return false;
  return Array.isArray(claims.amr)&&claims.amr.some(item=>item&&typeof item==='object'&&item.method==='password');
}
/** Both arguments must first pass Auth getClaims signature/expiry verification. */
export function canBindLoginEmail(password:unknown,email:unknown,now=Math.floor(Date.now()/1000)):boolean {
  if(!hasPasswordProof(password)||!hasOtpProof(email))return false;
  const p=password as Record<string,unknown>,e=email as Record<string,unknown>;
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return typeof p.sub==='string'&&p.sub===e.sub
    &&typeof p.session_id==='string'&&uuid.test(p.session_id)
    &&typeof e.session_id==='string'&&uuid.test(e.session_id)&&p.session_id!==e.session_id
    &&[[p,'password'],[e,'otp']].every(([claims,method])=>{
      const amr=(claims as Record<string,unknown>).amr;
      return Array.isArray(amr)&&amr.some(item=>item&&item.method===method&&typeof item.timestamp==='number'&&Number.isFinite(item.timestamp)&&item.timestamp<=now+5&&item.timestamp>=now-900);
    })
    &&[p.iat,e.iat].every(value=>typeof value==='number'&&Number.isFinite(value)&&value<=now+5&&value>=now-900);
}
