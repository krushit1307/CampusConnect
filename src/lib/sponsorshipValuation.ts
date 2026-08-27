export const BASE_CPM_USD = 50;
export const ATTENDANCE_IMPRESSION_MULTIPLIER = 3;
export const TARGETED_AUDIENCE_BONUS = 0.4;
export const RANGE_LOW_MULTIPLIER = 0.8;
export const RANGE_HIGH_MULTIPLIER = 1.2;

export interface SponsorshipValuationInput {
  averageAttendance: number;
  appImpressions: number;
  targetedAudiencePercent?: number;
}

export interface SponsorshipValuation {
  qualifiedImpressions: number;
  demographicMultiplier: number;
  baseValue: number;
  suggestedPrice: number;
  rangeLow: number;
  rangeHigh: number;
}

function nonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

function roundCurrency(value: number) {
  return Math.round(value / 5) * 5;
}

export function calculateSponsorshipValue({
  averageAttendance,
  appImpressions,
  targetedAudiencePercent = 0,
}: SponsorshipValuationInput): SponsorshipValuation {
  const attendance = nonNegative(averageAttendance);
  const impressions = nonNegative(appImpressions);
  const targeting = Math.min(100, Math.max(0, nonNegative(targetedAudiencePercent)));
  const qualifiedImpressions = impressions + attendance * ATTENDANCE_IMPRESSION_MULTIPLIER;
  const demographicMultiplier = 1 + (targeting / 100) * TARGETED_AUDIENCE_BONUS;
  const baseValue = (qualifiedImpressions / 1000) * BASE_CPM_USD * demographicMultiplier;
  const suggestedPrice = roundCurrency(baseValue);

  return {
    qualifiedImpressions: Math.round(qualifiedImpressions),
    demographicMultiplier: Number(demographicMultiplier.toFixed(2)),
    baseValue: Number(baseValue.toFixed(2)),
    suggestedPrice,
    rangeLow: roundCurrency(baseValue * RANGE_LOW_MULTIPLIER),
    rangeHigh: roundCurrency(baseValue * RANGE_HIGH_MULTIPLIER),
  };
}

export function parseSponsorshipOverride(value: string, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return roundCurrency(parsed);
}

export function formatSponsorshipCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Math.max(0, value));
}
