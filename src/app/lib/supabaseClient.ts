import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createSupabaseApiFetch } from './supabaseApiFetch.ts';
import { assertBrowserSupabaseKey } from './supabaseBrowserKey.ts';

let client: SupabaseClient | undefined;

/** Isolated Auth for email-code verification and current-password checks. */
export function createPasswordCheckClient(): SupabaseClient {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key || !['http:', 'https:'].includes(new URL(url).protocol)) {
    throw new Error('Supabase sign-in is not configured. Contact your coordinator.');
  }
  assertBrowserSupabaseKey(key);
  return createClient(url, key, {
    global: { fetch: createSupabaseApiFetch(key) },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'intrack-password-check' },
  });
}

/** Shared connection for real Auth, protected identity and backend workspaces. */
export function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !publishableKey) {
    throw new Error('Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY before using Supabase.');
  }
  const parsedUrl = new URL(url);
  if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
    throw new Error('The Supabase URL must use HTTP or HTTPS.');
  }
  assertBrowserSupabaseKey(publishableKey);

  client = createClient(url, publishableKey, {
    global: { fetch: createSupabaseApiFetch(publishableKey) },
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
  });
  return client;
}
