// =============================================================================
// File: src/services/underdogLeaderboardService.ts
// Feature: Dynamic "Club Leaderboard" Underdog Multiplier
// Description: Per-Capita balancing engine that calculates underdog multipliers
//              and adjusted scores to level the playing field between mega-clubs
//              and small, highly-active niche campus organizations.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type { UnderdogClubEntry, LeaderboardMode, ClubUnderdogBadge } from "../types/underdogLeaderboard";

/**
 * Calculates the Underdog Multiplier based on club size and active participation density.
 * Smaller clubs with high active participation receive a multiplier boost (1.0x to 2.2x).
 */
export function calculateUnderdogMultiplier(
  memberCount: number,
  activeMemberCount: number,
  benchmarkSize: number = 60
): number {
  const safeMembers = Math.max(memberCount, 1);
  const activeRatio = Math.min(Math.max(activeMemberCount / safeMembers, 0.2), 1.0);

  // Size scaling factor: Smaller clubs (< benchmark) get higher size boost
  let sizeBoost = 0;
  if (safeMembers < benchmarkSize) {
    sizeBoost = ((benchmarkSize - safeMembers) / benchmarkSize) * 0.8;
  }

  // Active Density Bonus: Clubs where >= 60% of members actively participate get up to +0.4x bonus
  const densityBonus = activeRatio >= 0.6 ? (activeRatio - 0.5) * 0.8 : 0;

  const rawMultiplier = 1.0 + sizeBoost + densityBonus;
  // Cap multiplier cleanly between 1.0x and 2.2x
  return Math.round(Math.min(Math.max(rawMultiplier, 1.0), 2.2) * 100) / 100;
}

/**
 * Computes per-capita points, underdog multipliers, adjusted scores, and rank movements.
 */
export function computeUnderdogClubLeaderboard(
  rawClubs: Array<{
    club_id?: string;
    id?: string;
    club_name?: string;
    name?: string;
    title?: string;
    logo_url?: string;
    member_count?: number;
    members_count?: number;
    active_member_count?: number;
    raw_points?: number;
    points?: number;
    total_points?: number;
  }>,
  mode: LeaderboardMode = "underdog"
): UnderdogClubEntry[] {
  // Step 1: Normalize raw inputs
  const parsedEntries = rawClubs.map((club, idx) => {
    const clubId = club.club_id || club.id || `club-${idx + 1}`;
    const clubName = club.club_name || club.name || club.title || `Club ${idx + 1}`;
    const logoUrl = club.logo_url;
    const memberCount = Math.max(club.member_count || club.members_count || 25, 1);
    const rawPoints = club.raw_points || club.points || club.total_points || 0;
    const activeMemberCount = club.active_member_count || Math.round(memberCount * 0.65);

    const perCapitaPoints = Math.round((rawPoints / memberCount) * 10) / 10;
    const underdogMultiplier = calculateUnderdogMultiplier(memberCount, activeMemberCount);

    // Adjusted Score combines 30% raw points + 70% (per capita * multiplier * scale factor)
    const adjustedScore = Math.round(rawPoints * 0.3 + perCapitaPoints * underdogMultiplier * 15);

    return {
      club_id: clubId,
      club_name: clubName,
      logo_url: logoUrl,
      member_count: memberCount,
      active_member_count: activeMemberCount,
      raw_points: rawPoints,
      per_capita_points: perCapitaPoints,
      underdog_multiplier: underdogMultiplier,
      adjusted_score: adjustedScore,
    };
  });

  // Step 2: Calculate Raw Ranks (sorted purely by raw_points)
  const sortedByRaw = [...parsedEntries].sort((a, b) => b.raw_points - a.raw_points);
  const rawRankMap = new Map<string, number>();
  sortedByRaw.forEach((entry, index) => {
    rawRankMap.set(entry.club_id, index + 1);
  });

  // Step 3: Calculate Underdog Ranks (sorted by adjusted_score)
  const sortedByUnderdog = [...parsedEntries].sort((a, b) => b.adjusted_score - a.adjusted_score);
  const underdogRankMap = new Map<string, number>();
  sortedByUnderdog.forEach((entry, index) => {
    underdogRankMap.set(entry.club_id, index + 1);
  });

  // Step 4: Build final entries with rank deltas and badges
  const targetList = mode === "raw" ? sortedByRaw : sortedByUnderdog;

  return targetList.map((entry, index) => {
    const rawRank = rawRankMap.get(entry.club_id) || index + 1;
    const underdogRank = underdogRankMap.get(entry.club_id) || index + 1;
    const rankDelta = rawRank - underdogRank; // Positive = jumped up ranks in underdog mode

    let badge: ClubUnderdogBadge = "Rising Niche 🚀";
    if (rankDelta >= 5) {
      badge = "Underdog Surge 🔥";
    } else if (entry.per_capita_points >= 40) {
      badge = "Per-Capita Leader ⚡";
    } else if (entry.member_count >= 150) {
      badge = "Powerhouse Club 🏛️";
    }

    return {
      ...entry,
      raw_rank: rawRank,
      underdog_rank: underdogRank,
      rank_position: mode === "raw" ? rawRank : underdogRank,
      rank_delta: rankDelta,
      badge,
    };
  });
}

