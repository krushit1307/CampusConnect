import { describe, expect, it } from "vitest";
import {
  FLASH_SALE_BOOKMARK_EMAIL,
  FLASH_SALE_TRIGGER_DISCOUNT_PERCENT,
  forecastPredictsRain,
  isHoursBeforeEventTriggerMet,
} from "./flashSaleTrigger";

describe("flash sale trigger rules (#4725)", () => {
  it("fires the 48-hour trigger once the event is inside that window", () => {
    const now = new Date("2026-09-01T12:00:00.000Z");
    expect(
      isHoursBeforeEventTriggerMet("2026-09-03T12:00:00.000Z", 48, now),
    ).toBe(true);
    expect(
      isHoursBeforeEventTriggerMet("2026-09-04T12:00:00.000Z", 48, now),
    ).toBe(false);
    expect(isHoursBeforeEventTriggerMet("2026-08-31T12:00:00.000Z", 48, now)).toBe(false);
  });

  it("treats OpenWeather rain conditions as a true weather trigger", () => {
    expect(forecastPredictsRain("Rain")).toBe(true);
    expect(forecastPredictsRain("Thunderstorm")).toBe(true);
    expect(forecastPredictsRain("Clear")).toBe(false);
  });

  it("uses the required 20% / 24-hour bookmark email copy", () => {
    expect(FLASH_SALE_TRIGGER_DISCOUNT_PERCENT).toBe(20);
    expect(FLASH_SALE_BOOKMARK_EMAIL).toBe(
      "FLASH SALE: Tickets are 20% off for the next 24 hours!",
    );
  });
});
