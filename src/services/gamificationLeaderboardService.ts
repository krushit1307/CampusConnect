// =============================================================================
// Service: Gamification Leaderboard Service
// Issue: #3894 - Build a 'Real-Time Gamification Leaderboard'
// Description: Wrapper service for fetching monthly user and club leaderboards.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type { UserLeaderboardEntry, ClubLeaderboardEntry } from "../types/database";

/**
 * Fetches the top 50 users based on gamification points earned in the current month.
 */
export async function getTopUsersMonthlyLeaderboard(
  limit: number = 50,
): Promise<UserLeaderboardEntry[]> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.rpc("get_top_users_monthly_leaderboard", {
      p_limit: limit,
    });
    if (error) throw error;
    return (data || []) as UserLeaderboardEntry[];
  } catch (err) {
    console.error("[gamificationLeaderboardService] Error fetching user leaderboard:", err);
    return [];
  }
}

/**
 * Fetches the top 50 clubs based on member points earned in the current month.
 */
export async function getTopClubsMonthlyLeaderboard(
  limit: number = 50,
): Promise<ClubLeaderboardEntry[]> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.rpc("get_top_clubs_monthly_leaderboard", {
      p_limit: limit,
    });
    if (error) throw error;
    return (data || []) as ClubLeaderboardEntry[];
  } catch (err) {
    console.error("[gamificationLeaderboardService] Error fetching club leaderboard:", err);
    return [];
  }
}
