import { createClient } from "@/lib/supabase/client";
import type { VolunteerShift, ClaimShiftResult } from "@/types/database";

export interface CreateVolunteerShiftPayload {
  event_id: string;
  role_name: string;
  start_time: string;
  end_time: string;
  capacity: number;
  points_per_hour?: number;
}

/**
 * Retrieves all volunteer shifts for a given event, enriched with claimed counts and user claim status.
 */
export async function getEventVolunteerShifts(
  eventId: string,
  userId?: string,
): Promise<VolunteerShift[]> {
  const supabase = createClient();

  const { data: shifts, error: shiftError } = await supabase
    .from("volunteer_shifts")
    .select("*")
    .eq("event_id", eventId)
    .order("start_time", { ascending: true });

  if (shiftError) {
    console.error("Error fetching volunteer shifts:", shiftError);
    throw shiftError;
  }

  if (!shifts || shifts.length === 0) return [];

  const shiftIds = shifts.map((s) => s.id);

  const { data: claims, error: claimsError } = await supabase
    .from("shift_claims")
    .select("shift_id, user_id, status")
    .in("shift_id", shiftIds)
    .eq("status", "claimed");

  if (claimsError) {
    console.error("Error fetching shift claims:", claimsError);
    throw claimsError;
  }

  const activeClaims = claims || [];

  return shifts.map((shift: VolunteerShift) => {
    const matchingClaims = activeClaims.filter((c) => c.shift_id === shift.id);
    const claimedCount = matchingClaims.length;
    const userHasClaimed = userId ? matchingClaims.some((c) => c.user_id === userId) : false;

    return {
      ...shift,
      claimed_count: claimedCount,
      user_has_claimed: userHasClaimed,
    };
  });
}

/**
 * Creates a new volunteer shift role & time block for an event.
 */
export async function createVolunteerShift(
  payload: CreateVolunteerShiftPayload,
): Promise<VolunteerShift> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("volunteer_shifts")
    .insert({
      event_id: payload.event_id,
      role_name: payload.role_name,
      start_time: payload.start_time,
      end_time: payload.end_time,
      capacity: payload.capacity,
      points_per_hour: payload.points_per_hour || 50,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating volunteer shift:", error);
    throw error;
  }

  return data as VolunteerShift;
}

/**
 * Claims a volunteer shift atomically:
 * 1. Checks shift capacity limit (`FOR UPDATE` row locking).
 * 2. Validates time-collisions (blocks claiming overlapping shifts).
 * 3. Records shift claim and awards gamification points in `points_ledger`.
 */
export async function claimVolunteerShift(
  shiftId: string,
  userId: string,
): Promise<ClaimShiftResult> {
  const supabase = createClient();

  const { data, error } = await supabase.rpc("claim_volunteer_shift_transaction", {
    p_shift_id: shiftId,
    p_user_id: userId,
  });

  if (error) {
    console.error("Error claiming volunteer shift:", error);
    return {
      success: false,
      error: error.message,
    };
  }

  return data as ClaimShiftResult;
}

/**
 * Cancels an existing shift claim for a user.
 */
export async function cancelVolunteerShiftClaim(
  claimId: string,
  userId: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  const { error } = await supabase
    .from("shift_claims")
    .update({ status: "cancelled" })
    .eq("id", claimId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error cancelling shift claim:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}
