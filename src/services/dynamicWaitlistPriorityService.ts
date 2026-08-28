// =============================================================================
// Service: Dynamic Waitlist Priority Service
// Issue: #3874 - Develop a 'Dynamic Waitlist Priority' Algorithm
// Description: Replaces FIFO waitlist with a Weighted Priority Algorithm that rewards
// positive platform reputation (Gamification XP, attendance streak vs no-show penalties).
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type { DynamicWaitlistUser, WaitlistPriorityScoreBreakdown } from "../types/database";

/**
 * Calculates weighted Priority Score for a waitlisted user based on platform behavior.
 */
export function calculateDynamicPriorityScore(
  gamificationPoints: number = 0,
  attendanceCount: number = 0,
  noShowCount: number = 0,
  waitlistJoinedAt: string | Date = new Date(),
  now: Date = new Date(),
): WaitlistPriorityScoreBreakdown {
  const joinedTime = new Date(waitlistJoinedAt);
  const diffMs = Math.max(0, now.getTime() - joinedTime.getTime());
  const hoursOnWaitlist = diffMs / (1000 * 3600);

  // Base Time score: 100 points initial, decays slowly (0.5 pts per hour on waitlist)
  const baseTimeScore = Math.max(0, Math.round((100 - hoursOnWaitlist * 0.5) * 10) / 10);

  // Gamification Bonus: 2.5 points per XP point
  const gamificationBonus = Math.round(gamificationPoints * 2.5 * 10) / 10;

  // Attendance Streak Bonus: 10 points per event attended
  const attendanceBonus = attendanceCount * 10;

  // No-Show Penalty: -25 points per flaked/no-show event
  const noShowPenalty = noShowCount * 25;

  const finalScore =
    Math.round((baseTimeScore + gamificationBonus + attendanceBonus - noShowPenalty) * 10) / 10;

  return {
    base_time_score: baseTimeScore,
    gamification_bonus: gamificationBonus,
    attendance_bonus: attendanceBonus,
    no_show_penalty: noShowPenalty,
    final_priority_score: finalScore,
  };
}

/**
 * Fetches and ranks all waitlisted users for an event by Priority Score DESC.
 */
export async function getRankedWaitlistForEvent(
  eventId: string,
  currentUserId?: string,
): Promise<{ userRank: DynamicWaitlistUser | null; allWaitlist: DynamicWaitlistUser[] }> {
  if (!eventId) return { userRank: null, allWaitlist: [] };

  const supabase = createClient();
  const now = new Date();

  try {
    const { data: waitlistRows, error } = await supabase
      .from("event_waitlist")
      .select(
        "id, event_id, user_id, created_at, profiles:user_id(full_name, avatar_url, gamification_points, attendance_count, no_show_count)",
      )
      .eq("event_id", eventId);

    if (error) throw error;

    const parsedList: DynamicWaitlistUser[] = (waitlistRows || []).map((row: any) => {
      const p = row.profiles || {};
      const gPts = p.gamification_points || 0;
      const att = p.attendance_count || 0;
      const noShow = p.no_show_count || 0;

      const breakdown = calculateDynamicPriorityScore(gPts, att, noShow, row.created_at, now);

      return {
        id: row.id,
        event_id: row.event_id,
        user_id: row.user_id,
        user_full_name: p.full_name || "Waitlisted Student",
        avatar_url: p.avatar_url,
        priority_score: breakdown.final_priority_score,
        rank_position: 0,
        total_waitlisted: 0,
        gamification_points: gPts,
        attendance_count: att,
        no_show_count: noShow,
        created_at: row.created_at,
        score_breakdown: breakdown,
      };
    });

    // Sort by Priority Score DESC (highest priority score gets promoted first)
    parsedList.sort((a, b) => b.priority_score - a.priority_score);

    const totalCount = parsedList.length;
    parsedList.forEach((item, index) => {
      item.rank_position = index + 1;
      item.total_waitlisted = totalCount;
    });

    const userRank = currentUserId
      ? parsedList.find((u) => u.user_id === currentUserId) || null
      : null;

    return {
      userRank,
      allWaitlist: parsedList,
    };
  } catch (err) {
    console.error("[dynamicWaitlistPriorityService] Fetch error:", err);
    return { userRank: null, allWaitlist: [] };
  }
}

/**
 * Promotes the highest priority score waitlisted user to 'Registered'.
 */
export async function promoteTopPriorityWaitlistUser(eventId: string): Promise<{
  success: boolean;
  promotedUserName?: string;
  priorityScore?: number;
  error?: string;
}> {
  if (!eventId) return { success: false, error: "Missing eventId" };

  const supabase = createClient();

  try {
    const { data, error } = await supabase.rpc("promote_top_dynamic_waitlist_user", {
      p_event_id: eventId,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    if (data && data.success === false) {
      return { success: false, error: data.message || "Waitlist is empty" };
    }

    console.log(
      `[dynamicWaitlistPriorityService] Promoted top user ${data.user_full_name} (Score: ${data.priority_score})`,
    );

    return {
      success: true,
      promotedUserName: data.user_full_name,
      priorityScore: data.priority_score,
    };
  } catch (err: any) {
    console.error("[dynamicWaitlistPriorityService] Promotion error:", err);
    return { success: false, error: err.message };
  }
}
