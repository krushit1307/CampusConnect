export type DepreciationMethod = "straight_line" | "declining_balance" | "units_of_production";
export type AssetCondition = "new" | "good" | "fair" | "poor";

export interface ClubAsset {
  id: string;
  club_id: string;
  name: string;
  category: string;
  acquisition_cost: number; // integer minor units (e.g. cents)
  acquisition_date: string; // ISO date string YYYY-MM-DD
  useful_life_months: number;
  salvage_value: number; // integer minor units
  depreciation_method: DepreciationMethod;
  declining_balance_rate?: number; // e.g. 0.20 for 20% annual rate
  total_expected_units?: number; // for units_of_production
  units_used_to_date?: number; // for units_of_production
  condition: AssetCondition;
  disposal_date?: string | null; // ISO date or null
  inventory_item_id?: string | null;
}

export interface ReplacementForecastItem {
  assetId: string;
  assetName: string;
  replacementYear: number;
  unadjustedReplacementCost: number; // acquisition cost
  inflatedReplacementCost: number; // inflated cost
}

export interface YearlyForecast {
  year: number;
  totalCost: number;
  assets: ReplacementForecastItem[];
}

export interface SinkingFundSummary {
  planningHorizonYears: number;
  totalProjectedReplacementCost: number;
  currentReserveBalance: number;
  fundingShortfall: number;
  requiredContributionPerPeriod: number; // integer minor units
  totalPeriods: number;
}

/**
 * Multiplier for asset condition reducing effective useful life.
 */
export function getConditionLifeMultiplier(condition: AssetCondition): number {
  switch (condition) {
    case "new":
      return 1.0;
    case "good":
      return 0.9;
    case "fair":
      return 0.75;
    case "poor":
      return 0.5;
    default:
      return 1.0;
  }
}

/**
 * Calculates effective useful life in months considering condition shortening.
 */
export function getAdjustedUsefulLifeMonths(asset: ClubAsset): number {
  const multiplier = getConditionLifeMultiplier(asset.condition);
  return Math.max(1, Math.round(asset.useful_life_months * multiplier));
}

/**
 * Calculates the current book value of a club asset at any specified target date.
 */
export function calculateBookValue(asset: ClubAsset, asOfDateInput: Date | string): number {
  const asOfDate = new Date(asOfDateInput);
  const acqDate = new Date(asset.acquisition_date);

  // Before acquisition
  if (asOfDate < acqDate) {
    return asset.acquisition_cost;
  }

  // Disposed asset
  if (asset.disposal_date && asOfDate >= new Date(asset.disposal_date)) {
    return 0;
  }

  const depreciableBase = Math.max(0, asset.acquisition_cost - asset.salvage_value);
  if (depreciableBase === 0) {
    return asset.salvage_value;
  }

  let bookValue = asset.acquisition_cost;

  if (asset.depreciation_method === "units_of_production") {
    const totalUnits = asset.total_expected_units || 1;
    const unitsUsed = Math.min(totalUnits, asset.units_used_to_date || 0);
    const accumulatedDepreciation = Math.round((depreciableBase * unitsUsed) / totalUnits);
    bookValue = asset.acquisition_cost - accumulatedDepreciation;
  } else {
    // Calculate elapsed full months + partial first month fraction
    const acqYear = acqDate.getFullYear();
    const acqMonth = acqDate.getMonth();
    const acqDay = acqDate.getDate();

    const daysInAcqMonth = new Date(acqYear, acqMonth + 1, 0).getDate();
    const partialFirstMonthFraction = (daysInAcqMonth - acqDay + 1) / daysInAcqMonth;

    const targetYear = asOfDate.getFullYear();
    const targetMonth = asOfDate.getMonth();

    const totalRawMonths = (targetYear - acqYear) * 12 + (targetMonth - acqMonth);

    if (totalRawMonths < 0) {
      return asset.acquisition_cost;
    }

    const elapsedMonths = totalRawMonths === 0 ? partialFirstMonthFraction : totalRawMonths + partialFirstMonthFraction;

    if (asset.depreciation_method === "straight_line") {
      const monthlyDepreciation = depreciableBase / asset.useful_life_months;
      const accumulatedDepreciation = Math.round(monthlyDepreciation * elapsedMonths);
      bookValue = asset.acquisition_cost - accumulatedDepreciation;
    } else if (asset.depreciation_method === "declining_balance") {
      // Annual rate default to double declining balance (2 / years)
      const annualRate = asset.declining_balance_rate || 2 / (asset.useful_life_months / 12);
      const monthlyRate = annualRate / 12;

      let currentVal = asset.acquisition_cost;
      const fullMonths = Math.floor(elapsedMonths);
      const partialFraction = elapsedMonths - fullMonths;

      for (let m = 1; m <= fullMonths; m++) {
        const remainingMonths = asset.useful_life_months - (m - 1);
        const straightLineMonthlyDep = remainingMonths > 0 ? (currentVal - asset.salvage_value) / remainingMonths : 0;
        const decliningMonthlyDep = currentVal * monthlyRate;

        // Switch to straight line when it yields higher depreciation
        const monthlyDep = Math.max(decliningMonthlyDep, straightLineMonthlyDep);
        currentVal -= monthlyDep;
      }

      if (partialFraction > 0) {
        currentVal -= currentVal * monthlyRate * partialFraction;
      }

      bookValue = Math.round(currentVal);
    }
  }

  // Book value bounds enforcement: salvage_value <= bookValue <= acquisition_cost
  return Math.min(asset.acquisition_cost, Math.max(asset.salvage_value, bookValue));
}

