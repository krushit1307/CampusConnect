import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getTopUsersMonthlyLeaderboard,
  getTopClubsMonthlyLeaderboard,
} from "../gamificationLeaderboardService";
import { createClient } from "../../lib/supabase/client";

const mockRpc = vi.fn();

vi.mock("../../lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}));

describe("Gamification Leaderboard Service (#3894)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getTopUsersMonthlyLeaderboard", () => {
    it("fetches top 50 users for the current month", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            user_id: "u-1",
            first_name: "John",
            last_name: "Doe",
            avatar_url: "/avatar1.png",
            monthly_points: 150,
            rank_position: 1,
          },
        ],
        error: null,
      });

      const res = await getTopUsersMonthlyLeaderboard(50);
      expect(res.length).toBe(1);
      expect(res[0].first_name).toBe("John");
      expect(res[0].rank_position).toBe(1);
      expect(mockRpc).toHaveBeenCalledWith("get_top_users_monthly_leaderboard", {
        p_limit: 50,
      });
    });
  });

  describe("getTopClubsMonthlyLeaderboard", () => {
    it("fetches top 50 clubs for the current month", async () => {
      mockRpc.mockResolvedValue({
        data: [
          {
            club_id: "c-1",
            club_name: "Film Club",
            logo_url: "/logo1.png",
            slug: "film-club",
            monthly_points: 450,
            rank_position: 1,
          },
        ],
        error: null,
      });

      const res = await getTopClubsMonthlyLeaderboard(50);
      expect(res.length).toBe(1);
      expect(res[0].club_name).toBe("Film Club");
      expect(res[0].monthly_points).toBe(450);
      expect(mockRpc).toHaveBeenCalledWith("get_top_clubs_monthly_leaderboard", {
        p_limit: 50,
      });
    });
  });
});
