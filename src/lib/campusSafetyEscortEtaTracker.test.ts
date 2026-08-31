import { describe, it, expect } from "vitest";
import {
  calculateEscortEta,
  updateOfficerGpsCoordinates,
  SafetyEscortTrackerState,
} from "./campusSafetyEscortEtaTracker";

describe("Campus Safety Escort ETA Tracker Utility (#4686)", () => {
  const initialState: SafetyEscortTrackerState = {
    requestId: "req-escort-101",
    studentId: "u-student-9901",
    officerName: "Officer Smith",
    officerBadgeNumber: "PD-402",
    studentLocation: { lat: 37.7749, lng: -122.4194 },
    officerLocation: { lat: 37.7800, lng: -122.4150 },
    etaMinutes: 3,
    distanceMiles: 0.4,
    status: "en_route",
    lastUpdated: new Date().toISOString(),
  };

  it("calculates accurate distance in miles and ETA in minutes", () => {
    const { distanceMiles, etaMinutes } = calculateEscortEta(
      37.7800,
      -122.4150,
      37.7749,
      -122.4194
    );

    expect(distanceMiles).toBeGreaterThan(0);
    expect(etaMinutes).toBeGreaterThan(0);
  });

  it("updates officer GPS coordinates and recalculates ETA", () => {
    const updated = updateOfficerGpsCoordinates(initialState, 37.7760, -122.4180);

    expect(updated.officerLocation.lat).toBe(37.7760);
    expect(updated.officerLocation.lng).toBe(-122.4180);
    expect(updated.status).toBe("en_route");
  });

  it("transitions status to ARRIVED when officer reaches student location", () => {
    const arrivedState = updateOfficerGpsCoordinates(
      initialState,
      37.7749,
      -122.4194
    );

    expect(arrivedState.distanceMiles).toBeLessThanOrEqual(0.02);
    expect(arrivedState.status).toBe("arrived");
  });
});
