/** Opaque API keys authenticate through apikey; only session/legacy JWTs belong in Bearer. */
export function createSupabaseApiFetch(
  apiKey: string,
  transport: typeof fetch = globalThis.fetch,
): typeof fetch {
  const opaque = apiKey.startsWith('sb_secret_') || apiKey.startsWith('sb_publishable_');
  return async (input, init) => {
    const headers = new Headers(input instanceof Request ? input.headers : undefined);
    new Headers(init?.headers).forEach((value, name) => headers.set(name, value));
    if (opaque && headers.get('Authorization') === `Bearer ${apiKey}`) {
      headers.delete('Authorization');
    }
    return transport(input, { ...init, headers });
  };
}
