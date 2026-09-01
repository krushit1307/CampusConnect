// =============================================================================
// Component Tests: JuryReviewCard
// Issue: #5129 - Automated "Profanity/Harassment" Decentralized Content Moderation DAO
// Description: RTL component tests for blind voting interface, submitted state,
// consensus resolution badges, and 50-point reward banner.
// =============================================================================

import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { JuryReviewCard } from "../JuryReviewCard";
import { globalJuryModerationService } from "@/services/juryModerationService";
import { JuryCandidate } from "@/types/juryModeration";

describe("JuryReviewCard Component (#5129)", () => {
  let caseId: string;
  const jurorId = "juror-test-1";

  const mockCandidatePool: JuryCandidate[] = [
    {
      id: jurorId,
      fullName: "Juror One",
      rating: 4.8,
      reputationPoints: 100,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-2",
      fullName: "Juror Two",
      rating: 4.5,
      reputationPoints: 80,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-3",
      fullName: "Juror Three",
      rating: 4.2,
      reputationPoints: 60,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-4",
      fullName: "Juror Four",
      rating: 4.9,
      reputationPoints: 200,
      isActive: true,
      priorInfractionsCount: 0,
    },
    {
      id: "juror-5",
      fullName: "Juror Five",
      rating: 4.0,
      reputationPoints: 50,
      isActive: true,
      priorInfractionsCount: 0,
    },
  ];

  beforeEach(async () => {
    globalJuryModerationService.clearAll();

    const created = await globalJuryModerationService.createJuryCase(
      "report-777",
      "content-888",
      "author-123",
      "reporter-456",
      "profanity",
      "Profanity violation flag",
      "This is a test reported content string for jury review.",
      mockCandidatePool,
    );

    caseId = created.id;
  });

  afterEach(() => {
    globalJuryModerationService.clearAll();
  });

  it("renders reported content preview and blind voting action buttons", () => {
    render(<JuryReviewCard caseId={caseId} jurorId={jurorId} />);

    expect(screen.getByTestId("jury-review-card")).toBeInTheDocument();
    expect(
      screen.getByText(/This is a test reported content string for jury review./i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Profanity violation flag/i)).toBeInTheDocument();

    expect(screen.getByTestId("vote-violates-btn")).toBeInTheDocument();
    expect(screen.getByTestId("vote-fine-btn")).toBeInTheDocument();
  });

  it("records vote and updates UI state when 'Violates Policy' is clicked", () => {
    render(<JuryReviewCard caseId={caseId} jurorId={jurorId} />);

    const violatesBtn = screen.getByTestId("vote-violates-btn");

    act(() => {
      fireEvent.click(violatesBtn);
    });

    expect(screen.getByTestId("status-voted-badge")).toBeInTheDocument();
    expect(screen.getByText(/VIOLATES POLICY/i)).toBeInTheDocument();
  });

  it("displays resolution badge and 50 XP reward banner upon 4-of-5 consensus resolution", () => {
    // 3 other jurors vote "violates_policy"
    globalJuryModerationService.submitVote(caseId, "juror-2", "violates_policy");
    globalJuryModerationService.submitVote(caseId, "juror-3", "violates_policy");
    globalJuryModerationService.submitVote(caseId, "juror-4", "violates_policy");

    render(<JuryReviewCard caseId={caseId} jurorId={jurorId} />);

    // 4th vote cast by current juror -> Consensus reached!
    const violatesBtn = screen.getByTestId("vote-violates-btn");

    act(() => {
      fireEvent.click(violatesBtn);
    });

    expect(screen.getByTestId("status-resolved-badge")).toBeInTheDocument();
    expect(screen.getByTestId("status-resolved-badge")).toHaveTextContent("RESOLVED: VIOLATION");

    const rewardBanner = screen.getByTestId("reward-points-banner");
    expect(rewardBanner).toBeInTheDocument();
    expect(rewardBanner).toHaveTextContent("+50 XP");
  });
});
