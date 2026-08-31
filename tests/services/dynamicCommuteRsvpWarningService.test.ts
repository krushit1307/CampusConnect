import { describe, it, expect } from "vitest";
import {
  DynamicCommuteRsvpWarningService,
  ScheduledEventSummary,
} from "../../src/services/dynamicCommuteRsvpWarningService";

describe("DynamicCommuteRsvpWarningService (#3942)", () => {
  const northCampusEvent: ScheduledEventSummary = {
    id: "event-north-01",
    title: "Quantum Physics Lab Demo",
    location: "North Campus Engineering Hall",
    coordinates: { latitude: 41.7082, longitude: -86.2365 },
    startDate: "2026-08-25T13:00:00Z",
    endDate: "2026-08-25T14:00:00Z", // Ends 2:00 PM
  };

  const southCampusEvent: ScheduledEventSummary = {
    id: "event-south-02",
    title: "Modern Sculpture Showcase",
    location: "South Campus Arts Center",
    coordinates: { latitude: 41.6934, longitude: -86.2389 },
    startDate: "2026-08-25T14:10:00Z", // Starts 2:10 PM (10 min gap)
    endDate: "2026-08-25T15:30:00Z",
  };

  const libraryCentralEvent: ScheduledEventSummary = {
    id: "event-lib-03",
    title: "AI Study Circle",
    location: "Central Library Plaza",
    coordinates: { latitude: 41.7015, longitude: -86.2358 },
    startDate: "2026-08-25T17:00:00Z",
    endDate: "2026-08-25T18:00:00Z",
  };

  it("should calculate Haversine distance between campus venues accurately", () => {
    const distKm = DynamicCommuteRsvpWarningService.calculateDistanceKm(
      northCampusEvent.coordinates,
      southCampusEvent.coordinates,
    );

    expect(distKm).toBeGreaterThan(1.5);
    expect(distKm).toBeLessThan(2.0);
  });

  it("should calculate transit duration with mode speeds and building buffer", () => {
    const distKm = 1.65;
    const walkMins = DynamicCommuteRsvpWarningService.calculateTransitDurationMinutes(
      distKm,
      "WALKING",
    );
    const bikeMins = DynamicCommuteRsvpWarningService.calculateTransitDurationMinutes(
      distKm,
      "BICYCLE",
    );
    const shuttleMins = DynamicCommuteRsvpWarningService.calculateTransitDurationMinutes(
      distKm,
      "CAMPUS_SHUTTLE",
    );

    expect(walkMins).toBeGreaterThanOrEqual(23); // ~24 mins
    expect(bikeMins).toBeLessThan(walkMins);
    expect(shuttleMins).toBeLessThan(walkMins);
  });

  it("should detect commute conflict when walking time > schedule gap (10 min gap vs ~24 min walk)", () => {
    const conflict = DynamicCommuteRsvpWarningService.analyzeCommuteConflict(
      southCampusEvent,
      [northCampusEvent],
      "WALKING",
    );

    expect(conflict).not.toBeNull();
    expect(conflict?.hasConflict).toBe(true);
    expect(conflict?.gapMinutes).toBe(10);
    expect(conflict?.transitDurationMinutes).toBeGreaterThan(20);
    expect(conflict?.timeDeficitMinutes).toBeGreaterThanOrEqual(10);
    expect(conflict?.warningMessage).toContain("Warning: It takes");
    expect(conflict?.warningMessage).toContain("10-minute gap");
    expect(conflict?.warningMessage).toContain("Quantum Physics Lab Demo");
  });

  it("should evaluate alternative transit options and determine feasibility", () => {
    const conflict = DynamicCommuteRsvpWarningService.analyzeCommuteConflict(
      southCampusEvent,
      [northCampusEvent],
      "WALKING",
    );

    expect(conflict).not.toBeNull();
    const bikeOption = conflict?.alternativeOptions.find((o) => o.mode === "BICYCLE");
    expect(bikeOption).toBeDefined();
    expect(bikeOption?.durationMinutes).toBeLessThan(conflict?.transitDurationMinutes || 30);
  });

  it("should return null conflict when events are far apart in time (>60 mins gap)", () => {
    const noConflict = DynamicCommuteRsvpWarningService.analyzeCommuteConflict(
      libraryCentralEvent,
      [northCampusEvent],
      "WALKING",
    );

    expect(noConflict).toBeNull();
  });

  it("should audit user warning decision correctly", () => {
    const audit = DynamicCommuteRsvpWarningService.logWarningDecision(
      "user-456",
      southCampusEvent.id,
      northCampusEvent.id,
      "SWITCHED_MODE",
      "BICYCLE",
    );

    expect(audit.logged).toBe(true);
    expect(audit.timestamp).toBeDefined();
  });
});
