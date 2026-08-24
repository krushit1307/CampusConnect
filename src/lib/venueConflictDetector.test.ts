import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistanceMeters,
  isTimeWindowOverlapping,
  detectVenueCollision,
  ExistingEventGeo,
  ProposedEventVenue,
} from "./venueConflictDetector";

describe("Smart Venue Conflict Resolution System Suite (#3880)", () => {
  const mainQuadLat = 37.7749;
  const mainQuadLng = -122.4194;

  const existingEvent: ExistingEventGeo = {
    id: "evt_arts_expo",
    title: "Arts & Crafts Expo",
    clubName: "Arts Club",
    latitude: mainQuadLat,
    longitude: mainQuadLng,
    startTimeIso: "2026-08-21T14:00:00Z",
    endTimeIso: "2026-08-21T17:00:00Z",
  };

  it("calculates accurate Haversine distance in meters", () => {
    // Same coordinate -> 0 meters
    const sameDist = calculateHaversineDistanceMeters(
      mainQuadLat,
      mainQuadLng,
      mainQuadLat,
      mainQuadLng,
    );
    expect(sameDist).toBe(0);

    // Slight shift (~20m)
    const shiftDist = calculateHaversineDistanceMeters(mainQuadLat, mainQuadLng, 37.775, -122.4195);
    expect(shiftDist).toBeGreaterThan(0);
    expect(shiftDist).toBeLessThan(50);
  });

  it("detects time window overlap including +/- 2 hour buffer", () => {
    // Direct overlap
    expect(
      isTimeWindowOverlapping(
        "2026-08-21T14:00:00Z",
        "2026-08-21T17:00:00Z",
        "2026-08-21T15:00:00Z",
        "2026-08-21T18:00:00Z",
      ),
    ).toBe(true);

    // Non-overlapping (10 hours apart)
    expect(
      isTimeWindowOverlapping(
        "2026-08-21T08:00:00Z",
        "2026-08-21T10:00:00Z",
        "2026-08-21T20:00:00Z",
        "2026-08-21T22:00:00Z",
      ),
    ).toBe(false);
  });

  it("triggers collision warning when proposed event is <50m and overlapping in time", () => {
    const proposed: ProposedEventVenue = {
      latitude: mainQuadLat,
      longitude: mainQuadLng,
      startTimeIso: "2026-08-21T15:00:00Z",
      endTimeIso: "2026-08-21T18:00:00Z",
    };

    const warning = detectVenueCollision(proposed, [existingEvent]);

    expect(warning.hasConflict).toBe(true);
    expect(warning.conflictingClubName).toBe("Arts Club");
    expect(warning.warningMessage).toContain("The Arts Club is hosting an event");
    expect(warning.warningMessage).toContain("Please coordinate with them or change your venue.");
  });
});
