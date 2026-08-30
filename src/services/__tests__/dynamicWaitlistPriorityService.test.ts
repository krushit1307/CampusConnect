import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  calculateDynamicPriorityScore,
  getRankedWaitlistForEvent,
  promoteTopPriorityWaitlistUser,
} from "../dynamicWaitlistPriorityService";
import { createClient } from "../../lib/supabase/client";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

describe("Dynamic Waitlist Priority Algorithm Service (#3874)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("calculateDynamicPriorityScore", () => {
    it("rewards Gamification XP & attendance streaks, and penalizes no-shows", () => {
      const now = new Date();
      const joinedAt = new Date(now.getTime() - 2 * 3600 * 1000); // 2 hours ago

      // Super user: 50 XP, 5 attendances, 0 no-shows
      const superUserScore = calculateDynamicPriorityScore(50, 5, 0, joinedAt, now);

      // Flaking user: 0 XP, 0 attendances, 2 no-shows
      const flakeUserScore = calculateDynamicPriorityScore(0, 0, 2, joinedAt, now);

      expect(superUserScore.final_priority_score).toBeGreaterThan(
        flakeUserScore.final_priority_score,
      );
      expect(superUserScore.gamification_bonus).toBe(125); // 50 * 2.5
      expect(superUserScore.attendance_bonus).toBe(50); // 5 * 10
      expect(flakeUserScore.no_show_penalty).toBe(50); // 2 * 25
    });
  });

  describe("getRankedWaitlistForEvent", () => {
    it("ranks Super-User with high XP & attendance at position #1 over flaking user", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "w-flake",
                event_id: "event-1",
                user_id: "user-flake",
                created_at: new Date(Date.now() - 5 * 3600 * 1000).toISOString(), // Joined 5h ago
                profiles: {
                  full_name: "Flaky User",
                  gamification_points: 0,
                  attendance_count: 0,
                  no_show_count: 2,
                },
              },
              {
                id: "w-super",
                event_id: "event-1",
                user_id: "user-super",
                created_at: new Date(Date.now() - 1 * 3600 * 1000).toISOString(), // Joined 1h ago
                profiles: {
                  full_name: "Super User",
                  gamification_points: 40,
                  attendance_count: 4,
                  no_show_count: 0,
                },
              },
            ],
            error: null,
          }),
        }),
      });

      const res = await getRankedWaitlistForEvent("event-1", "user-super");

      expect(res.allWaitlist.length).toBe(2);
      expect(res.allWaitlist[0].user_id).toBe("user-super"); // Super user ranked #1
      expect(res.allWaitlist[0].rank_position).toBe(1);
      expect(res.allWaitlist[1].user_id).toBe("user-flake");
      expect(res.userRank?.rank_position).toBe(1);
    });
  });

  describe("promoteTopPriorityWaitlistUser", () => {
    it("promotes highest priority score waitlisted user", async () => {
      mockRpc.mockResolvedValue({
        data: {
          success: true,
          promoted_user_id: "user-super",
          user_full_name: "Super User",
          priority_score: 239,
        },
        error: null,
      });

      const res = await promoteTopPriorityWaitlistUser("event-1");

      expect(res.success).toBe(true);
      expect(res.promotedUserName).toBe("Super User");
      expect(res.priorityScore).toBe(239);
    });
  });
});
