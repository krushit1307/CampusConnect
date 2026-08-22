import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { CrossClubMatchmakerWidget } from "../events/CrossClubMatchmakerWidget";
import {
  checkForCrossClubMatches,
  acceptCoHostCollaboration,
} from "@/services/crossClubMatchmaker";

vi.mock("@/services/crossClubMatchmaker", () => ({
  checkForCrossClubMatches: vi.fn(),
  acceptCoHostCollaboration: vi.fn(),
}));

describe("CrossClubMatchmakerWidget Component (#3686)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders AI cross-club match banner when similarity > 85%", async () => {
    (checkForCrossClubMatches as any).mockResolvedValue({
      hasMatch: true,
      matches: [
        {
          id: "match-101",
          draft_a_id: "draft-film-1",
          draft_b_id: "draft-scifi-2",
          club_a_id: "club-film",
          club_b_id: "club-scifi-book",
          club_a_name: "Film Club",
          club_b_name: "Sci-Fi Book Club",
          similarity_score: 0.88,
          status: "PENDING",
          draft_a_budget: 100,
          draft_b_budget: 50,
          pooled_budget: 150,
        },
      ],
    });

    render(
      <CrossClubMatchmakerWidget
        draftId="draft-film-1"
        clubId="club-film"
        title="Sci-Fi Movie Night"
        budget={100}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("cross-club-matchmaker-widget")).toBeInTheDocument();
      expect(
        screen.getByText(/CROSS-CLUB COLLABORATION MATCH \(88% Similarity\)/i),
      ).toBeInTheDocument();
      expect(screen.getByText(/Sci-Fi Book Club/i)).toBeInTheDocument();
      expect(screen.getByTestId("accept-cohost-btn")).toBeInTheDocument();
    });
  });

  it("triggers 1-click acceptCoHostCollaboration when Propose Co-Host button is clicked", async () => {
    (checkForCrossClubMatches as any).mockResolvedValue({
      hasMatch: true,
      matches: [
        {
          id: "match-101",
          draft_a_id: "draft-film-1",
          draft_b_id: "draft-scifi-2",
          club_a_id: "club-film",
          club_b_id: "club-scifi-book",
          club_a_name: "Film Club",
          club_b_name: "Sci-Fi Book Club",
          similarity_score: 0.88,
          status: "PENDING",
          draft_a_budget: 100,
          draft_b_budget: 50,
          pooled_budget: 150,
        },
      ],
    });

    (acceptCoHostCollaboration as any).mockResolvedValue({
      success: true,
      pooledBudget: 150,
    });

    const mockCallback = vi.fn();

    render(
      <CrossClubMatchmakerWidget
        draftId="draft-film-1"
        clubId="club-film"
        title="Sci-Fi Movie Night"
        budget={100}
        onCoHostAccepted={mockCallback}
      />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("accept-cohost-btn")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("accept-cohost-btn"));

    await waitFor(() => {
      expect(acceptCoHostCollaboration).toHaveBeenCalledWith("match-101", expect.anything());
      expect(mockCallback).toHaveBeenCalledWith(150);
      expect(screen.getByText(/Co-Host Partnership Established!/i)).toBeInTheDocument();
    });
  });
});
