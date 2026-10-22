import { emailOtpGateway, normalizeOtpEmail, type EmailOtpAuth } from './emailOtp.ts';

export interface PasswordCheckAuth {
  signInWithPassword(input: { email: string; password: string }): Promise<{ data: { session: unknown }; error: { code?: string; message?: string } | null }>;
  signOut(input: { scope: 'local' }): Promise<{ error: unknown }>;
}
export type LoginEmailLookup = (email: string) => Promise<boolean | null>;

async function passwordFailure(error: { code?: string; message?: string } | null, email: string, lookup?: LoginEmailLookup): Promise<Error> {
  if (error?.code === 'email_not_confirmed') return new Error('Email is not verified. Check your inbox or contact your coordinator.');
  if (error?.code === 'invalid_credentials') {
    if (lookup) {
      try {
        const exists = await lookup(email);
        if (exists === false) return new Error('Email is not recognized for sign-in. Check your PUP Webmail address.');
        if (exists === true) return new Error('Password is incorrect. Please try again.');
      } catch { /* Keep an honest combined error if the lookup is unavailable. */ }
    }
    return new Error('Sign-in failed. Check your email and password.');
  }
  return new Error('Unable to sign in right now. Please retry.');
}
/** Keep the password session; the database denies access until email proof and MFA. */
export async function requestPasswordEmailLogin(auth: PasswordCheckAuth & EmailOtpAuth, email: string, password: string, lookup?: LoginEmailLookup): Promise<string> {
  const normalized=normalizeOtpEmail(email);
  if(!password)throw new Error('Enter your password.');
  const result=await auth.signInWithPassword({email:normalized,password});
  if(result.error||!result.data.session)throw await passwordFailure(result.error,normalized,lookup);
  try{return await emailOtpGateway(auth).request(normalized);}
  catch(error){await auth.signOut({scope:'local'});throw error;}
}
export async function verifyLoginPassword(check: PasswordCheckAuth, email: string, password: string, lookup?: LoginEmailLookup, onVerified?: (session: unknown) => Promise<void>): Promise<string> {
  const normalized = normalizeOtpEmail(email);
  if (!password) throw new Error('Enter your password.');
  const result = await check.signInWithPassword({ email: normalized, password });
  if (result.error || !result.data.session) throw await passwordFailure(result.error,normalized,lookup);
  try { await onVerified?.(result.data.session); }
  finally {
    const revoked = await check.signOut({ scope: 'local' });
    if (revoked.error) throw new Error('Unable to complete sign-in. Please retry.');
  }
  return normalized;
}
