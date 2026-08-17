/**
 * Club asset depreciation and replacement planning.
 *
 * The equipment rental system knows where a club's PA system is. It does not
 * know what it is worth, when it will need replacing, or whether the club is
 * putting enough aside to replace it. That gap is why the lighting desk always
 * seems to die two weeks before the spring production with nothing budgeted.
 *
 * This module answers three questions from the asset register:
 *
 *   1. What is the kit worth today?
 *   2. What has to be replaced, and in which year?
 *   3. How much should the club set aside each period to afford that?
 *
 * Amounts are integer cents throughout. Dates are ISO calendar dates in UTC.
 */

/** How the value of an asset is written down over its life. */
export type DepreciationMethod = "straight_line" | "declining_balance" | "units_of_production";

/** Physical state of an asset, which shortens or extends its remaining life. */
export type AssetCondition = "excellent" | "good" | "fair" | "poor";

export interface ClubAsset {
  id: string;
  clubId: string;
  name: string;
  category: string;
  acquisitionCostCents: number;
  /** ISO date the asset was bought. */
  acquisitionDate: string;
  usefulLifeMonths: number;
  /** What the asset is expected to be worth at the end of its life. */
  salvageValueCents: number;
  method: DepreciationMethod;
  /** Annual write-down rate for `declining_balance`, in percent. */
  decliningRatePercent?: number;
  /** Lifetime output for `units_of_production`, e.g. projector lamp hours. */
  totalExpectedUnits?: number;
  /** Output consumed so far, for `units_of_production`. */
  unitsUsed?: number;
  condition: AssetCondition;
  /** ISO date the asset left the register, if it has. */
  disposalDate?: string | null;
}

export interface ForecastYear {
  year: number;
  assetIds: string[];
  /** Replacement cost in today's money. */
  baseCostCents: number;
  /** Replacement cost with inflation applied to that year. */
  inflatedCostCents: number;
}

export interface ReplacementForecast {
  fromYear: number;
  horizonYears: number;
  inflationRatePercent: number;
  years: ForecastYear[];
  totalInflatedCents: number;
}

export interface SinkingFundPlan {
  totalNeededCents: number;
  currentReserveCents: number;
  shortfallCents: number;
  contributionsRemaining: number;
  contributionPerPeriodCents: number;
  fullyFunded: boolean;
}

/**
 * How condition changes the expected life of an asset. A projector in poor
 * condition will not last its nominal five years and the plan should say so.
 */
export const CONDITION_LIFE_MULTIPLIER: Record<AssetCondition, number> = {
  excellent: 1.1,
  good: 1,
  fair: 0.8,
  poor: 0.6,
};

/** Rate used when a declining balance asset does not specify one. */
export const DEFAULT_DECLINING_RATE_PERCENT = 40;

/** Average days in a month, used for partial period depreciation. */
const DAYS_PER_MONTH = 30.436_875;

/**
 * Months between two dates, as a fraction. An asset bought on the 20th is not
 * charged a full month of depreciation for the ten days it was owned.
 */
export function monthsElapsed(from: string, to: string): number {
  const start = parseIsoDate(from);
  const end = parseIsoDate(to);
  if (!start || !end) return 0;

  const days = (end.getTime() - start.getTime()) / 86_400_000;
  return Math.max(0, days / DAYS_PER_MONTH);
}

/**
 * What the asset is worth on a given date.
 *
 * Whatever the method, book value never rises above what was paid and never
 * falls below the salvage value, which is what makes the register safe to add
 * up into a balance sheet figure.
 */
export function bookValueCents(asset: ClubAsset, asOf: string): number {
  const cost = Math.max(0, Math.round(asset.acquisitionCostCents));
  const salvage = Math.min(cost, Math.max(0, Math.round(asset.salvageValueCents)));
  const depreciable = cost - salvage;

  if (depreciable === 0) return cost;
  if (compareIsoDates(asOf, asset.acquisitionDate) < 0) return cost;

  const elapsed = monthsElapsed(asset.acquisitionDate, asOf);
  const life = Math.max(1, asset.usefulLifeMonths);

  switch (asset.method) {
    case "units_of_production": {
      const total = Math.max(1, asset.totalExpectedUnits ?? 0);
      const used = Math.max(0, asset.unitsUsed ?? 0);
      const consumed = Math.min(1, used / total);
      return clampValue(cost - depreciable * consumed, salvage, cost);
    }

    case "declining_balance": {
      const rate = clampPercent(asset.decliningRatePercent ?? DEFAULT_DECLINING_RATE_PERCENT) / 100;
      const years = elapsed / 12;
      const declining = cost * Math.pow(1 - rate, years);

      // Accounting practice switches to straight line once that writes the
      // asset down faster, so it reaches salvage value by the end of its life.
      const straightLine = cost - depreciable * Math.min(1, elapsed / life);
      return clampValue(Math.min(declining, straightLine), salvage, cost);
    }

    default: {
      const fraction = Math.min(1, elapsed / life);
      return clampValue(cost - depreciable * fraction, salvage, cost);
    }
  }
}

/** How much of the asset's cost has been written off by a given date. */
export function accumulatedDepreciationCents(asset: ClubAsset, asOf: string): number {
  const cost = Math.max(0, Math.round(asset.acquisitionCostCents));
  return cost - bookValueCents(asset, asOf);
}

