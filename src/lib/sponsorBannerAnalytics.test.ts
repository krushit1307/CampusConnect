import { describe, it, expect } from "vitest";
import {
  validateBannerDimensions,
  calculateCtr,
  shouldRecordClick,
  generateSponsorRoiReport,
  SponsorBannerRecord,
  RATE_LIMIT_WINDOW_MS,
} from "./sponsorBannerAnalytics";

describe("Event Sponsorship Banners Analytics Suite (#2999)", () => {
  const sampleBanner: SponsorBannerRecord = {
    id: "b_100",
    eventId: "e_gala_2026",
    sponsorName: "Red Bull",
    imageUrl: "https://storage.campusconnect.edu/banners/redbull.png",
    targetUrl: "https://redbull.com",
    impressions: 2000,
    clicks: 80,
  };

  it("validates 16:9 and 728x90 banner aspect ratios", () => {
    expect(validateBannerDimensions(1920, 1080)).toBe(true); // 16:9
    expect(validateBannerDimensions(728, 90)).toBe(true); // Leaderboard
    expect(validateBannerDimensions(500, 500)).toBe(false); // Square 1:1
  });

  it("calculates Click-Through Rate (CTR) percentage correctly", () => {
    const ctr = calculateCtr(80, 2000); // 80 / 2000 = 4%
    expect(ctr).toBe(4.0);

    expect(calculateCtr(0, 500)).toBe(0.0);
  });

  it("rate-limits rapid click fraud attempts within 1 hour window", () => {
    const baseTime = 1000000000000;

    // First click allowed
    expect(shouldRecordClick(undefined, baseTime)).toBe(true);

    // Rapid second click 5 minutes later blocked
    expect(shouldRecordClick(baseTime, baseTime + 5 * 60 * 1000)).toBe(false);

    // Click after 1 hour window allowed
    expect(shouldRecordClick(baseTime, baseTime + RATE_LIMIT_WINDOW_MS + 1)).toBe(true);
  });

  it("generates sponsor ROI performance report with CTR ratings", () => {
    const report = generateSponsorRoiReport(sampleBanner);

    expect(report.sponsorName).toBe("Red Bull");
    expect(report.clickThroughRatePercent).toBe(4.0);
    expect(report.performanceRating).toBe("Good"); // 2.5% <= 4.0% < 5.0%
  });
});
