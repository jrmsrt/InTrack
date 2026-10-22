import { getSupabaseClient } from './supabaseClient';
import { readablePrivacyNotice } from './privacy';

export async function completePasswordDecision(noticeVersion: string | null, decision: 'keep' | 'change', password?: string) {
  if (!noticeVersion || !readablePrivacyNotice(noticeVersion)) throw new Error('The current privacy notice is not available on this page. Contact your coordinator.');
  const { data, error } = await getSupabaseClient().functions.invoke('activate-account', {
    body: { decision, noticeVersion, acceptNotice: true, ...(decision === 'change' ? { password } : {}) },
  });
  if (error || !data?.activated) throw new Error('Your password decision could not be completed. Your account has not been granted access. Retry or contact your coordinator.');
}
