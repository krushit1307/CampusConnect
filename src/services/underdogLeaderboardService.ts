// @ts-nocheck
// =============================================================================
// File: src/services/underdogLeaderboardService.ts
// Feature: Dynamic "Club Leaderboard" Underdog & Categorical Weighting Engine
// Description: Per-Capita balancing and Categorical Weighting point allocation
//              engine. Multiplies points based on activity impact (Academic 1.4x,
//              Service 1.3x, Collaboration 1.25x) and awards diversity bonuses.
// =============================================================================

import { createClient } from "../lib/supabase/client";
import type {
  UnderdogClubEntry,
  LeaderboardMode,
  ClubUnderdogBadge,
  ClubActivityCategory,
  CategoryPointsBreakdown,
} from "../types/underdogLeaderboard";

/**
 * Categorical Weighting Matrix:
 * Multiplies points based on event/activity impact, educational value, and social good.
 */
export const CATEGORY_WEIGHT_MULTIPLIERS: Record<ClubActivityCategory, number> = {
  "Academic & Research": 1.40,
  "Community Service": 1.30,
  "Inter-Club Collaboration": 1.25,
  "Professional & Career": 1.15,
  "Cultural & Arts": 1.10,
  "Social & Recreational": 1.00,
};

/**
 * Calculates weighted score, effective multiplier, and diversity bonus from raw categorical points.
 */
export function calculateCategoricalWeightedScore(
  rawCategoryPoints: Partial<Record<ClubActivityCategory, number>>
): {
  categoricalPoints: number;
  categoryBreakdown: CategoryPointsBreakdown[];
  effectiveMultiplier: number;
  diversityBonus: number;
} {
  const categories: ClubActivityCategory[] = [
    "Academic & Research",
    "Community Service",
    "Inter-Club Collaboration",
    "Professional & Career",
    "Cultural & Arts",
    "Social & Recreational",
  ];

  let rawTotal = 0;
  let weightedSum = 0;
  let activeCategoriesCount = 0;
  const breakdown: CategoryPointsBreakdown[] = [];

  categories.forEach((cat) => {
    const raw = Math.max(0, rawCategoryPoints[cat] || 0);
    if (raw > 0) activeCategoriesCount += 1;

    const multiplier = CATEGORY_WEIGHT_MULTIPLIERS[cat];
    const weighted = Math.round(raw * multiplier);

    rawTotal += raw;
    weightedSum += weighted;

    breakdown.push({
      category: cat,
      rawPoints: raw,
      weightMultiplier: multiplier,
      weightedPoints: weighted,
    });
  });

  // Diversity Bonus: Reward well-rounded multi-category participation
  let diversityBonusRate = 0;
  if (activeCategoriesCount >= 5) {
    diversityBonusRate = 0.15; // +15% boost for 5+ categories
  } else if (activeCategoriesCount >= 3) {
    diversityBonusRate = 0.10; // +10% boost for 3-4 categories
  }

  const diversityBonus = Math.round(weightedSum * diversityBonusRate);
  const categoricalPoints = weightedSum + diversityBonus;
  const effectiveMultiplier =
    rawTotal > 0 ? Math.round((categoricalPoints / rawTotal) * 100) / 100 : 1.0;

  return {
    categoricalPoints,
    categoryBreakdown: breakdown,
    effectiveMultiplier,
    diversityBonus,
  };
}

/**
 * Generates synthetic categorical point distribution for testing & fallback data.
 */
export function generateSyntheticCategoryPoints(
  rawPoints: number,
  clubName: string
): Partial<Record<ClubActivityCategory, number>> {
  const lower = clubName.toLowerCase();
  const distribution: Partial<Record<ClubActivityCategory, number>> = {};

  if (lower.includes("robotics") || lower.includes("ai") || lower.includes("science") || lower.includes("biology")) {
    distribution["Academic & Research"] = Math.round(rawPoints * 0.55);
    distribution["Inter-Club Collaboration"] = Math.round(rawPoints * 0.25);
    distribution["Professional & Career"] = Math.round(rawPoints * 0.20);
  } else if (lower.includes("finance") || lower.includes("investment") || lower.includes("cs") || lower.includes("computer")) {
    distribution["Professional & Career"] = Math.round(rawPoints * 0.50);
    distribution["Academic & Research"] = Math.round(rawPoints * 0.30);
    distribution["Social & Recreational"] = Math.round(rawPoints * 0.20);
  } else if (lower.includes("chess") || lower.includes("outdoor") || lower.includes("alpine")) {
    distribution["Social & Recreational"] = Math.round(rawPoints * 0.50);
    distribution["Community Service"] = Math.round(rawPoints * 0.30);
    distribution["Cultural & Arts"] = Math.round(rawPoints * 0.20);
  } else {
    distribution["Academic & Research"] = Math.round(rawPoints * 0.30);
    distribution["Community Service"] = Math.round(rawPoints * 0.25);
    distribution["Inter-Club Collaboration"] = Math.round(rawPoints * 0.25);
    distribution["Social & Recreational"] = Math.round(rawPoints * 0.20);
  }

  return distribution;
}

