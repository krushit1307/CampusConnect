import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

export type MfaEnforcedSupabase = SupabaseClient<Database>;

export interface VerifiedTotpFactor {
  id: string;
}

export interface MfaStatus {
  currentLevel: string | null;
  nextLevel: string | null;
  verifiedTotpFactor: VerifiedTotpFactor | null;
  enforcedUser: boolean;
}

/**
 * Collects the Authenticator Assurance Level, the user's verified TOTP factor
 * (if any), and whether MFA is enforced for this user (club executives and
 * system admins) in a single pass.
 */
export async function getMfaStatus(supabase: MfaEnforcedSupabase): Promise<MfaStatus> {
  const [aalRes, factorsRes, enforcedRes] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
    supabase.rpc("is_mfa_enforced_user"),
  ]);

  const verifiedFactor = factorsRes.data?.totp?.find((f) => f.status === "verified") ?? null;

  return {
    currentLevel: aalRes.data?.currentLevel ?? null,
    nextLevel: aalRes.data?.nextLevel ?? null,
    verifiedTotpFactor: verifiedFactor ? { id: verifiedFactor.id } : null,
    enforcedUser: Boolean(enforcedRes.data),
  };
}

/**
 * True when the signed-in user must complete a TOTP challenge before continuing:
 * their session is still at aal1 (password only), they own a verified TOTP
 * factor, and they are a club executive / system admin.
 */
export async function requiresMfaChallenge(supabase: MfaEnforcedSupabase): Promise<boolean> {
  const status = await getMfaStatus(supabase);
  return (
    status.currentLevel === "aal1" &&
    status.nextLevel === "aal2" &&
    status.verifiedTotpFactor !== null &&
    status.enforcedUser
  );
}
