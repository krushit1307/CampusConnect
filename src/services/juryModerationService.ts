// =============================================================================
// Service: JuryModerationService
// Issue: #5129 - Automated "Profanity/Harassment" Decentralized Content Moderation DAO
// Description: Core service implementing candidate eligibility filtering, random 5-juror selection,
// blind voting, 4-of-5 consensus resolution, content action execution, and 50-point rewards.
// =============================================================================

import {
  JuryCase,
  JuryCaseStatus,
  JuryCandidate,
  JuryVote,
  JuryVoteDecision,
  BlindJuryCaseView,
} from "../types/juryModeration";
import { dispatchNotification } from "./notificationDispatcher";

export interface ModerationActionResult {
  success: boolean;
  action: "content_deleted" | "report_dismissed" | "pending_consensus";
  message: string;
}

export class JuryModerationService {
  private cases: Map<string, JuryCase> = new Map();
  // Idempotency tracking for juror rewards: Set<"jury:<caseId>:reward:<jurorId>">
  private awardedRewardKeys: Set<string> = new Set();
  // Record of content deletions
  private deletedContentIds: Set<string> = new Set();
  // Record of report dismissals
  private dismissedReportIds: Set<string> = new Set();
  // User points tracking map for gamification awards: Map<userId, totalPoints>
  private userGamificationPoints: Map<string, number> = new Map();

  /**
   * Evaluates whether a candidate user meets strict eligibility criteria for Jury Duty:
   * 1. Active account (isActive === true, deletedAt === null)
   * 2. Highly rated (rating >= 4.0 or reputationPoints >= 50)
   * 3. Zero prior infractions (priorInfractionsCount === 0)
   * 4. Not the content author
   * 5. Not the reporter
   */
  public evaluateEligibility(
    candidate: JuryCandidate,
    authorId: string,
    reporterId: string,
  ): boolean {
    if (!candidate || !candidate.id) return false;
    if (!candidate.isActive || candidate.deletedAt != null) return false;
    if (candidate.priorInfractionsCount > 0) return false;
    if (candidate.id === authorId || candidate.id === reporterId) return false;

    // Must be highly-rated (rating >= 4.0 or reputation >= 50)
    const isHighlyRated = candidate.rating >= 4.0 || candidate.reputationPoints >= 50;
    return isHighlyRated;
  }

  /**
   * Selects exactly 5 random eligible jurors from the candidate pool using server-side random sampling.
   */
  public selectRandomJurors(
    candidates: JuryCandidate[],
    authorId: string,
    reporterId: string,
    count: number = 5,
  ): JuryCandidate[] {
    const eligible = candidates.filter((c) => this.evaluateEligibility(c, authorId, reporterId));

    if (eligible.length === 0) return [];

    // Server-side random shuffle (Fisher-Yates)
    const shuffled = [...eligible];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
  }