/**
 * Calculates the Underdog Multiplier based on club size and active participation density.
 */
export function calculateUnderdogMultiplier(
  memberCount: number,
  activeMemberCount: number,
  benchmarkSize: number = 60
): number {
  const safeMembers = Math.max(memberCount, 1);
  const activeRatio = Math.min(Math.max(activeMemberCount / safeMembers, 0.2), 1.0);

  let sizeBoost = 0;
  if (safeMembers < benchmarkSize) {
    sizeBoost = ((benchmarkSize - safeMembers) / benchmarkSize) * 0.8;
  }

  const densityBonus = activeRatio >= 0.6 ? (activeRatio - 0.5) * 0.8 : 0;
  const rawMultiplier = 1.0 + sizeBoost + densityBonus;

  return Math.round(Math.min(Math.max(rawMultiplier, 1.0), 2.2) * 100) / 100;
}

/**
 * Computes per-capita points, underdog multipliers, categorical weighting, adjusted scores, and rank movements.
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
    category_points?: Partial<Record<ClubActivityCategory, number>>;
  }>,
  mode: LeaderboardMode = "underdog"
): UnderdogClubEntry[] {
  // Step 1: Normalize raw inputs & compute categorical weighting
  const parsedEntries = rawClubs.map((club, idx) => {
    const clubId = club.club_id || club.id || `club-${idx + 1}`;
    const clubName = club.club_name || club.name || club.title || `Club ${idx + 1}`;
    const logoUrl = club.logo_url;
    const memberCount = Math.max(club.member_count || club.members_count || 25, 1);
    const rawPoints = club.raw_points || club.points || club.total_points || 0;
    const activeMemberCount = club.active_member_count || Math.round(memberCount * 0.65);

    const perCapitaPoints = Math.round((rawPoints / memberCount) * 10) / 10;
    const underdogMultiplier = calculateUnderdogMultiplier(memberCount, activeMemberCount);
    const adjustedScore = Math.round(rawPoints * 0.3 + perCapitaPoints * underdogMultiplier * 15);

    // Compute Categorical Weighting
    const rawCatPoints = club.category_points || generateSyntheticCategoryPoints(rawPoints, clubName);
    const { categoricalPoints, categoryBreakdown, effectiveMultiplier, diversityBonus } =
      calculateCategoricalWeightedScore(rawCatPoints);

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
      categorical_points: categoricalPoints,
      category_breakdown: categoryBreakdown,
      categorical_weight_multiplier: effectiveMultiplier,
      diversity_bonus: diversityBonus,
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

  // Step 4: Calculate Categorical Ranks (sorted by categorical_points)
  const sortedByCategorical = [...parsedEntries].sort(
    (a, b) => (b.categorical_points || 0) - (a.categorical_points || 0)
  );
  const categoricalRankMap = new Map<string, number>();
  sortedByCategorical.forEach((entry, index) => {
    categoricalRankMap.set(entry.club_id, index + 1);
  });

  // Step 5: Build final entries based on requested mode
  let targetList = sortedByUnderdog;
  if (mode === "raw") targetList = sortedByRaw;
  if (mode === "categorical") targetList = sortedByCategorical;

  return targetList.map((entry, index) => {
    const rawRank = rawRankMap.get(entry.club_id) || index + 1;
    const underdogRank = underdogRankMap.get(entry.club_id) || index + 1;
    const categoricalRank = categoricalRankMap.get(entry.club_id) || index + 1;

    let activeRank = underdogRank;
    if (mode === "raw") activeRank = rawRank;
    if (mode === "categorical") activeRank = categoricalRank;

    const rankDelta = rawRank - activeRank;

    let badge: ClubUnderdogBadge = "Rising Niche 🚀";
    if (mode === "categorical") {
      if (entry.diversity_bonus && entry.diversity_bonus > 0) {
        badge = "Balanced Champion 🌟";
      } else if ((entry.categorical_weight_multiplier || 1) >= 1.3) {
        badge = "Academic Excellence 🎓";
      } else {
        badge = "Service Leader 🤝";
      }
    } else {
      if (rankDelta >= 5) {
        badge = "Underdog Surge 🔥";
      } else if (entry.per_capita_points >= 40) {
        badge = "Per-Capita Leader ⚡";
      } else if (entry.member_count >= 150) {
        badge = "Powerhouse Club 🏛️";
      }
    }

    return {
      ...entry,
      raw_rank: rawRank,
      underdog_rank: underdogRank,
      categorical_rank: categoricalRank,
      rank_position: activeRank,
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

  const mockData = getMockUnderdogClubData();
  return computeUnderdogClubLeaderboard(mockData, mode);
}
