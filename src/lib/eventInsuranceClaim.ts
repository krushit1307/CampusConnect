export const EVENT_CANCELLATION_REASONS = ["Severe Weather", "Venue Damage"] as const;

export type EventCancellationReason = (typeof EVENT_CANCELLATION_REASONS)[number];

export const FILE_CLAIM_PROMPT = "File Claim Automatically?";

export type InsuranceWeatherSnapshot = {
  source: string;
  observed_at: string;
  condition?: string;
  description?: string;
  temperature_c?: number;
  wind_speed_ms?: number;
  raw?: unknown;
};

export type InsuranceClaimInput = {
  insurance_policy_id: string;
  event_id: string;
  event_title: string;
  cancellation_date: string;
  reason: string;
  lost_revenue: number;
  sunk_costs: number;
  weather: InsuranceWeatherSnapshot | null;
};

export function isEventCancellationReason(value: string): value is EventCancellationReason {
  return (EVENT_CANCELLATION_REASONS as readonly string[]).includes(value);
}

export function dollarsToCents(amount: number): number {
  return Math.max(0, Math.round(Number(amount) * 100));
}

/** Standardized underwriter payload (Next Insurance / generic webhook). */
export function buildInsuranceClaimPayload(input: InsuranceClaimInput) {
  return {
    insurance_policy_id: input.insurance_policy_id,
    event_id: input.event_id,
    event_title: input.event_title,
    cancellation_date: input.cancellation_date,
    reason: input.reason,
    lost_revenue: input.lost_revenue,
    sunk_costs: input.sunk_costs,
    currency: "usd",
    weather: input.weather,
  };
}
