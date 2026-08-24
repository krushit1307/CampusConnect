// =============================================================================
// File: src/types/missingPhotoIncentive.ts
// Feature: Automated "Missing Photo" Incentive Engine
// Description: Type definitions for missing photo tasks, gamification point bribes,
//              photo claim verification, and engine statistics.
// =============================================================================

export type MissingPhotoTaskStatus = "pending" | "completed" | "expired";

export interface MissingPhotoTask {
  id: string;
  eventId: string;
  eventTitle: string;
  organizerId: string;
  status: MissingPhotoTaskStatus;
  bountyPoints: number; // e.g. 150 points
  bountyXp: number; // e.g. 100 XP
  createdAt: string; // ISO string
  deadlineAt: string; // ISO string
  completedAt?: string;
  uploadedPhotoUrl?: string;
}

export interface IncentiveClaimResult {
  success: boolean;
  taskId: string;
  eventId: string;
  pointsAwarded: number;
  xpAwarded: number;
  newTotalPoints: number;
  badgeUnlocked?: string;
  message: string;
}

export interface MissingPhotoEngineStats {
  totalEventsScanned: number;
  missingPhotoCount: number;
  totalPointsAwarded: number;
  completionRatePct: number;
}
