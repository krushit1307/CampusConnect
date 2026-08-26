import { describe, expect, it } from "vitest";

import {
  estimateProjectedTickets,
  formatRevenueCents,
  getRevenueForecastWarning,
} from "./revenueForecast";

describe("revenue forecast helpers", () => {
  it("formats cents as currency and surfaces only real shortfalls", () => {
    expect(formatRevenueCents(25000)).toBe("$250.00");
    expect(getRevenueForecastWarning(175000, 200000)).toContain("$250.00 loss");
    expect(getRevenueForecastWarning(200000, 175000)).toBeNull();
  });

  it("uses the historical sales curve when enough completed-event data exists", () => {
    expect(estimateProjectedTickets(150, 7, 0.5, 0, 500)).toBe(300);
  });

  it("falls back to current velocity and never projects below current sales or above capacity", () => {
    expect(estimateProjectedTickets(150, 7, 0, 10, 200)).toBe(200);
    expect(estimateProjectedTickets(0, 7, 0, 10, 200)).toBe(0);
  });

  it("rounds partial ticket projections up and treats zero capacity as unlimited", () => {
    expect(estimateProjectedTickets(3, 0, 0.6, 0, 0)).toBe(5);
    expect(estimateProjectedTickets(150, 7, 0, 10, 0)).toBe(220);
  });
});
