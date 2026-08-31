import { describe, it, expect } from "vitest";
import {
  calculateUnderdogMultiplier,
  calculateCategoricalWeightedScore,
  computeUnderdogClubLeaderboard,
  getMockUnderdogClubData,
  CATEGORY_WEIGHT_MULTIPLIERS,
} from "../underdogLeaderboardService";

describe("Dynamic Club Leaderboard Service (Underdog & Categorical Weighting)", () => {
  describe("calculateUnderdogMultiplier", () => {
    it("assigns higher multiplier boosts to smaller clubs with high active participation ratio", () => {
      const smallClubMult = calculateUnderdogMultiplier(15, 14, 60);
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

  describe("calculateCategoricalWeightedScore", () => {
    it("multiplies raw category points by category impact multipliers", () => {
      const rawPoints = {
        "Academic & Research": 100, // 100 * 1.40 = 140
        "Social & Recreational": 100, // 100 * 1.00 = 100
      };

      const result = calculateCategoricalWeightedScore(rawPoints);

      expect(result.categoricalPoints).toBe(240); // 140 + 100
      expect(result.effectiveMultiplier).toBe(1.2); // 240 / 200 = 1.2x
    });

    it("applies Diversity Bonus for multi-category participation (>= 3 categories)", () => {
      const rawPoints = {
        "Academic & Research": 100,
        "Community Service": 100,
        "Inter-Club Collaboration": 100,
      };

      const result = calculateCategoricalWeightedScore(rawPoints);

      // Raw weighted sum = (100*1.4) + (100*1.3) + (100*1.25) = 140 + 130 + 125 = 395
      // Diversity bonus (+10%) = 39.5 -> 40
      // Total = 435
      expect(result.diversityBonus).toBeGreaterThan(0);
      expect(result.categoricalPoints).toBeGreaterThan(395);
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
          raw_points: 3000,
        },
        {
          id: "small-active",
          name: "Small Active Club",
          member_count: 15,
          active_member_count: 14,
          raw_points: 1800,
        },
      ];

      const rawModeResult = computeUnderdogClubLeaderboard(mockRawClubs, "raw");
      expect(rawModeResult[0].club_id).toBe("mega-passive");

      const underdogModeResult = computeUnderdogClubLeaderboard(mockRawClubs, "underdog");
      expect(underdogModeResult[0].club_id).toBe("small-active");
      expect(underdogModeResult[0].badge).toBe("Underdog Surge 🔥");
    });

    it("supports categorical mode sorting based on weighted impact scores", () => {
      const mockClubs = [
        {
          id: "social-only",
          name: "Social Club",
          member_count: 50,
          raw_points: 1000,
          category_points: { "Social & Recreational": 1000 },
        },
        {
          id: "academic-stem",
          name: "Robotics Research Team",
          member_count: 50,
          raw_points: 900, // lower raw points, but 1.4x academic multiplier! (900 * 1.4 = 1260)
          category_points: { "Academic & Research": 900 },
        },
      ];

      const categoricalResult = computeUnderdogClubLeaderboard(mockClubs, "categorical");

      expect(categoricalResult[0].club_id).toBe("academic-stem");
      expect(categoricalResult[0].categorical_points).toBeGreaterThan(
        categoricalResult[1].categorical_points || 0
      );
    });
  });
});
