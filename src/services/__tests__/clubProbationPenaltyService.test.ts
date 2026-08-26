// =============================================================================
// Tests: ClubProbationPenaltyService
// Issue: #4533 - Develop a 'Dynamic "Club Leaderboard" Probation Penalty'
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  isClubOnActiveProbation,
  getClubActiveProbation,
  awardPointsWithProbationCheck,
  retroactivelyDeductProbationEventPoints,
  PROBATION_FROZEN_WARNING,
} from "../clubProbationPenaltyService";

const mockInvoke = vi.fn();
const mockRpc = vi.fn();
const mockFrom = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    functions: {
      invoke: mockInvoke,
    },
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

describe("clubProbationPenaltyService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isClubOnActiveProbation", () => {
    it("returns true when club has an active record in club_probations", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: "prob-1", status: "active" }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await isClubOnActiveProbation("club-101");
      expect(result).toBe(true);
    });

    it("returns true when club has status='probation' in clubs table", async () => {
      // First call (club_probations) returns empty
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      // Second call (clubs table) returns status='probation'
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: "probation" },
              error: null,
            }),
          }),
        }),
      });

      const result = await isClubOnActiveProbation("club-102");
      expect(result).toBe(true);
    });

    it("returns false when club is in good standing", async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: "active" },
              error: null,
            }),
          }),
        }),
      });

      const result = await isClubOnActiveProbation("club-good-standing");
      expect(result).toBe(false);
    });
  });

  describe("awardPointsWithProbationCheck", () => {
    it("completely blocks point allocation when club is on active probation", async () => {
      // Mock probation check returning true
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({
                  data: [{ id: "prob-1", status: "active" }],
                  error: null,
                }),
              }),
            }),
          }),
        }),
      });

      const result = await awardPointsWithProbationCheck("usr-1", "evt-unauthorized", 50, "club-probation");

      expect(result.success).toBe(false);
      expect(result.frozen).toBe(true);
      expect(result.points_awarded).toBe(0);
      expect(result.message).toBe(PROBATION_FROZEN_WARNING);
      expect(mockInvoke).not.toHaveBeenCalled();
    });

    it("allows point allocation when club is in good standing", async () => {
      // Mock probation check returning false
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              gt: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { status: "active" },
              error: null,
            }),
          }),
        }),
      });

      mockInvoke.mockResolvedValueOnce({
        data: {
          success: true,
          frozen: false,
          points_awarded: 75,
          multiplier: 1.5,
        },
        error: null,
      });

      const result = await awardPointsWithProbationCheck("usr-1", "evt-authorized", 50, "club-good");

      expect(result.success).toBe(true);
      expect(result.frozen).toBe(false);
      expect(result.points_awarded).toBe(75);
      expect(mockInvoke).toHaveBeenCalledWith("award_points", {
        body: { userId: "usr-1", eventId: "evt-authorized", basePoints: 50, clubId: "club-good" },
      });
    });
  });

  describe("retroactivelyDeductProbationEventPoints", () => {
    it("invokes RPC to retroactively deduct event points from unauthorized party", async () => {
      mockRpc.mockResolvedValueOnce({
        data: {
          success: true,
          club_id: "club-party",
          event_id: "evt-party",
          deducted_points: 10000,
          message: "Successfully retroactively deducted 10000 points.",
        },
        error: null,
      });

      const result = await retroactivelyDeductProbationEventPoints(
        "club-party",
        "evt-party",
        "Unauthorized massive party penalty",
      );

      expect(mockRpc).toHaveBeenCalledWith("retroactively_deduct_probation_event_points", {
        p_club_id: "club-party",
        p_event_id: "evt-party",
        p_reason: "Unauthorized massive party penalty",
      });
      expect(result.success).toBe(true);
      expect(result.deducted_points).toBe(10000);
    });
  });
});
