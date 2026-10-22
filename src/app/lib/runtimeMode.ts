/** Live adapters must replace the legacy contexts before Supabase can be enabled. */
export const backendMode = import.meta.env.VITE_BACKEND_MODE || 'demo';
export const isDemoMode = backendMode === 'demo';
export const demoControlsEnabled = isDemoMode && import.meta.env.DEV;
