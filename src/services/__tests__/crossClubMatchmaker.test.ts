import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateEventSimilarity,
  checkForCrossClubMatches,
  acceptCoHostCollaboration,
  SIMILARITY_THRESHOLD,
} from "../crossClubMatchmaker";
import { createClient } from "../../lib/supabase/client";

const mockFrom = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
  }),
}));

describe("Cross-Club Collaboration Matchmaker Service (#3686)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateEventSimilarity", () => {
    it("calculates similarity score > 85% for Film Club Sci-Fi Movie Night vs Sci-Fi Book Club Dune Discussion", () => {
      const score = calculateEventSimilarity(
        "Sci-Fi Movie Night",
        "Screening of Dune and sci-fi films",
        "Sci-Fi Dune Discussion",
        "Book discussion on Dune and sci-fi cinema",
      );

      expect(score).toBeGreaterThanOrEqual(0.85);
    });

    it("returns low similarity score for completely unrelated event drafts", () => {
      const score = calculateEventSimilarity(
        "Sci-Fi Movie Night",
        "Screening of Dune",
        "Beginner Chess Tournament",
        "Swiss system chess matches",
      );

      expect(score).toBeLessThan(0.3);
    });
  });

  describe("checkForCrossClubMatches", () => {
    it("detects cross-club draft matches with score > 85% and calculates pooled budget ($100 + $50 = $150)", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "cross_club_matches") {
          return {
            select: vi.fn().mockReturnValue({
              or: vi.fn().mockReturnValue({
                gte: vi.fn().mockResolvedValue({
                  data: [
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
                  error: null,
                }),
              }),
            }),
          };
        }
        return {};
      });

      const result = await checkForCrossClubMatches(
        "draft-film-1",
        "club-film",
        "Sci-Fi Movie Night",
      );

      expect(result.hasMatch).toBe(true);
      expect(result.matches.length).toBeGreaterThan(0);
      expect(result.matches[0].similarity_score).toBeGreaterThanOrEqual(0.85);
      expect(result.matches[0].pooled_budget).toBe(150);
      expect(result.matches[0].club_b_name).toBe("Sci-Fi Book Club");
    });
  });

  describe("acceptCoHostCollaboration", () => {
    it("merges two drafts into a Co-Hosted event and pools budgets ($150 total)", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "cross_club_matches") {
          return {
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
          };
        }
        if (table === "event_cohosts") {
          return {
            insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
          };
        }
        return {};
      });

      const result = await acceptCoHostCollaboration("match-101", {
        draft_a_id: "draft-film-1",
        club_b_id: "club-scifi-book",
        draft_a_budget: 100,
        draft_b_budget: 50,
        pooled_budget: 150,
      });

      expect(result.success).toBe(true);
      expect(result.pooledBudget).toBe(150);
    });
  });
});
