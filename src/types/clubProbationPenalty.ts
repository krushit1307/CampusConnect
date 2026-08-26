// =============================================================================
// Type Definitions: Club Probation Penalty & Point Freezing
// Issue: #4533 - Develop a 'Dynamic "Club Leaderboard" Probation Penalty'
// =============================================================================

export type ProbationStatus = 'active' | 'resolved' | 'expunged' | 'appeal_pending';

export interface ClubProbationRecord {
  id: string;
  club_id: string;
  event_id?: string | null;
  reason: string;
  status: ProbationStatus;
  points_frozen: boolean;
  retroactive_points_deducted: number;
  starts_at: string;
  expires_at: string;
  created_at: string;
  updated_at: string;
}

export interface ProbationPointAwardResult {
  success: boolean;
  frozen: boolean;
  points_awarded: number;
  club_id?: string;
  streak_count?: number;
  multiplier?: number;
  streak_message?: string;
  message?: string;
  error?: string;
}

export interface RetroactivePointDeductionResult {
  success: boolean;
  club_id: string;
  event_id: string;
  deducted_points: number;
  message: string;
  error?: string;
}
