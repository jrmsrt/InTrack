import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseClient } from '../lib/supabaseClient';
import { readMyProtectedIdentity, type ProtectedIdentity } from '../lib/protectedIdentity';
import { clearBackendDrafts } from '../lib/backendDrafts';

export type IdentityLoadState =
  | { state: 'loading' }
  | { state: 'signed_out' }
  | { state: 'loaded'; identity: ProtectedIdentity }
  | { state: 'unavailable'; message: string };

/** Opt-in Supabase identity; never reads legacy demo Auth/OJT authority. */
export function useProtectedIdentity(enabled: boolean) {
  const [result, setResult] = useState<IdentityLoadState>({ state: enabled ? 'loading' : 'signed_out' });
  const generation = useRef(0);
  const subject = useRef<string|null>(null);

  const refresh = useCallback(async (options?: { background?: boolean }) => {
    const request = ++generation.current;
    if (!enabled) { setResult({ state: 'signed_out' }); return; }
    if (!options?.background) setResult({ state: 'loading' });
    try {
      const client = getSupabaseClient();
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      if (!data.session) {
        try{clearBackendDrafts();}catch{ /* Browser storage may be unavailable. */ }
        subject.current=null;
        if (request === generation.current) setResult({ state: 'signed_out' });
        return;
      }
      if(subject.current&&subject.current!==data.session.user.id){try{clearBackendDrafts();}catch{}}
      subject.current=data.session.user.id;
      const identity = await readMyProtectedIdentity();
      if(identity.state!=='ready'){try{clearBackendDrafts();}catch{}}
      if (request === generation.current) setResult({ state: 'loaded', identity });
    } catch {
      if (request === generation.current) setResult({ state: 'unavailable', message: 'Unable to check account access. Retry the identity check.' });
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { ++generation.current; setResult({ state: 'signed_out' }); return; }
    let subscription: { unsubscribe(): void } | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      subscription = getSupabaseClient().auth.onAuthStateChange((event, session) => {
        // Invalidate the previous account immediately; defer SDK calls out of its callback.
        ++generation.current;
        if(event==='SIGNED_OUT'||(subject.current&&subject.current!==session?.user.id)){try{clearBackendDrafts();}catch{}}
        subject.current=session?.user.id||null;
        setResult({ state: session ? 'loading' : 'signed_out' });
        if (timer) clearTimeout(timer);
        if (session) timer = setTimeout(() => { void refresh(); }, 0);
      }).data.subscription;
      void refresh();
    } catch {
      setResult({ state: 'unavailable', message: 'Supabase connection settings are missing or invalid.' });
    }
    return () => { ++generation.current; subscription?.unsubscribe(); if (timer) clearTimeout(timer); };
  }, [enabled, refresh]);

  return { result, refresh };
}