/**
 * Generates replacement cost forecast grouped by calendar year across a planning horizon.
 */
export function calculateReplacementForecast(
  assets: ClubAsset[],
  currentYear: number,
  horizonYears: number = 3,
  annualInflationRate: number = 0.03
): YearlyForecast[] {
  const activeAssets = assets.filter((asset) => {
    if (!asset.disposal_date) return true;
    return new Date(asset.disposal_date).getFullYear() > currentYear;
  });

  const forecastMap = new Map<number, ReplacementForecastItem[]>();
  const endYear = currentYear + horizonYears - 1;

  for (let year = currentYear; year <= endYear; year++) {
    forecastMap.set(year, []);
  }

  for (const asset of activeAssets) {
    const acqYear = new Date(asset.acquisition_date).getFullYear();
    const adjustedLifeYears = Math.max(1, Math.ceil(getAdjustedUsefulLifeMonths(asset) / 12));
    const replacementYear = acqYear + adjustedLifeYears;

    if (replacementYear >= currentYear && replacementYear <= endYear) {
      const yearsFromCurrent = replacementYear - currentYear;
      const inflatedCost = Math.round(
        asset.acquisition_cost * Math.pow(1 + annualInflationRate, yearsFromCurrent)
      );

      const items = forecastMap.get(replacementYear) || [];
      items.push({
        assetId: asset.id,
        assetName: asset.name,
        replacementYear,
        unadjustedReplacementCost: asset.acquisition_cost,
        inflatedReplacementCost: inflatedCost,
      });
      forecastMap.set(replacementYear, items);
    }
  }

  const result: YearlyForecast[] = [];
  for (let year = currentYear; year <= endYear; year++) {
    const items = forecastMap.get(year) || [];
    const totalCost = items.reduce((sum, item) => sum + item.inflatedReplacementCost, 0);
    result.push({
      year,
      totalCost,
      assets: items,
    });
  }

  return result;
}

/**
 * Computes sinking fund required per-period contribution and shortfall against reserve.
 */
export function calculateSinkingFund(
  forecast: YearlyForecast[],
  currentReserveBalance: number,
  totalPeriods: number = 6 // e.g. 6 semesters across 3 years
): SinkingFundSummary {
  const totalProjectedCost = forecast.reduce((sum, yr) => sum + yr.totalCost, 0);
  const shortfall = Math.max(0, totalProjectedCost - currentReserveBalance);
  const contribution = totalPeriods > 0 ? Math.ceil(shortfall / totalPeriods) : shortfall;

  return {
    planningHorizonYears: forecast.length,
    totalProjectedReplacementCost: totalProjectedCost,
    currentReserveBalance,
    fundingShortfall: shortfall,
    requiredContributionPerPeriod: contribution,
    totalPeriods,
  };
}
