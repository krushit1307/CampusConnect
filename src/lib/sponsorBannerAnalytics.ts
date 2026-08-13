export interface SponsorBannerRecord {
  id: string;
  eventId: string;
  sponsorName: string;
  imageUrl: string;
  targetUrl: string;
  impressions: number;
  clicks: number;
}

export interface SponsorRoiReport {
  bannerId: string;
  sponsorName: string;
  impressions: number;
  clicks: number;
  clickThroughRatePercent: number; // CTR = (Clicks / Impressions) * 100
  performanceRating: "Excellent" | "Good" | "Average" | "Needs Improvement";
}

export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 Hour

/**
 * Validates aspect ratios for banner images (supports 16:9 or standard leaderboards 728x90).
 */
export function validateBannerDimensions(width: number, height: number): boolean {
  if (width <= 0 || height <= 0) return false;
  const ratio = width / height;

  const is16by9 = Math.abs(ratio - 16 / 9) <= 0.05;
  const isLeaderboard = Math.abs(ratio - 728 / 90) <= 0.1;

  return is16by9 || isLeaderboard;
}

/**
 * Calculates Click-Through Rate (CTR) percentage accurately.
 */
export function calculateCtr(clicks: number, impressions: number): number {
  if (impressions <= 0 || clicks <= 0) return 0.0;
  const ctr = (clicks / impressions) * 100;
  return Number(ctr.toFixed(2));
}

/**
 * Prevents click fraud by enforcing rate-limiting (max 1 recorded click per banner per user/IP per hour).
 */
export function shouldRecordClick(
  lastClickTimestamp: number | undefined,
  nowMs: number = Date.now(),
): boolean {
  if (!lastClickTimestamp) return true;
  return nowMs - lastClickTimestamp >= RATE_LIMIT_WINDOW_MS;
}

/**
 * Generates structured ROI report for corporate sponsors.
 */
export function generateSponsorRoiReport(banner: SponsorBannerRecord): SponsorRoiReport {
  const ctr = calculateCtr(banner.clicks, banner.impressions);

  let performanceRating: SponsorRoiReport["performanceRating"] = "Needs Improvement";
  if (ctr >= 5.0) {
    performanceRating = "Excellent";
  } else if (ctr >= 2.5) {
    performanceRating = "Good";
  } else if (ctr >= 1.0) {
    performanceRating = "Average";
  }

  return {
    bannerId: banner.id,
    sponsorName: banner.sponsorName,
    impressions: banner.impressions,
    clicks: banner.clicks,
    clickThroughRatePercent: ctr,
    performanceRating,
  };
}
