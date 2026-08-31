// =============================================================================
// Types: Jury Moderation DAO
// Issue: #5129 - Automated "Profanity/Harassment" Decentralized Content Moderation DAO
// Description: Type definitions for jury cases, eligible candidate selection,
// blind voting, 4-of-5 consensus resolution, and gamification reward tracking.
// =============================================================================

export type JuryVoteDecision = "violates_policy" | "looks_fine";

export type JuryCaseStatus =
  "PENDING" | "ASSIGNED" | "VOTING" | "RESOLVED_VIOLATION" | "RESOLVED_FINE" | "EXPIRED";

export interface JuryCandidate {
  id: string;
  fullName: string;
  avatarUrl?: string | null;
  rating: number; // e.g. 1.0 - 5.0 rating or reputation score
  reputationPoints: number; // Gamification points / XP
  isActive: boolean;
  priorInfractionsCount: number; // Must be 0 for jury duty eligibility
  deletedAt?: string | null;
}

export interface JuryVote {
  caseId: string;
  jurorId: string;
  decision: JuryVoteDecision;
  votedAt: string;
}

export interface JuryCase {
  id: string;
  reportId: string;
  contentId: string;
  authorId: string;
  reporterId: string;
  category: string; // e.g. "profanity" | "harassment" | "safety"
  reason: string;
  contentPreview: string;
  assignedJurorIds: string[]; // Exactly 5 juror IDs
  votes: JuryVote[];
  status: JuryCaseStatus;
  consensusDecision?: JuryVoteDecision | null;
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Masked view provided to jurors to enforce blind voting principles.
 * Jurors cannot see other jurors' identities, individual votes, or current vote totals.
 */
export interface BlindJuryCaseView {
  id: string;
  contentPreview: string;
  category: string;
  reason: string;
  status: JuryCaseStatus;
  userVote?: JuryVoteDecision | null; // The calling juror's own vote, if submitted
  hasVoted: boolean;
  isResolved: boolean;
  consensusDecision?: JuryVoteDecision | null;
  rewardPointsEarned?: number;
}
