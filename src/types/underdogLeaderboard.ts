// =============================================================================
// File: src/types/underdogLeaderboard.ts
// Feature: Dynamic "Club Leaderboard" Underdog & Categorical Weighting
// Description: Type definitions for per-capita balancing algorithms, categorical
//              weighting point allocations, leaderboard modes, and club badges.
// =============================================================================

export type LeaderboardMode = "raw" | "underdog" | "categorical";

export type ClubUnderdogBadge =
  | "Underdog Surge 🔥"
  | "Per-Capita Leader ⚡"
  | "Powerhouse Club 🏛️"
  | "Rising Niche 🚀"
  | "Academic Excellence 🎓"
  | "Service Leader 🤝"
  | "Balanced Champion 🌟";

export type ClubActivityCategory =
  | "Academic & Research"
  | "Community Service"
  | "Inter-Club Collaboration"
  | "Professional & Career"
  | "Cultural & Arts"
  | "Social & Recreational";

export interface CategoryPointsBreakdown {
  category: ClubActivityCategory;
  rawPoints: number;
  weightMultiplier: number;
  weightedPoints: number;
}

export interface UnderdogClubEntry {
  club_id: string;
  club_name: string;
  logo_url?: string;
  member_count: number;
  active_member_count: number;
  raw_points: number;
  per_capita_points: number;
  underdog_multiplier: number; // e.g. 1.0x to 2.2x
  adjusted_score: number;
  categorical_points?: number;
  category_breakdown?: CategoryPointsBreakdown[];
  categorical_weight_multiplier?: number;
  diversity_bonus?: number;
  raw_rank: number;
  underdog_rank: number;
  categorical_rank?: number;
  rank_position: number; // Active rank depending on current mode
  rank_delta: number; // Positive = jumped ranks under current mode
  badge: ClubUnderdogBadge;
}

export interface LeaderboardSummaryStats {
  totalClubs: number;
  averageClubSize: number;
  topPerCapitaClubName: string;
  maxUnderdogJump: number; // e.g. +14 positions
}
