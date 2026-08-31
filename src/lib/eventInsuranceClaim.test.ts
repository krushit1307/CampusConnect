import { describe, expect, it } from "vitest";
import {
  EVENT_CANCELLATION_REASONS,
  buildInsuranceClaimPayload,
  dollarsToCents,
  isEventCancellationReason,
} from "./eventInsuranceClaim";

describe("event cancellation insurance claims (#4727)", () => {
  it("exposes dropdown reasons Severe Weather and Venue Damage", () => {
    expect(EVENT_CANCELLATION_REASONS).toEqual(["Severe Weather", "Venue Damage"]);
    expect(isEventCancellationReason("Severe Weather")).toBe(true);
    expect(isEventCancellationReason("Low Attendance")).toBe(false);
  });

  it("compiles lost_revenue, sunk_costs, and weather into an underwriter payload", () => {
    const payload = buildInsuranceClaimPayload({
      insurance_policy_id: "pol_next_123",
      event_id: "evt-blizzard",
      event_title: "Winter Festival",
      cancellation_date: "2026-08-26T00:00:00.000Z",
      reason: "Severe Weather",
      lost_revenue: 500_000,
      sunk_costs: 120_000,
      weather: {
        source: "openweathermap",
        observed_at: "2026-08-26T00:00:00.000Z",
        condition: "Snow",
        description: "blizzard",
        temperature_c: -12,
      },
    });

    expect(payload.insurance_policy_id).toBe("pol_next_123");
    expect(payload.lost_revenue).toBe(500_000);
    expect(payload.sunk_costs).toBe(120_000);
    expect(payload.weather?.condition).toBe("Snow");
    expect(dollarsToCents(12.5)).toBe(1250);
  });
});
