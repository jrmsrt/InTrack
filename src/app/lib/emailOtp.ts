type AuthResult={error:{message?:string;status?:number;code?:string}|null;data?:unknown};
// Matches auth.email.max_frequency; Supabase remains the enforcement boundary.
export const OTP_REQUEST_INTERVAL_MS = 12_000;
export interface EmailOtpAuth {
 signInWithOtp(input:{email:string;options:{shouldCreateUser:false}}):Promise<AuthResult>;
 verifyOtp(input:{email:string;token:string;type:'email'}):Promise<AuthResult>;
}
export function normalizeOtpEmail(value:string):string {
 const email=value.trim().toLowerCase();
 if(email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Enter your complete email address.');
 return email;
}
/** Supabase owns issuance, expiry, storage and verification. No browser OTPs. */
export function emailOtpGateway(auth:EmailOtpAuth){return {
 async request(value:string):Promise<string>{
  const email=normalizeOtpEmail(value);
  const {error}=await auth.signInWithOtp({email,options:{shouldCreateUser:false}});
  if(error){
   if(error.status===429||error.code==='over_email_send_rate_limit'||error.code==='over_request_rate_limit')throw new Error('Please wait before requesting another code.');
   // Do not reveal whether an account exists. Provider/configuration failures
   // remain failures; never claim successful delivery without confirmation.
   throw new Error('Unable to request a sign-in code. Check the address or contact your coordinator if this continues.');
  }
  return email;
 },
 async verify(value:string,code:string):Promise<void>{
  const email=normalizeOtpEmail(value),token=code.trim();
  if(!/^\d{6}$/.test(token))throw new Error('Enter the six-digit code from your email.');
  const {error}=await auth.verifyOtp({email,token,type:'email'});
  if(error)throw new Error('The code was not accepted. Check it or request a new code.');
 }
};}
