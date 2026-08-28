/**
 * Election Conflict of Interest (COI) Verification Service
 * Issue: #3601 - Implement 'Automated "Conflict of Interest" Detection' for Elections
 */

import { supabase } from "@/lib/supabase/client";

export interface CoiVerificationResult {
  hasConflict: boolean;
  conflictingClub?: string;
  conflictingRole?: string;
  message: string;
}

export async function verifyCandidateConflictOfInterest(
  clubId: string,
  candidateUserId: string,
  position = "Executive"
): Promise<CoiVerificationResult> {
  try {
    const { data, error } = await supabase.rpc("verify_candidate_conflict_of_interest", {
      p_club_id: clubId,
      p_candidate_user_id: candidateUserId,
      p_position: position,
    });

    if (error) throw error;

    if (data && typeof data === "object") {
      return {
        hasConflict: Boolean(data.has_conflict),
        conflictingClub: data.conflicting_club,
        conflictingRole: data.conflicting_role,
        message:
          data.message ||
          (data.has_conflict
            ? `You cannot run for this position while holding an executive role in ${data.conflicting_club || "another club"}.`
            : "No conflict of interest detected."),
      };
    }

    return {
      hasConflict: false,
      message: "No conflict of interest detected.",
    };
  } catch (err: any) {
    console.error("COI verification error:", err);
    return {
      hasConflict: false,
      message: err.message || "Failed to verify conflict of interest.",
    };
  }
}
