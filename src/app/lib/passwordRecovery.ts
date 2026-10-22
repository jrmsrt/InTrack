import { normalizeOtpEmail } from './emailOtp.ts';

export type RecoveryAccountStatus = 'ready' | 'activation_required' | 'unavailable';
export const RECOVERY_RESEND_INTERVAL_MS = 60_000;

export async function requestPasswordRecovery(
  auth: { resetPasswordForEmail(email: string): Promise<{ error: unknown }> },
  checkAccount: (email: string) => Promise<RecoveryAccountStatus>,
  email: string,
): Promise<string> {
  const address = normalizeOtpEmail(email);
  const status = await checkAccount(address);
  if (status === 'activation_required') {
    throw new Error('Your account is not activated yet. Go back to Login and sign in with your PUP Webmail and the default password provided by your administrator to activate your account first.');
  }
  if (status !== 'ready') {
    throw new Error('This email is not eligible for password recovery. Check your PUP Webmail address or contact your OJT Coordinator.');
  }
  const { error } = await auth.resetPasswordForEmail(address);
  if (error) throw new Error('Unable to send the recovery code. Please wait and try again.');
  return address;
}

export interface RecoveryAuth {
  verifyOtp(input:{email:string;token:string;type:'recovery'}):Promise<{data:{session:unknown};error:unknown}>;
  mfa:{
    listFactors():Promise<{data:{totp:{id:string;status:string}[]};error:unknown}>;
    getAuthenticatorAssuranceLevel():Promise<{data:{currentLevel:string|null}|null;error:unknown}>;
  };
  updateUser(input:{password:string}):Promise<{error:unknown}>;
  signOut(input:{scope:'local'}):Promise<{error:unknown}>;
}

export function validRecoveryPassword(password:string){
  return password.length>=12&&password.length<=256&&/[A-Z]/.test(password)&&/[a-z]/.test(password)&&/\d/.test(password)&&/[^A-Za-z0-9]/.test(password);
}

/** Only recognized error codes become user-facing instructions; never provider details. */
export function recoveryPasswordError(error: unknown): Error {
  const detail = error && typeof error === 'object' ? error as { code?: string; status?: number } : {};
  switch (detail.code) {
    case 'same_password': return new Error('Your new password must be different from your current password.');
    case 'weak_password': return new Error('Choose a stronger password that meets all the requirements.');
    case 'insufficient_aal':
    case 'authenticator_required': return new Error('Verify your authenticator code before changing your password.');
    case 'recovery_verification_required':
    case 'session_not_found':
    case 'session_expired':
    case 'bad_jwt':
    case 'jwt_expired':
    case 'refresh_token_not_found': return new Error('Your recovery session has expired. Request a new recovery code.');
    case 'account_not_activated': return new Error('Activate your account using your default credentials before resetting your password.');
  }
  if (detail.status === 401) return new Error('Your recovery session has expired. Request a new recovery code.');
  if (detail.status === 429) return new Error('Too many attempts. Please wait before trying again.');
  return new Error('Unable to save your new password right now. Please try again.');
}

/** A recovery session is isolated from the application's ordinary sign-in session. */
export async function openPasswordRecovery(auth:RecoveryAuth,email:string,code:string){
  const address=normalizeOtpEmail(email),token=code.trim();
  if(!/^\d{6}$/.test(token))throw new Error('Enter the six-digit recovery code from your email.');
  const verified=await auth.verifyOtp({email:address,token,type:'recovery'});
  if(verified.error||!verified.data.session)throw new Error('The recovery code is incorrect, expired, or already used. Check the code or request a new one.');
  const factors=await auth.mfa.listFactors();
  if(factors.error){
    await auth.signOut({scope:'local'});
    throw new Error('Unable to check your authenticator. Request a new recovery code.');
  }
  return factors.data.totp.find(item=>item.status==='verified')?.id??null;
}

/** The caller either transfers this verified session or explicitly signs it out. */
export async function saveRecoveredPassword(auth:Pick<RecoveryAuth,'mfa'|'updateUser'>,password:string,confirmation:string){
  if(!validRecoveryPassword(password))throw new Error('Use 12–256 characters with uppercase, lowercase, a number and a special character.');
  if(password!==confirmation)throw new Error('Passwords do not match.');
  // Re-read factors and assurance immediately before the write; UI state is not proof.
  const factors=await auth.mfa.listFactors();
  if(factors.error)throw new Error('Unable to check your authenticator. Please retry.');
  if(factors.data.totp.some(item=>item.status==='verified')){
    const assurance=await auth.mfa.getAuthenticatorAssuranceLevel();
    if(assurance.error||assurance.data?.currentLevel!=='aal2')throw new Error('Verify your authenticator code before changing your password.');
  }
  const result=await auth.updateUser({password});
  if(result.error)throw recoveryPasswordError(result.error);
}