  /**
   * Creates a new Jury Case, selects 5 eligible jurors, and dispatches notifications.
   */
  public async createJuryCase(
    reportId: string,
    contentId: string,
    authorId: string,
    reporterId: string,
    category: string,
    reason: string,
    contentPreview: string,
    candidatesPool: JuryCandidate[],
  ): Promise<JuryCase> {
    const caseId = `jury_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const selectedJurors = this.selectRandomJurors(candidatesPool, authorId, reporterId, 5);
    const assignedJurorIds = selectedJurors.map((j) => j.id);

    const status: JuryCaseStatus = assignedJurorIds.length === 5 ? "ASSIGNED" : "PENDING";

    const juryCase: JuryCase = {
      id: caseId,
      reportId,
      contentId,
      authorId,
      reporterId,
      category,
      reason,
      contentPreview,
      assignedJurorIds,
      votes: [],
      status,
      consensusDecision: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.cases.set(caseId, juryCase);

    // Notify assigned jurors via notification system
    for (const jurorId of assignedJurorIds) {
      try {
        await dispatchNotification(
          {
            title: "Selected for Jury Duty ⚖️",
            body: `You have been randomly selected for Jury Duty to review a moderation case regarding ${category}.`,
            user_id: jurorId,
            priority: "normal",
            type: "jury_duty",
            payload: { caseId, category },
          },
          { push_notifications: true },
        );
      } catch (err) {
        console.error(`[JuryModerationService] Failed to notify juror ${jurorId}:`, err);
      }
    }

    return juryCase;
  }

  /**
   * Submits a blind vote for an assigned juror and evaluates 4-of-5 consensus.
   */
  public submitVote(
    caseId: string,
    jurorId: string,
    decision: JuryVoteDecision,
  ): { success: boolean; message: string; caseState?: JuryCase } {
    const caseItem = this.cases.get(caseId);

    if (!caseItem) {
      return { success: false, message: "Jury case not found." };
    }

    // Check if case is already resolved or expired
    if (
      caseItem.status === "RESOLVED_VIOLATION" ||
      caseItem.status === "RESOLVED_FINE" ||
      caseItem.status === "EXPIRED"
    ) {
      return { success: false, message: "Case is already resolved or closed to further votes." };
    }

    // Check if user is an assigned juror
    if (!caseItem.assignedJurorIds.includes(jurorId)) {
      return {
        success: false,
        message: "Unauthorized: You are not an assigned juror for this case.",
      };
    }

    // Enforce one vote per juror
    const existingVote = caseItem.votes.find((v) => v.jurorId === jurorId);
    if (existingVote) {
      return { success: false, message: "You have already cast your vote for this case." };
    }

    // Record vote
    const newVote: JuryVote = {
      caseId,
      jurorId,
      decision,
      votedAt: new Date().toISOString(),
    };

    caseItem.votes.push(newVote);
    caseItem.status = "VOTING";
    caseItem.updatedAt = new Date().toISOString();

    // Check for 4-of-5 consensus resolution
    this.evaluateConsensus(caseItem);

    return {
      success: true,
      message: "Vote recorded successfully.",
      caseState: caseItem,
    };
  }

  /**
   * Evaluates consensus rules:
   * 4 out of 5 "violates_policy" -> RESOLVED_VIOLATION (Delete content)
   * 4 out of 5 "looks_fine" -> RESOLVED_FINE (Dismiss report)
   * On resolution, awards 50 points to each participating juror.
   */
  public evaluateConsensus(caseItem: JuryCase): ModerationActionResult {
    const violationVotes = caseItem.votes.filter((v) => v.decision === "violates_policy").length;
    const fineVotes = caseItem.votes.filter((v) => v.decision === "looks_fine").length;

    // Consensus Threshold: 4 out of 5 votes required
    if (violationVotes >= 4) {
      caseItem.status = "RESOLVED_VIOLATION";
      caseItem.consensusDecision = "violates_policy";
      caseItem.resolvedAt = new Date().toISOString();

      // Execute moderation action: Delete content
      this.deletedContentIds.add(caseItem.contentId);

      // Reward participating jurors with 50 points
      const participatingJurors = caseItem.votes.map((v) => v.jurorId);
      this.awardJurorRewards(caseItem.id, participatingJurors);

      return {
        success: true,
        action: "content_deleted",
        message: "Consensus reached (Violation). Content removed and report resolved.",
      };
    } else if (fineVotes >= 4) {
      caseItem.status = "RESOLVED_FINE";
      caseItem.consensusDecision = "looks_fine";
      caseItem.resolvedAt = new Date().toISOString();

      // Execute moderation action: Dismiss report
      this.dismissedReportIds.add(caseItem.reportId);

      // Reward participating jurors with 50 points
      const participatingJurors = caseItem.votes.map((v) => v.jurorId);
      this.awardJurorRewards(caseItem.id, participatingJurors);

      return {
        success: true,
        action: "report_dismissed",
        message: "Consensus reached (Looks Fine). Report dismissed.",
      };
    }

    return {
      success: true,
      action: "pending_consensus",
      message: `Vote recorded. Current tally: ${violationVotes} Violation / ${fineVotes} Fine (4 required for consensus).`,
    };
  }

  /**
   * Awards 50 Gamification points to jurors who participated in voting.
   * Enforces strict idempotency (`jury:<caseId>:reward:<jurorId>`) to prevent duplicate points.
   */
  public awardJurorRewards(
    caseId: string,
    jurorIds: string[],
    rewardAmount: number = 50,
  ): string[] {
    const awardedJurors: string[] = [];

    for (const jurorId of jurorIds) {
      const idempotencyKey = `jury:${caseId}:reward:${jurorId}`;

      if (this.awardedRewardKeys.has(idempotencyKey)) {
        continue; // Prevent duplicate points award
      }

      this.awardedRewardKeys.add(idempotencyKey);
      const currentPts = this.userGamificationPoints.get(jurorId) || 0;
      this.userGamificationPoints.set(jurorId, currentPts + rewardAmount);
      awardedJurors.push(jurorId);
    }

    return awardedJurors;
  }

  /**
   * Returns a blind view of a jury case for a specific juror.
   * Excludes other jurors' identities, individual votes, and live vote counts to ensure blind voting.
   */
  public getBlindCaseView(caseId: string, jurorId: string): BlindJuryCaseView | null {
    const caseItem = this.cases.get(caseId);

    if (!caseItem) return null;
    if (!caseItem.assignedJurorIds.includes(jurorId)) return null;

    const userVoteObj = caseItem.votes.find((v) => v.jurorId === jurorId);
    const hasVoted = Boolean(userVoteObj);
    const isResolved =
      caseItem.status === "RESOLVED_VIOLATION" || caseItem.status === "RESOLVED_FINE";

    const rewardKey = `jury:${caseId}:reward:${jurorId}`;
    const rewardPointsEarned = this.awardedRewardKeys.has(rewardKey) ? 50 : 0;

    return {
      id: caseItem.id,
      contentPreview: caseItem.contentPreview,
      category: caseItem.category,
      reason: caseItem.reason,
      status: caseItem.status,
      userVote: userVoteObj ? userVoteObj.decision : null,
      hasVoted,
      isResolved,
      consensusDecision: caseItem.consensusDecision,
      rewardPointsEarned,
    };
  }

  /**
   * Utility getters for testing & verification
   */
  public getCase(caseId: string): JuryCase | undefined {
    return this.cases.get(caseId);
  }

  public getUserPoints(userId: string): number {
    return this.userGamificationPoints.get(userId) || 0;
  }

  public isContentDeleted(contentId: string): boolean {
    return this.deletedContentIds.has(contentId);
  }

  public isReportDismissed(reportId: string): boolean {
    return this.dismissedReportIds.has(reportId);
  }

  public isRewardAwarded(caseId: string, jurorId: string): boolean {
    return this.awardedRewardKeys.has(`jury:${caseId}:reward:${jurorId}`);
  }

  public clearAll(): void {
    this.cases.clear();
    this.awardedRewardKeys.clear();
    this.deletedContentIds.clear();
    this.dismissedReportIds.clear();
    this.userGamificationPoints.clear();
  }
}

// Global singleton instance for application use
export const globalJuryModerationService = new JuryModerationService();
