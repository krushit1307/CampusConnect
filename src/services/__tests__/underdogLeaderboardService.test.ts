import { describe, it, expect } from "vitest";
import {
  calculateUnderdogMultiplier,
  computeUnderdogClubLeaderboard,
  getMockUnderdogClubData,
} from "../underdogLeaderboardService";

describe("Dynamic Club Leaderboard Underdog Multiplier Service", () => {
  describe("calculateUnderdogMultiplier", () => {
    it("assigns higher multiplier boosts to smaller clubs with high active participation ratio", () => {
      // Small club (15 members, 14 active = ~93% active ratio)
      const smallClubMult = calculateUnderdogMultiplier(15, 14, 60);

      // Large mega club (400 members, 120 active = ~30% active ratio)
      const megaClubMult = calculateUnderdogMultiplier(400, 120, 60);

      expect(smallClubMult).toBeGreaterThan(megaClubMult);
      expect(smallClubMult).toBeGreaterThanOrEqual(1.5);
      expect(megaClubMult).toBe(1.0);
    });

    it("caps the Underdog Multiplier between 1.0x and 2.2x", () => {
      const minMult = calculateUnderdogMultiplier(1000, 10, 60);
      const maxMult = calculateUnderdogMultiplier(5, 5, 60);

      expect(minMult).toBe(1.0);
      expect(maxMult).toBeLessThanOrEqual(2.2);
    });
  });

  describe("computeUnderdogClubLeaderboard", () => {
    it("elevates small highly-active clubs in underdog mode over passive mega-clubs", () => {
      const mockRawClubs = [
        {
          id: "mega-passive",
          name: "Mega Passive Club",
          member_count: 500,
          active_member_count: 50,
          raw_points: 3000, // High total raw points due to volume
        },
        {
          id: "small-active",
          name: "Small Active Club",
          member_count: 15,
          active_member_count: 14,
          raw_points: 1800, // Lower raw points, but huge per-capita density (120 pts/member!)
        },
      ];

      // In RAW mode, Mega Passive is #1, Small Active is #2
      const rawModeResult = computeUnderdogClubLeaderboard(mockRawClubs, "raw");
      expect(rawModeResult[0].club_id).toBe("mega-passive");
      expect(rawModeResult[1].club_id).toBe("small-active");

      // In UNDERDOG mode, Small Active gets boosted and takes #1 rank!
      const underdogModeResult = computeUnderdogClubLeaderboard(mockRawClubs, "underdog");
      expect(underdogModeResult[0].club_id).toBe("small-active");
      expect(underdogModeResult[0].badge).toBe("Underdog Surge 🔥");
      expect(underdogModeResult[0].rank_delta).toBeGreaterThan(0);
    });

    it("computes per_capita_points and rank_delta accurately", () => {
      const sampleClubs = getMockUnderdogClubData();
      const result = computeUnderdogClubLeaderboard(sampleClubs, "underdog");

      expect(result.length).toBe(sampleClubs.length);
      const firstPlace = result[0];

      expect(firstPlace.per_capita_points).toBe(
        Math.round((firstPlace.raw_points / firstPlace.member_count) * 10) / 10
      );
      expect(firstPlace.underdog_multiplier).toBeGreaterThanOrEqual(1.0);
      expect(firstPlace.rank_position).toBe(1);
    });
  });
});
