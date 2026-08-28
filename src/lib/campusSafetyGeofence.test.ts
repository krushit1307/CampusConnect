import { describe, expect, it } from "vitest";

import {
  GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS,
  getGeofenceAlertMessage,
  getGeofenceWindowRemainingMs,
  haversineDistanceMeters,
  isOutsideGeofence,
} from "./campusSafetyGeofence";

describe("campus safety geofence helpers", () => {
  it("calculates a short known distance without storing or requiring raw location state", () => {
    const distance = haversineDistanceMeters(
      { latitude: 40.7128, longitude: -74.006 },
      { latitude: 40.7128, longitude: -74.005 },
    );

    expect(distance).toBeGreaterThan(80);
    expect(distance).toBeLessThan(90);
  });

  it("treats the radius boundary as safe and only breaches beyond it", () => {
    expect(isOutsideGeofence(500, 500)).toBe(false);
    expect(isOutsideGeofence(500.1, 500)).toBe(true);
    expect(isOutsideGeofence(Number.NaN, 500)).toBe(false);
  });

  it("counts down the full three-minute acknowledgement window", () => {
    const breachedAt = 1_000_000;
    expect(getGeofenceWindowRemainingMs(breachedAt, breachedAt)).toBe(
      GEOFENCE_ACKNOWLEDGEMENT_WINDOW_MS,
    );
    expect(getGeofenceWindowRemainingMs(breachedAt, breachedAt + 180_000)).toBe(0);
    expect(getGeofenceAlertMessage()).toBe("You are leaving the event area. Are you okay?");
    expect(getGeofenceAlertMessage("Alice")).toContain("Alice");
  });
});
