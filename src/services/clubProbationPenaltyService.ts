// =============================================================================
// Service: ClubProbationPenaltyService
// Issue: #4533 - Develop a 'Dynamic "Club Leaderboard" Probation Penalty'
// Description: Manages disciplinary probation checks for gamification point allocation,
// point freezing enforcement, and retroactive point deductions for unauthorized events.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type {
  ClubProbationRecord,
  ProbationPointAwardResult,
  RetroactivePointDeductionResult,
} from "../types/clubProbationPenalty";

export const PROBATION_FROZEN_WARNING =
  "Point Accumulation is FROZEN due to active Disciplinary Probation.";

/**
 * Checks whether a club is currently on active disciplinary probation.
 */
export async function isClubOnActiveProbation(clubId: string): Promise<boolean> {
  if (!clubId) return false;
  const supabase = createClient();

  try {
    // 1. Check club_probations table
    const { data: probationRecords, error: probationError } = await supabase
      .from("club_probations")
      .select("id, status, expires_at")
      .eq("club_id", clubId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .limit(1);

    if (!probationError && probationRecords && probationRecords.length > 0) {
      return true;
    }

    // 2. Check clubs table status column
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("status")
      .eq("id", clubId)
      .maybeSingle();

    if (!clubError && club && club.status === "probation") {
      return true;
    }

    return false;
  } catch (err) {
    console.error("[clubProbationPenaltyService] Error checking probation:", err);
    return false;
  }
}

/**
 * Retrieves the full active probation record for a club if one exists.
 */
export async function getClubActiveProbation(
  clubId: string,
): Promise<ClubProbationRecord | null> {
  if (!clubId) return null;
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from("club_probations")
      .select("*")
      .eq("club_id", clubId)
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return data as ClubProbationRecord;
  } catch (err) {
    console.error("[clubProbationPenaltyService] Error fetching probation record:", err);
    return null;
  }
}

/**
 * Awards event check-in points while intercepting and freezing points if the club is on probation.
 */
export async function awardPointsWithProbationCheck(
  userId: string,
  eventId: string,
  basePoints: number,
  clubId?: string,
): Promise<ProbationPointAwardResult> {
  const supabase = createClient();

  // 1. If clubId is passed, do a pre-check
  if (clubId) {
    const onProbation = await isClubOnActiveProbation(clubId);
    if (onProbation) {
      return {
        success: false,
        frozen: true,
        points_awarded: 0,
        club_id: clubId,
        message: PROBATION_FROZEN_WARNING,
      };
    }
  }

  // 2. Invoke edge function
  try {
    const { data, error } = await supabase.functions.invoke("award_points", {
      body: { userId, eventId, basePoints, clubId },
    });

    if (error) {
      // Fallback: RPC invocation
      const { data: rpcData, error: rpcErr } = await supabase.rpc("award_points", {
        p_user_id: userId,
        p_event_id: eventId,
        p_base_points: basePoints,
        p_club_id: clubId || null,
      });

      if (rpcErr) throw rpcErr;
      return rpcData as ProbationPointAwardResult;
    }

    return data as ProbationPointAwardResult;
  } catch (err: any) {
    console.error("[clubProbationPenaltyService] Error awarding points:", err);
    return {
      success: false,
      frozen: false,
      points_awarded: 0,
      error: err.message || "Failed to award points",
    };
  }
}

/**
 * Retroactively revokes/deducts all gamification points earned from an unauthorized event.
 */
export async function retroactivelyDeductProbationEventPoints(
  clubId: string,
  eventId: string,
  reason: string = "Retroactive point deduction for unauthorized event on probation",
): Promise<RetroactivePointDeductionResult> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.rpc(
      "retroactively_deduct_probation_event_points",
      {
        p_club_id: clubId,
        p_event_id: eventId,
        p_reason: reason,
      },
    );

    if (error) throw error;
    return data as RetroactivePointDeductionResult;
  } catch (err: any) {
    console.error("[clubProbationPenaltyService] Error deducting points:", err);
    return {
      success: false,
      club_id: clubId,
      event_id: eventId,
      deducted_points: 0,
      message: "Failed to deduct event points",
      error: err.message,
    };
  }
}
