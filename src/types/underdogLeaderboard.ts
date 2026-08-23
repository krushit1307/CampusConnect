// =============================================================================
// File: src/types/underdogLeaderboard.ts
// Feature: Dynamic "Club Leaderboard" Underdog Multiplier
// Description: Type definitions for per-capita balancing algorithms, underdog
//              multiplier metrics, leaderboard modes, and club badge classifications.
// =============================================================================

export type LeaderboardMode = "raw" | "underdog";

export type ClubUnderdogBadge =
  | "Underdog Surge 🔥"
  | "Per-Capita Leader ⚡"
  | "Powerhouse Club 🏛️"
  | "Rising Niche 🚀";

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
  raw_rank: number;
  underdog_rank: number;
  rank_position: number; // Active rank depending on current mode
  rank_delta: number; // Positive = jumped ranks under underdog mode (e.g. +8)
  badge: ClubUnderdogBadge;
}

export interface LeaderboardSummaryStats {
  totalClubs: number;
  averageClubSize: number;
  topPerCapitaClubName: string;
  maxUnderdogJump: number; // e.g. +14 positions
}