/**
 * Provides rich mock dataset for testing and fallback.
 */
export function getMockUnderdogClubData(): Array<Record<string, any>> {
  return [
    {
      club_id: "club-robotics",
      club_name: "Autonomous Robotics & AI Club",
      member_count: 18,
      active_member_count: 16,
      raw_points: 1450,
      logo_url: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=100&h=100&fit=crop",
    },
    {
      club_id: "club-cs",
      club_name: "Computer Science Society",
      member_count: 420,
      active_member_count: 180,
      raw_points: 3800,
      logo_url: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=100&h=100&fit=crop",
    },
    {
      club_id: "club-solar",
      club_name: "Solar Racing Engineering Team",
      member_count: 22,
      active_member_count: 20,
      raw_points: 1680,
      logo_url: "https://images.unsplash.com/photo-1509391365360-2e959784a276?w=100&h=100&fit=crop",
    },
    {
      club_id: "club-finance",
      club_name: "Student Investment & Finance Association",
      member_count: 280,
      active_member_count: 110,
      raw_points: 2900,
      logo_url: "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=100&h=100&fit=crop",
    },
    {
      club_id: "club-chess",
      club_name: "Campus Grandmaster Chess Society",
      member_count: 15,
      active_member_count: 14,
      raw_points: 1220,
      logo_url: "https://images.unsplash.com/photo-1529699211952-734e80c4d42b?w=100&h=100&fit=crop",
    },
    {
      club_id: "club-outdoors",
      club_name: "Outdoor Adventure & Alpine Club",
      member_count: 190,
      active_member_count: 95,
      raw_points: 2200,
      logo_url: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=100&h=100&fit=crop",
    },
    {
      club_id: "club-biotech",
      club_name: "Synthetic Biology Lab Group",
      member_count: 14,
      active_member_count: 13,
      raw_points: 1150,
      logo_url: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?w=100&h=100&fit=crop",
    },
  ];
}

/**
 * Fetches and returns the balanced club leaderboard.
 */
export async function fetchBalancedClubLeaderboard(
  mode: LeaderboardMode = "underdog",
  limit: number = 50
): Promise<UnderdogClubEntry[]> {
  const supabase = createClient();
  try {
    const { data, error } = await supabase.rpc("get_top_clubs_monthly_leaderboard", {
      p_limit: limit,
    });
    if (!error && data && data.length > 0) {
      return computeUnderdogClubLeaderboard(data, mode);
    }
  } catch (err) {
    console.warn("RPC fetch fallback notice:", err);
  }

  // Fallback to mock dataset if database query returns empty or is not seeded
  const mockData = getMockUnderdogClubData();
  return computeUnderdogClubLeaderboard(mockData, mode);
}
