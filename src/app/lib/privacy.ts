import type { UserRole } from '../context/AuthContext';

export const PRIVACY_NOTICE_VERSION = '2026-09-12';
export const PRIVACY_NOTICE_EFFECTIVE_DATE = 'September 12, 2026';
export const LOCAL_TEST_NOTICE_VERSION = 'dev-test-only';

/** A development notice is available only on the local development stack. */
export function localTestNoticeAvailable(version:string|null,configuration={development:import.meta.env.DEV,url:import.meta.env.VITE_SUPABASE_URL||''}):boolean {
  if(version!==LOCAL_TEST_NOTICE_VERSION||!configuration.development)return false;
  try{const url=new URL(configuration.url);return url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)&&url.port==='54321';}catch{return false;}
}
export function readablePrivacyNotice(version:string|null):boolean {return version===PRIVACY_NOTICE_VERSION||localTestNoticeAvailable(version);}
export function privacyNoticeUrl(version:string|null):string {return version===LOCAL_TEST_NOTICE_VERSION?'/privacy-notice?version=dev-test-only':'/privacy-notice';}

export interface PrivacyConsentRecord {
  email: string;
  role: UserRole;
  version: string;
  acceptedAt: string;
}

