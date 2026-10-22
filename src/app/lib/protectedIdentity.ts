import { getSupabaseClient } from './supabaseClient.ts';

export type IdentityRole = 'student' | 'adviser' | 'coordinator';
export type ProtectedIdentity =
  | { state: 'disabled' | 'email_verification_required' | 'unprovisioned' }
  | {
      state: 'setup_required' | 'mfa_required' | 'ready';
      reason: string | null;
      profile: {
        id: string; displayName: string; studentNumber: string | null;
        status: 'invited' | 'active'; activatedAt: string | null; revision: number;
      };
      memberships: { id: string; programId: string; programCode: string; role: IdentityRole }[];
      usableRoles: IdentityRole[];
      staffMfaRequired: boolean;
      privacy: { currentVersion: string | null; acknowledgedAt: string | null };
      whitelisted?: boolean;
      passwordChangeSuggested?: boolean;
    };

/** The RPC derives identity from the caller's session; never pass an actor/role. */
export async function readMyProtectedIdentity(): Promise<ProtectedIdentity> {
  const { data, error } = await getSupabaseClient().rpc('intrack_get_my_identity');
  if (error) throw error;
  if (!data || typeof data !== 'object' || !('state' in data)
    || !['disabled', 'email_verification_required', 'unprovisioned', 'setup_required', 'mfa_required', 'ready'].includes(data.state)) {
    throw new Error('Invalid identity response from Supabase.');
  }
  return data as ProtectedIdentity;
}
