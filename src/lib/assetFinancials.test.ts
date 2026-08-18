import { describe, expect, it } from "vitest";
import {
  ClubAsset,
  calculateBookValue,
  calculateReplacementForecast,
  calculateSinkingFund,
  getAdjustedUsefulLifeMonths,
  getConditionLifeMultiplier,
} from "./assetFinancials";

describe("assetFinancials library", () => {
  const sampleAsset: ClubAsset = {
    id: "asset-1",
    club_id: "club-drama",
    name: "Lighting Desk 4K",
    category: "Electronics",
    acquisition_cost: 120000, // $1,200.00 in cents
    acquisition_date: "2024-01-01",
    useful_life_months: 36, // 3 years
    salvage_value: 12000, // $120.00 in cents
    depreciation_method: "straight_line",
    condition: "new",
  };

  describe("getConditionLifeMultiplier & getAdjustedUsefulLifeMonths", () => {
    it("should return correct condition multipliers", () => {
      expect(getConditionLifeMultiplier("new")).toBe(1.0);
      expect(getConditionLifeMultiplier("good")).toBe(0.9);
      expect(getConditionLifeMultiplier("fair")).toBe(0.75);
      expect(getConditionLifeMultiplier("poor")).toBe(0.5);
    });

    it("should shorten useful life for assets in poor condition", () => {
      const poorAsset: ClubAsset = { ...sampleAsset, condition: "poor" };
      expect(getAdjustedUsefulLifeMonths(poorAsset)).toBe(18); // 36 * 0.5
    });
  });

  describe("calculateBookValue - Straight Line", () => {
    it("should return full acquisition cost prior to acquisition date", () => {
      const result = calculateBookValue(sampleAsset, "2023-06-01");
      expect(result).toBe(120000);
    });

    it("should compute straight line book value mid-way through useful life", () => {
      // 18 months elapsed of 36 months = 50% depreciable base ($1,080 / 2 = $540)
      const result = calculateBookValue(sampleAsset, "2025-07-01");
      expect(result).toBe(66000); // 120000 - 54000 = 66000
    });

    it("should not drop below salvage value after full useful life", () => {
      const result = calculateBookValue(sampleAsset, "2028-01-01");
      expect(result).toBe(12000); // salvage value
    });

    it("should handle partial first month acquisition date", () => {
      const partialAsset: ClubAsset = {
        ...sampleAsset,
        acquisition_date: "2024-01-15",
      };
      const result = calculateBookValue(partialAsset, "2024-06-01");
      expect(result).toBeLessThan(120000);
      expect(result).toBeGreaterThan(12000);
    });
  });

  describe("calculateBookValue - Declining Balance", () => {
    it("should compute declining balance and enforce salvage bounds", () => {
      const dbAsset: ClubAsset = {
        ...sampleAsset,
        depreciation_method: "declining_balance",
        declining_balance_rate: 0.3,
      };

      const midVal = calculateBookValue(dbAsset, "2025-01-01");
      expect(midVal).toBeLessThan(120000);
      expect(midVal).toBeGreaterThanOrEqual(12000);

      const endVal = calculateBookValue(dbAsset, "2030-01-01");
      expect(endVal).toBe(12000);
    });
  });

  describe("calculateBookValue - Units of Production", () => {
    it("should compute depreciation based on units used", () => {
      const uopAsset: ClubAsset = {
        ...sampleAsset,
        depreciation_method: "units_of_production",
        total_expected_units: 1000,
        units_used_to_date: 500, // 50% usage
      };

      const result = calculateBookValue(uopAsset, "2025-01-01");
      expect(result).toBe(66000); // 120000 - (108000 * 0.5)
    });
  });

  describe("Disposed Assets", () => {
    it("should return 0 book value for disposed assets", () => {
      const disposedAsset: ClubAsset = {
        ...sampleAsset,
        disposal_date: "2025-03-01",
      };
      expect(calculateBookValue(disposedAsset, "2025-04-01")).toBe(0);
    });
  });

  describe("calculateReplacementForecast", () => {
    it("should project replacement costs with annual inflation", () => {
      const assets: ClubAsset[] = [
        {
          ...sampleAsset,
          acquisition_date: "2023-01-01", // Useful life 3 years -> replacement in 2026
        },
      ];

      const forecast = calculateReplacementForecast(assets, 2026, 3, 0.05);
      expect(forecast).toHaveLength(3);

      const yr2026 = forecast.find((f) => f.year === 2026);
      expect(yr2026).toBeDefined();
      expect(yr2026?.assets).toHaveLength(1);
      // At replacement year 2026 (0 years from 2026), inflated cost = 120000
      expect(yr2026?.totalCost).toBe(120000);
    });

    it("should exclude disposed assets from forecast", () => {
      const assets: ClubAsset[] = [
        {
          ...sampleAsset,
          acquisition_date: "2023-01-01",
          disposal_date: "2024-05-01",
        },
      ];

      const forecast = calculateReplacementForecast(assets, 2026, 3, 0.03);
      const totalAll = forecast.reduce((acc, y) => acc + y.totalCost, 0);
      expect(totalAll).toBe(0);
    });
  });

  describe("calculateSinkingFund", () => {
    it("should calculate required contribution per period and shortfall", () => {
      const forecast = [
        { year: 2026, totalCost: 100000, assets: [] },
        { year: 2027, totalCost: 50000, assets: [] },
        { year: 2028, totalCost: 0, assets: [] },
      ];

      const reserve = 30000;
      const periods = 6; // 6 semesters

      const summary = calculateSinkingFund(forecast, reserve, periods);

      expect(summary.totalProjectedReplacementCost).toBe(150000);
      expect(summary.currentReserveBalance).toBe(30000);
      expect(summary.fundingShortfall).toBe(120000);
      expect(summary.requiredContributionPerPeriod).toBe(20000); // 120000 / 6
    });
  });
});
