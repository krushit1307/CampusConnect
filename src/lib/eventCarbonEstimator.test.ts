import { describe, it, expect } from "vitest";
import {
  calculateEventCarbonFootprint,
  getGreenBadgeStatus,
  AVAILABLE_SUSTAINABLE_MITIGATIONS,
} from "./eventCarbonEstimator";

describe("Event Carbon Footprint Estimator Utility (#3590)", () => {
  it("calculates venue, transit, and catering emissions", () => {
    // 50 attendees, 2 hours, 1000 sqft, standard catering (3.5kg/person), no mitigations
    // Venue: 1000 * 2 * 0.12 = 240 kg
    // Transit: 50 * (0.35 * 2.4 + 0.65 * 0.2) = 50 * 0.97 = 48.5 kg
    // Catering: 50 * 3.5 = 175 kg
    // Raw Total: 240 + 48.5 + 175 = 463.5 kg
    const result = calculateEventCarbonFootprint({
      venueSqft: 1000,
      durationHours: 2,
      attendeeCount: 50,
      cateringType: "standard",
      mitigations: [],
    });

    expect(result.venueCo2Kg).toBe(240);
    expect(result.transitCo2Kg).toBe(48.5);
    expect(result.cateringCo2Kg).toBe(175);
    expect(result.mitigationSavingsKg).toBe(0);
    expect(result.totalCo2Kg).toBe(463.5);
    expect(result.isGreenCertified).toBe(false); // 463.5 / 50 = 9.27 kg/attendee (> 1.5kg)
  });

  it("reduces footprint when sustainable mitigations are applied", () => {
    // With 2 mitigations (zero_waste_packaging 15% + public_transit_shuttle 15% = 30% reduction)
    const result = calculateEventCarbonFootprint({
      venueSqft: 1000,
      durationHours: 2,
      attendeeCount: 50,
      cateringType: "standard",
      mitigations: ["zero_waste_packaging", "public_transit_shuttle"],
    });

    // 463.5 * 0.30 = 139.05 kg savings -> Total: 324.45 kg
    expect(result.mitigationSavingsKg).toBe(139.05);
    expect(result.totalCo2Kg).toBe(324.45);
  });

  it("qualifies as Green Certified when per-attendee emissions are <= 1.5 kg CO2e", () => {
    // 100 attendees, 1 hour outdoor/small space (200 sqft), vegan food (0.5kg), 3 mitigations
    // Venue: 200 * 1 * 0.12 = 24 kg
    // Transit: 100 * (0.1 * 2.4 + 0.9 * 0.2) = 42 kg (low commuter)
    // Catering: 100 * 0.5 = 50 kg
    // Raw Total = 116 kg
    // Mitigations (40% discount) -> 116 * 0.6 = 69.6 kg -> 0.70 kg/person (< 1.5 kg)
    const result = calculateEventCarbonFootprint({
      venueSqft: 200,
      durationHours: 1,
      attendeeCount: 100,
      commuterRatio: 0.1,
      cateringType: "vegan",
      mitigations: ["zero_waste_packaging", "public_transit_shuttle", "digital_collateral"],
    });

    expect(result.co2PerAttendeeKg).toBeLessThanOrEqual(1.5);
    expect(result.isGreenCertified).toBe(true);
    expect(result.sustainabilityScore).toBeGreaterThanOrEqual(85);
  });

  it("returns green badge status object", () => {
    const green = getGreenBadgeStatus(1.2);
    expect(green.isGreen).toBe(true);
    expect(green.label).toContain("Certified Green Event");

    const standard = getGreenBadgeStatus(4.8);
    expect(standard.isGreen).toBe(false);
  });
});
