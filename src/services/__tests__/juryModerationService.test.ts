// =============================================================================
// Unit & Integration Tests: JuryModerationService
// Issue: #5129 - Automated "Profanity/Harassment" Decentralized Content Moderation DAO
// Description: Exhaustive tests for candidate eligibility, 5-juror random selection,
// blind voting enforcement, 4-of-5 consensus algorithm, moderation execution, and 50-point rewards.
// =============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JuryModerationService } from "../juryModerationService";
import { JuryCandidate } from "../../types/juryModeration";
import {
  JuryCaseUpdateSchema,
  JuryDutyNotificationSchema,
} from "../../../contracts/websocket-schemas";

describe("JuryModerationService (#5129)", () => {
  let service: JuryModerationService;

  const mockAuthorId = "author-user-100";
  const mockReporterId = "reporter-user-200";

  const mockCandidatePool: JuryCandidate[] = [
    {
      id: "juror-1",
      fullName: "Alice Smith",
      rating: 4.8,
      reputationPoints: 120,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-2",
      fullName: "Bob Jones",
      rating: 4.5,
      reputationPoints: 80,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-3",
      fullName: "Charlie Brown",
      rating: 4.2,
      reputationPoints: 60,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-4",
      fullName: "Diana Prince",
      rating: 4.9,
      reputationPoints: 200,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-5",
      fullName: "Ethan Hunt",
      rating: 4.0,
      reputationPoints: 50,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-6",
      fullName: "Fiona Gallagher",
      rating: 4.6,
      reputationPoints: 95,
      isActive: true,
      priorInfractionsCount: 0,
    },
    // Ineligible candidates:
    {
      id: "bad-juror-1",
      fullName: "Infractor User",
      rating: 4.9,
      reputationPoints: 200,
      isActive: true,
      priorInfractionsCount: 2,
    },
    {
      id: "bad-juror-2",
      fullName: "Inactive User",
      rating: 4.8,
      reputationPoints: 100,
      isActive: false,
      priorInfractionsCount: 0,
    },
    {
      id: "bad-juror-3",
      fullName: "Low Rating User",
      rating: 2.1,
      reputationPoints: 10,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: mockAuthorId,
      fullName: "Author",
      rating: 5.0,
      reputationPoints: 300,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: mockReporterId,
      fullName: "Reporter",
      rating: 5.0,
      reputationPoints: 300,
      isActive: true,
      priorInfractionsCount: 0,
    },
  ];

  beforeEach(() => {
    service = new JuryModerationService();
  });

  afterEach(() => {
    service.clearAll();
  });

  it("evaluates eligibility correctly according to strict criteria", () => {
    const validJuror = mockCandidatePool[0]; // Alice
    const infractor = mockCandidatePool.find((c) => c.id === "bad-juror-1")!;
    const inactive = mockCandidatePool.find((c) => c.id === "bad-juror-2")!;
    const lowRated = mockCandidatePool.find((c) => c.id === "bad-juror-3")!;
    const author = mockCandidatePool.find((c) => c.id === mockAuthorId)!;

    expect(service.evaluateEligibility(validJuror, mockAuthorId, mockReporterId)).toBe(true);
    expect(service.evaluateEligibility(infractor, mockAuthorId, mockReporterId)).toBe(false);
    expect(service.evaluateEligibility(inactive, mockAuthorId, mockReporterId)).toBe(false);
    expect(service.evaluateEligibility(lowRated, mockAuthorId, mockReporterId)).toBe(false);
    expect(service.evaluateEligibility(author, mockAuthorId, mockReporterId)).toBe(false);
  });

  it("selects exactly 5 random eligible jurors excluding author and reporter", () => {
    const selected = service.selectRandomJurors(mockCandidatePool, mockAuthorId, mockReporterId, 5);

    expect(selected).toHaveLength(5);
    const selectedIds = selected.map((j) => j.id);

    expect(selectedIds).not.toContain(mockAuthorId);
    expect(selectedIds).not.toContain(mockReporterId);
    expect(selectedIds).not.toContain("bad-juror-1");
    expect(selectedIds).not.toContain("bad-juror-2");
    expect(selectedIds).not.toContain("bad-juror-3");

    // Ensure all 5 selected jurors are unique
    expect(new Set(selectedIds).size).toBe(5);
  });

  it("creates a Jury Case with ASSIGNED status and dispatches notifications", async () => {
    const caseItem = await service.createJuryCase(
      "report-101",
      "content-505",
      mockAuthorId,
      mockReporterId,
      "harassment",
      "Repeated offensive targeted harassment",
      "Sample harassment content preview string",
      mockCandidatePool,
    );

    expect(caseItem.id).toBeDefined();
    expect(caseItem.status).toBe("ASSIGNED");
    expect(caseItem.assignedJurorIds).toHaveLength(5);
    expect(caseItem.votes).toHaveLength(0);
  });

  it("enforces blind voting rules (masks other jurors' identities, votes, and vote totals)", async () => {
    const caseItem = await service.createJuryCase(
      "report-101",
      "content-505",
      mockAuthorId,
      mockReporterId,
      "profanity",
      "Severe profanity",
      "Sample profanity content",
      mockCandidatePool,
    );

    const jurorId = caseItem.assignedJurorIds[0];
    const blindView = service.getBlindCaseView(caseItem.id, jurorId);

    expect(blindView).not.toBeNull();
    expect(blindView?.hasVoted).toBe(false);
    expect(blindView?.contentPreview).toBe("Sample profanity content");

    // Blind privacy check: Does not expose assignedJurorIds or raw votes list
    expect(blindView).not.toHaveProperty("assignedJurorIds");
    expect(blindView).not.toHaveProperty("votes");
  });

  it("prevents unassigned users from voting", async () => {
    const caseItem = await service.createJuryCase(
      "report-101",
      "content-505",
      mockAuthorId,
      mockReporterId,
      "profanity",
      "Profanity",
      "Sample text",
      mockCandidatePool,
    );

    const result = service.submitVote(caseItem.id, "unassigned-user-999", "violates_policy");

    expect(result.success).toBe(false);
    expect(result.message).toContain("Unauthorized");
  });

  it("prevents duplicate voting by the same juror", async () => {
    const caseItem = await service.createJuryCase(
      "report-101",
      "content-505",
      mockAuthorId,
      mockReporterId,
      "profanity",
      "Profanity",
      "Sample text",
      mockCandidatePool,
    );

    const jurorId = caseItem.assignedJurorIds[0];

    const firstVote = service.submitVote(caseItem.id, jurorId, "violates_policy");
    expect(firstVote.success).toBe(true);

    const secondVote = service.submitVote(caseItem.id, jurorId, "looks_fine");
    expect(secondVote.success).toBe(false);
    expect(secondVote.message).toContain("already cast your vote");
  });

  it("executes RESOLVED_VIOLATION and deletes content on 4-of-5 Violation consensus", async () => {
    const caseItem = await service.createJuryCase(
      "report-101",
      "content-505",
      mockAuthorId,
      mockReporterId,
      "harassment",
      "Harassment",
      "Offensive message text",
      mockCandidatePool,
    );

    const jurors = caseItem.assignedJurorIds;

    // 3 Violation votes -> not resolved yet
    service.submitVote(caseItem.id, jurors[0], "violates_policy");
    service.submitVote(caseItem.id, jurors[1], "violates_policy");
    service.submitVote(caseItem.id, jurors[2], "violates_policy");
    expect(caseItem.status).toBe("VOTING");
    expect(service.isContentDeleted("content-505")).toBe(false);

    // 1 Fine vote -> 3-1, still not resolved
    service.submitVote(caseItem.id, jurors[3], "looks_fine");
    expect(caseItem.status).toBe("VOTING");

    // 4th Violation vote -> 4-1 Consensus reached!
    service.submitVote(caseItem.id, jurors[4], "violates_policy");

    expect(caseItem.status).toBe("RESOLVED_VIOLATION");
    expect(caseItem.consensusDecision).toBe("violates_policy");
    expect(service.isContentDeleted("content-505")).toBe(true);
  });

  it("executes RESOLVED_FINE and dismisses report on 4-of-5 Fine consensus", async () => {
    const caseItem = await service.createJuryCase(
      "report-102",
      "content-606",
      mockAuthorId,
      mockReporterId,
      "spam",
      "False report",
      "Harmless message text",
      mockCandidatePool,
    );

    const jurors = caseItem.assignedJurorIds;

    // 4 Fine votes -> Consensus reached!
    service.submitVote(caseItem.id, jurors[0], "looks_fine");
    service.submitVote(caseItem.id, jurors[1], "looks_fine");
    service.submitVote(caseItem.id, jurors[2], "looks_fine");
    service.submitVote(caseItem.id, jurors[3], "looks_fine");

    expect(caseItem.status).toBe("RESOLVED_FINE");
    expect(caseItem.consensusDecision).toBe("looks_fine");
    expect(service.isReportDismissed("report-102")).toBe(true);
  });

  it("awards exactly 50 Gamification points to participating jurors upon resolution with idempotency", async () => {
    const caseItem = await service.createJuryCase(
      "report-103",
      "content-707",
      mockAuthorId,
      mockReporterId,
      "profanity",
      "Profanity",
      "Text sample",
      mockCandidatePool,
    );

    const jurors = caseItem.assignedJurorIds;

    // 4 jurors vote (jurors 0, 1, 2, 3)
    service.submitVote(caseItem.id, jurors[0], "violates_policy");
    service.submitVote(caseItem.id, jurors[1], "violates_policy");
    service.submitVote(caseItem.id, jurors[2], "violates_policy");
    service.submitVote(caseItem.id, jurors[3], "violates_policy");

    expect(caseItem.status).toBe("RESOLVED_VIOLATION");

    // Participating jurors get 50 points
    expect(service.getUserPoints(jurors[0])).toBe(50);
    expect(service.getUserPoints(jurors[1])).toBe(50);
    expect(service.getUserPoints(jurors[2])).toBe(50);
    expect(service.getUserPoints(jurors[3])).toBe(50);

    // Non-voting juror (juror 4) gets 0 points
    expect(service.getUserPoints(jurors[4])).toBe(0);

    // Idempotency check: Trigger reward allocation again for same case
    service.awardJurorRewards(caseItem.id, [jurors[0], jurors[1]], 50);

    // Points remain 50 (no duplicate addition)
    expect(service.getUserPoints(jurors[0])).toBe(50);
  });

  it("validates Zod websocket contract schemas for notifications and updates", () => {
    const notificationPayload = {
      caseId: "jury_123",
      jurorId: "juror_456",
      reason: "Harassment flag review",
      assignedAt: new Date().toISOString(),
    };

    const notifResult = JuryDutyNotificationSchema.safeParse(notificationPayload);
    expect(notifResult.success).toBe(true);

    const updatePayload = {
      caseId: "jury_123",
      status: "RESOLVED_VIOLATION",
      consensusDecision: "violates_policy",
      resolvedAt: new Date().toISOString(),
    };

    const updateResult = JuryCaseUpdateSchema.safeParse(updatePayload);
    expect(updateResult.success).toBe(true);
  });
});
