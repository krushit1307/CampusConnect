import { describe, it, expect } from "vitest";
import {
  CONDITION_LIFE_MULTIPLIER,
  accumulatedDepreciationCents,
  addMonths,
  bookValueCents,
  buildReplacementForecast,
  buildSinkingFundPlan,
  endOfLifeDate,
  monthsElapsed,
  overdueForReplacement,
  registerValueCents,
  remainingLifeMonths,
  type ClubAsset,
} from "./assetDepreciation";

function asset(overrides: Partial<ClubAsset> = {}): ClubAsset {
  return {
    id: "asset-1",
    clubId: "club-1",
    name: "PA system",
    category: "audio",
    acquisitionCostCents: 120_000,
    acquisitionDate: "2024-01-01",
    usefulLifeMonths: 60,
    salvageValueCents: 20_000,
    method: "straight_line",
    condition: "good",
    ...overrides,
  };
}

describe("club asset depreciation", () => {
  describe("elapsed time", () => {
    it("counts whole and partial months", () => {
      expect(monthsElapsed("2024-01-01", "2024-07-01")).toBeCloseTo(6, 1);
      expect(monthsElapsed("2024-01-01", "2024-01-16")).toBeCloseTo(0.5, 1);
    });

    it("never runs backwards", () => {
      expect(monthsElapsed("2024-07-01", "2024-01-01")).toBe(0);
    });

    it("clamps the day of month when adding months", () => {
      expect(addMonths("2024-01-31", 1)).toBe("2024-02-29");
      expect(addMonths("2024-01-01", 60)).toBe("2029-01-01");
    });
  });

  describe("straight line", () => {
    it("is worth the full cost on the day it was bought", () => {
      expect(bookValueCents(asset(), "2024-01-01")).toBe(120_000);
    });

    it("is worth the full cost before it was bought", () => {
      expect(bookValueCents(asset(), "2023-06-01")).toBe(120_000);
    });

    it("writes off an even share of the depreciable amount each year", () => {
      // 100,000 depreciable over 5 years is 20,000 a year.
      expect(bookValueCents(asset(), "2025-01-01")).toBeCloseTo(100_000, -2);
      expect(bookValueCents(asset(), "2027-01-01")).toBeCloseTo(60_000, -2);
    });

    it("charges only a part month for a mid-month purchase", () => {
      const value = bookValueCents(asset(), "2024-01-16");
      expect(value).toBeLessThan(120_000);
      expect(value).toBeGreaterThan(118_000);
    });

    it("stops at the salvage value at the end of its life", () => {
      expect(bookValueCents(asset(), "2029-01-01")).toBe(20_000);
      expect(bookValueCents(asset(), "2040-01-01")).toBe(20_000);
    });

    it("reports accumulated depreciation as the mirror of book value", () => {
      const value = bookValueCents(asset(), "2026-01-01");
      expect(accumulatedDepreciationCents(asset(), "2026-01-01")).toBe(120_000 - value);
    });
  });

  describe("declining balance", () => {
    const laptop = asset({
      method: "declining_balance",
      decliningRatePercent: 40,
      acquisitionCostCents: 100_000,
      salvageValueCents: 10_000,
      usefulLifeMonths: 48,
    });

    it("writes down fastest in the first year", () => {
      const afterOneYear = bookValueCents(laptop, "2025-01-01");
      const afterTwoYears = bookValueCents(laptop, "2026-01-01");
      expect(100_000 - afterOneYear).toBeGreaterThan(afterOneYear - afterTwoYears);
    });

    it("applies the declared rate for the first year", () => {
      // Within a few cents of 60,000: elapsed time is measured in average
      // months, so a leap year is fractionally longer than twelve of them.
      expect(bookValueCents(laptop, "2025-01-01")).toBeCloseTo(60_000, -3);
    });

    it("switches to straight line once that writes down faster", () => {
      // By the end of life straight line has reached salvage, so the switch
      // guarantees the asset is not left carrying value it does not have.
      expect(bookValueCents(laptop, "2028-01-01")).toBe(10_000);
    });

    it("falls back to a default rate when none is given", () => {
      const noRate = asset({ method: "declining_balance", decliningRatePercent: undefined });
      expect(bookValueCents(noRate, "2025-01-01")).toBeLessThan(120_000);
    });

    it("never falls below salvage value", () => {
      expect(bookValueCents(laptop, "2050-01-01")).toBe(10_000);
    });
  });

  describe("units of production", () => {
    const projector = asset({
      method: "units_of_production",
      acquisitionCostCents: 90_000,
      salvageValueCents: 10_000,
      totalExpectedUnits: 4_000,
      unitsUsed: 1_000,
    });

    it("depreciates in proportion to the hours actually used", () => {
      expect(bookValueCents(projector, "2026-01-01")).toBe(90_000 - 20_000);
    });

    it("ignores the calendar entirely", () => {
      expect(bookValueCents(projector, "2024-01-02")).toBe(bookValueCents(projector, "2030-01-01"));
    });

    it("stops at salvage value once the expected output is used up", () => {
      const spent = { ...projector, unitsUsed: 9_999 };
      expect(bookValueCents(spent, "2026-01-01")).toBe(10_000);
    });

    it("treats a missing usage figure as unused", () => {
      const unused = { ...projector, unitsUsed: undefined };
      expect(bookValueCents(unused, "2026-01-01")).toBe(90_000);
    });
  });

  describe("end of life", () => {
    it("uses the nominal life for an asset in good condition", () => {
      expect(endOfLifeDate(asset())).toBe("2029-01-01");
    });

    it("brings forward an asset in poor condition", () => {
      const worn = asset({ condition: "poor" });
      expect(endOfLifeDate(worn)).toBe("2027-01-01");
      expect(CONDITION_LIFE_MULTIPLIER.poor).toBeLessThan(1);
    });

    it("extends an asset that has been looked after", () => {
      expect(endOfLifeDate(asset({ condition: "excellent" }))).toBe("2029-07-01");
    });

    it("never reports negative remaining life", () => {
      expect(remainingLifeMonths(asset(), "2035-01-01")).toBe(0);
      expect(remainingLifeMonths(asset(), "2028-01-01")).toBe(12);
    });
  });

  describe("replacement forecast", () => {
    const register: ClubAsset[] = [
      asset({ id: "pa", acquisitionDate: "2024-01-01", usefulLifeMonths: 60 }),
      asset({
        id: "lights",
        acquisitionDate: "2023-01-01",
        usefulLifeMonths: 36,
        acquisitionCostCents: 60_000,
      }),
      asset({
        id: "camera",
        acquisitionDate: "2025-06-01",
        usefulLifeMonths: 48,
        acquisitionCostCents: 200_000,
      }),
      asset({
        id: "sold",
        acquisitionDate: "2022-01-01",
        usefulLifeMonths: 24,
        disposalDate: "2024-05-01",
      }),
    ];

    const forecast = buildReplacementForecast(register, {
      asOf: "2026-01-01",
      horizonYears: 5,
      inflationRatePercent: 5,
    });

    it("groups replacements by the year they fall due", () => {
      expect(forecast.years.map((year) => year.year)).toEqual([2026, 2029]);
    });

    it("pulls assets already past their end of life into the current year", () => {
      const currentYear = forecast.years.find((year) => year.year === 2026);
      expect(currentYear?.assetIds).toEqual(["lights"]);
    });

    it("leaves disposed assets out of the plan", () => {
      const allIds = forecast.years.flatMap((year) => year.assetIds);
      expect(allIds).not.toContain("sold");
    });

    it("applies inflation from the current year forwards", () => {
      const later = forecast.years.find((year) => year.year === 2029);
      expect(later?.baseCostCents).toBe(120_000 + 200_000);
      expect(later?.inflatedCostCents).toBe(Math.round(320_000 * Math.pow(1.05, 3)));
    });

    it("ignores replacements beyond the planning horizon", () => {
      const short = buildReplacementForecast(register, {
        asOf: "2026-01-01",
        horizonYears: 2,
        inflationRatePercent: 5,
      });
      expect(short.years.map((year) => year.year)).toEqual([2026]);
    });

    it("totals the inflated cost across the horizon", () => {
      const total = forecast.years.reduce((sum, year) => sum + year.inflatedCostCents, 0);
      expect(forecast.totalInflatedCents).toBe(total);
    });
  });

  describe("sinking fund", () => {
    const forecast = buildReplacementForecast(
      [asset({ id: "pa", acquisitionDate: "2022-01-01", usefulLifeMonths: 48 })],
      { asOf: "2026-01-01", horizonYears: 4, inflationRatePercent: 0 },
    );

    it("spreads the shortfall across the remaining contributions", () => {
      const plan = buildSinkingFundPlan(forecast, 20_000, 2);
      expect(plan.totalNeededCents).toBe(120_000);
      expect(plan.shortfallCents).toBe(100_000);
      expect(plan.contributionsRemaining).toBe(8);
      expect(plan.contributionPerPeriodCents).toBe(12_500);
    });

    it("reports a club that has already saved enough as fully funded", () => {
      const plan = buildSinkingFundPlan(forecast, 500_000, 2);
      expect(plan.shortfallCents).toBe(0);
      expect(plan.contributionPerPeriodCents).toBe(0);
      expect(plan.fullyFunded).toBe(true);
    });

    it("rounds the contribution up so the fund is never left short", () => {
      const plan = buildSinkingFundPlan(forecast, 0, 3);
      expect(plan.contributionPerPeriodCents * plan.contributionsRemaining).toBeGreaterThanOrEqual(
        plan.shortfallCents,
      );
    });

    it("treats a negative reserve as nothing saved", () => {
      const plan = buildSinkingFundPlan(forecast, -5_000, 1);
      expect(plan.currentReserveCents).toBe(0);
      expect(plan.shortfallCents).toBe(120_000);
    });
  });

  describe("register level views", () => {
    const register = [
      asset({ id: "a" }),
      asset({ id: "b", acquisitionCostCents: 50_000, salvageValueCents: 0 }),
      asset({ id: "gone", disposalDate: "2025-01-01" }),
    ];

    it("adds up the book value of everything still owned", () => {
      const total = registerValueCents(register, "2026-01-01");
      expect(total).toBe(
        bookValueCents(register[0], "2026-01-01") + bookValueCents(register[1], "2026-01-01"),
      );
    });

    it("lists assets that are already overdue for replacement", () => {
      const overdue = overdueForReplacement(register, "2030-01-01");
      expect(overdue.map((item) => item.id)).toEqual(["a", "b"]);
    });

    it("reports nothing overdue while everything is in life", () => {
      expect(overdueForReplacement(register, "2025-01-01")).toEqual([]);
    });
  });
});
