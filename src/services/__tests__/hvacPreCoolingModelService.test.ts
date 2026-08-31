import { describe, it, expect } from "vitest";
import {
  HvacPreCoolingModelService,
  HUMAN_HEAT_OUTPUT_BTU_PER_HOUR,
  HvacModelInput,
} from "../hvacPreCoolingModelService";

describe("HvacPreCoolingModelService (#5355)", () => {
  const defaultTime = "2026-06-15T18:00:00Z";

  it("1. Heat-load calculation for zero, normal, and large attendee counts", () => {
    // Zero attendees
    const zeroRes = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 0,
      venueAreaSqFt: 5000,
      eventStartTime: defaultTime,
    });
    expect(zeroRes.breakdown.humanHeatLoadBtu).toBe(0);

    // Normal attendees (100)
    const normalRes = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 100,
      venueAreaSqFt: 5000,
      eventStartTime: defaultTime,
    });
    expect(normalRes.breakdown.humanHeatLoadBtu).toBe(100 * HUMAN_HEAT_OUTPUT_BTU_PER_HOUR);

    // Large attendees (5,000)
    const largeRes = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 5000,
      venueAreaSqFt: 5000,
      eventStartTime: defaultTime,
    });
    expect(largeRes.breakdown.humanHeatLoadBtu).toBe(5000 * HUMAN_HEAT_OUTPUT_BTU_PER_HOUR);

    // Negative attendee count validation rejection
    expect(() =>
      HvacPreCoolingModelService.predictPreCooling({
        attendeeCount: -50,
        eventStartTime: defaultTime,
      }),
    ).toThrow("Invalid input: attendeeCount must be a non-negative finite number.");
  });

  it("2. Venue constraints and invalid dimension rejections", () => {
    // Valid dimensions
    const validRes = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 200,
      venueAreaSqFt: 4000,
      venueHeightFt: 15,
      eventStartTime: defaultTime,
    });
    expect(validRes.breakdown.equipmentHeatLoadBtu).toBeGreaterThan(0);

    // Invalid area rejection
    expect(() =>
      HvacPreCoolingModelService.predictPreCooling({
        attendeeCount: 100,
        venueAreaSqFt: -100,
        eventStartTime: defaultTime,
      }),
    ).toThrow("Invalid input: venueAreaSqFt must be a positive finite number.");
  });

  it("3. Weather input integration and extreme heat handling", () => {
    // Normal weather (75°F)
    const normalWeather = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 500,
      outdoorTemperatureF: 75,
      eventStartTime: defaultTime,
    });

    // Extreme heat weather (105°F)
    const extremeWeather = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 500,
      outdoorTemperatureF: 105,
      eventStartTime: defaultTime,
    });

    expect(extremeWeather.breakdown.outdoorGainBtu).toBeGreaterThan(
      normalWeather.breakdown.outdoorGainBtu,
    );
    expect(extremeWeather.recommendedPreCoolingMinutes).toBeGreaterThanOrEqual(
      normalWeather.recommendedPreCoolingMinutes,
    );
  });

  it("4. Resource constraint level evaluation (low, moderate, high, critical)", () => {
    // Low constraint
    const lowRes = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 50,
      hvacCapacityBtuPerHour: 200000,
      eventStartTime: defaultTime,
    });
    expect(lowRes.resourceConstraintLevel).toBe("low");
    expect(lowRes.warningMessage).toBeNull();

    // High/Critical constraint (5,000 attendees vs 100k BTU/hr capacity)
    const criticalRes = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 5000,
      hvacCapacityBtuPerHour: 100000,
      eventStartTime: defaultTime,
    });
    expect(["high", "critical"]).toContain(criticalRes.resourceConstraintLevel);
    expect(criticalRes.warningMessage).toBeDefined();
    expect(criticalRes.warningMessage).toContain("HIGH RESOURCE CONSTRAINT");
  });

  it("5. Six-Hour Pre-Cooling timing and start time calculation", () => {
    const eventTime = "2026-06-15T18:00:00.000Z"; // 6:00 PM
    const res = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 3000,
      outdoorTemperatureF: 95,
      hvacCapacityBtuPerHour: 80000,
      eventStartTime: eventTime,
    });

    // Pre-cooling duration clamped to max 360 min (6.0 hours)
    expect(res.recommendedPreCoolingMinutes).toBeLessThanOrEqual(360);
    expect(res.recommendedPreCoolingDurationHours).toBeLessThanOrEqual(6.0);

    const startMs = new Date(res.recommendedStartTime).getTime();
    const eventMs = new Date(eventTime).getTime();
    expect(eventMs - startMs).toBe(res.recommendedPreCoolingMinutes * 60 * 1000);
  });

  it("6. Model determinism: identical inputs produce identical output", () => {
    const input: HvacModelInput = {
      attendeeCount: 850,
      venueAreaSqFt: 6000,
      outdoorTemperatureF: 92,
      currentIndoorTemperatureF: 74,
      targetTemperatureF: 67,
      eventStartTime: defaultTime,
    };

    const res1 = HvacPreCoolingModelService.predictPreCooling(input);
    const res2 = HvacPreCoolingModelService.predictPreCooling(input);

    expect(res1).toEqual(res2);
  });

  it("7. BACnet simulation control adapter output", () => {
    const prediction = HvacPreCoolingModelService.predictPreCooling({
      attendeeCount: 1000,
      eventStartTime: defaultTime,
    });

    const bacnet = HvacPreCoolingModelService.simulateBacnetCommand("venue-main-hall", prediction);
    expect(bacnet.success).toBe(true);
    expect(bacnet.payload.venueId).toBe("venue-main-hall");
    expect(bacnet.message).toContain("SIMULATED BACnet Control Dispatch");
  });
});