/**
 * When the asset is expected to need replacing, adjusted for its condition.
 * Something already in poor condition is brought forward rather than being
 * optimistically carried to its nominal end of life.
 */
export function endOfLifeDate(asset: ClubAsset): string {
  const multiplier = CONDITION_LIFE_MULTIPLIER[asset.condition] ?? 1;
  const adjustedMonths = Math.max(1, Math.round(asset.usefulLifeMonths * multiplier));
  return addMonths(asset.acquisitionDate, adjustedMonths);
}

/** Months of useful life left, never negative. */
export function remainingLifeMonths(asset: ClubAsset, asOf: string): number {
  const remaining = monthsElapsed(asOf, endOfLifeDate(asset));
  return Math.max(0, Math.round(remaining));
}

/**
 * Replacement schedule across a planning horizon.
 *
 * Assets already past their end of life are placed in the current year, since
 * they are the ones the club is running on borrowed time. Disposed assets are
 * out of the forecast entirely.
 */
export function buildReplacementForecast(
  assets: ClubAsset[],
  options: { asOf: string; horizonYears: number; inflationRatePercent: number },
): ReplacementForecast {
  const fromYear = yearOf(options.asOf) ?? new Date().getUTCFullYear();
  const horizon = Math.max(1, Math.floor(options.horizonYears));
  const inflation = Math.max(0, options.inflationRatePercent) / 100;

  const buckets = new Map<number, { assetIds: string[]; baseCostCents: number }>();

  for (const asset of assets) {
    if (asset.disposalDate) continue;

    const dueYear = Math.max(fromYear, yearOf(endOfLifeDate(asset)) ?? fromYear);
    if (dueYear > fromYear + horizon - 1) continue;

    const bucket = buckets.get(dueYear) ?? { assetIds: [], baseCostCents: 0 };
    bucket.assetIds.push(asset.id);
    bucket.baseCostCents += Math.max(0, Math.round(asset.acquisitionCostCents));
    buckets.set(dueYear, bucket);
  }

  const years: ForecastYear[] = [...buckets.entries()]
    .map(([year, bucket]) => ({
      year,
      assetIds: bucket.assetIds,
      baseCostCents: bucket.baseCostCents,
      inflatedCostCents: Math.round(
        bucket.baseCostCents * Math.pow(1 + inflation, year - fromYear),
      ),
    }))
    .sort((a, b) => a.year - b.year);

  return {
    fromYear,
    horizonYears: horizon,
    inflationRatePercent: options.inflationRatePercent,
    years,
    totalInflatedCents: years.reduce((total, year) => total + year.inflatedCostCents, 0),
  };
}

/**
 * What the club has to set aside each period to cover the forecast.
 *
 * The reserve already banked is deducted first, so a club that has been saving
 * is not asked to start again from zero.
 */
export function buildSinkingFundPlan(
  forecast: ReplacementForecast,
  currentReserveCents: number,
  contributionsPerYear: number,
): SinkingFundPlan {
  const reserve = Math.max(0, Math.round(currentReserveCents));
  const totalNeeded = forecast.totalInflatedCents;
  const shortfall = Math.max(0, totalNeeded - reserve);
  const contributions = Math.max(1, Math.round(contributionsPerYear * forecast.horizonYears));

  return {
    totalNeededCents: totalNeeded,
    currentReserveCents: reserve,
    shortfallCents: shortfall,
    contributionsRemaining: contributions,
    contributionPerPeriodCents: Math.ceil(shortfall / contributions),
    fullyFunded: shortfall === 0,
  };
}

/** Total book value of a register on a given date. */
export function registerValueCents(assets: ClubAsset[], asOf: string): number {
  return assets
    .filter((asset) => !asset.disposalDate)
    .reduce((total, asset) => total + bookValueCents(asset, asOf), 0);
}

/** Assets whose end of life has already passed, worst first. */
export function overdueForReplacement(assets: ClubAsset[], asOf: string): ClubAsset[] {
  return assets
    .filter((asset) => !asset.disposalDate)
    .filter((asset) => compareIsoDates(endOfLifeDate(asset), asOf) <= 0)
    .sort((a, b) => compareIsoDates(endOfLifeDate(a), endOfLifeDate(b)));
}

// ---------------------------------------------------------------------------
// Date and number helpers
// ---------------------------------------------------------------------------

function clampValue(value: number, min: number, max: number): number {
  return Math.round(Math.min(max, Math.max(min, value)));
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(99, value);
}

/** Parses YYYY-MM-DD into a UTC date, or null when it cannot be read. */
export function parseIsoDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Calendar year of an ISO date. */
export function yearOf(value: string): number | null {
  const match = /^(\d{4})/.exec(value ?? "");
  return match ? Number(match[1]) : null;
}

/** Adds whole months, clamping the day of month to the end of short months. */
export function addMonths(isoDate: string, months: number): string {
  const date = parseIsoDate(isoDate);
  if (!date) return isoDate;

  const day = date.getUTCDate();
  const shifted = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  const daysInMonth = new Date(
    Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, 0),
  ).getUTCDate();

  shifted.setUTCDate(Math.min(day, daysInMonth));
  return shifted.toISOString().slice(0, 10);
}

/** Compares two ISO dates, which sort lexicographically as well as by time. */
export function compareIsoDates(left: string, right: string): number {
  const a = (left ?? "").slice(0, 10);
  const b = (right ?? "").slice(0, 10);
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
