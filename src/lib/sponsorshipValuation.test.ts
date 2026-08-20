import { describe, expect, it } from "vitest";
import {
  BASE_CPM_USD,
  calculateSponsorshipValue,
  formatSponsorshipCurrency,
  parseSponsorshipOverride,
} from "./sponsorshipValuation";

describe("sponsorship valuation", () => {
  it("blends event attendance and app impressions at the standard CPM", () => {
    const result = calculateSponsorshipValue({
      averageAttendance: 500,
      appImpressions: 0,
      targetedAudiencePercent: 0,
    });

    expect(result.qualifiedImpressions).toBe(1500);
    expect(result.baseValue).toBe((1500 / 1000) * BASE_CPM_USD);
    expect(result.suggestedPrice).toBe(75);
    expect(result.rangeLow).toBe(60);
    expect(result.rangeHigh).toBe(90);
  });

  it("increases the valuation for a highly targeted audience", () => {
    const broad = calculateSponsorshipValue({
      averageAttendance: 500,
      appImpressions: 0,
      targetedAudiencePercent: 0,
    });
    const targeted = calculateSponsorshipValue({
      averageAttendance: 500,
      appImpressions: 0,
      targetedAudiencePercent: 100,
    });

    expect(targeted.demographicMultiplier).toBe(1.4);
    expect(targeted.baseValue).toBeGreaterThan(broad.baseValue);
    expect(targeted.suggestedPrice).toBe(105);
  });

  it("sanitizes negative and non-finite reach inputs", () => {
    const result = calculateSponsorshipValue({
      averageAttendance: -500,
      appImpressions: Number.NaN,
      targetedAudiencePercent: 250,
    });

    expect(result.qualifiedImpressions).toBe(0);
    expect(result.baseValue).toBe(0);
    expect(result.suggestedPrice).toBe(0);
    expect(result.demographicMultiplier).toBe(1.4);
  });

  it("rounds manual overrides and falls back for invalid values", () => {
    expect(parseSponsorshipOverride("615", 500)).toBe(615);
    expect(parseSponsorshipOverride("612", 500)).toBe(610);
    expect(parseSponsorshipOverride("-20", 500)).toBe(500);
    expect(parseSponsorshipOverride("not-a-number", 500)).toBe(500);
    expect(formatSponsorshipCurrency(600)).toBe("$600");
  });
});
