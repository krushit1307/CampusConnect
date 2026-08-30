// src/lib/dietaryForecast.ts
// -----------------------------------------------------------------------------
// Issue: #3931 — Implement 'Dynamic Dietary Restriction Forecasting'
// -----------------------------------------------------------------------------

export interface DietaryForecast {
  ok: boolean;
  event_id: string;
  event_title: string;
  venue_capacity: number;
  total_rsvps: number;
  current_weight: number;
  historical_weight: number;
  current_breakdown: CurrentBreakdownEntry[];
  historical_breakdown: HistoricalBreakdownEntry[];
  blended_forecast: BlendedForecastEntry[];
  summary: string;
  error?: string;
}

export interface CurrentBreakdownEntry {
  tag: string;
  count: number;
  percentage: number;
}

export interface HistoricalBreakdownEntry {
  tag: string;
  avg_percentage: number;
  event_count: number;
}

export interface BlendedForecastEntry {
  tag: string;
  current_percentage: number;
  historical_percentage: number;
  blended_percentage: number;
  current_count: number;
  historical_event_count: number;
  forecast_meals: number;
}

export function getForecastForTag(
  forecast: DietaryForecast,
  tag: string,
): BlendedForecastEntry | null {
  return forecast.blended_forecast.find((e) => e.tag === tag) ?? null;
}

export function totalForecastedMeals(forecast: DietaryForecast): number {
  return forecast.blended_forecast.reduce(
    (sum, e) => sum + e.forecast_meals,
    0,
  );
}

export function isHighConfidence(forecast: DietaryForecast): boolean {
  return forecast.current_weight >= 0.6;
}

export function confidenceLabel(forecast: DietaryForecast): string {
  if (forecast.current_weight >= 0.8) return "High";
  if (forecast.current_weight >= 0.4) return "Medium";
  return "Low";
}

export function confidenceColor(forecast: DietaryForecast): string {
  const label = confidenceLabel(forecast);
  if (label === "High") return "bg-green-100 text-green-800 border-green-400";
  if (label === "Medium") return "bg-amber-100 text-amber-800 border-amber-400";
  return "bg-red-100 text-red-800 border-red-400";
}

export function sortByForecastMeals(
  entries: BlendedForecastEntry[],
): BlendedForecastEntry[] {
  return [...entries].sort((a, b) => b.forecast_meals - a.forecast_meals);
}

export function topTags(
  forecast: DietaryForecast,
  topN: number = 5,
): BlendedForecastEntry[] {
  return sortByForecastMeals(forecast.blended_forecast)
    .filter((e) => e.tag !== "none")
    .slice(0, topN);
}
