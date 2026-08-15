import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  isWithinRadius,
  HUNT_CHECKIN_RADIUS_METERS,
} from "./scavengerHunt";

describe("Interactive Scavenger Hunt Engine (#3004)", () => {
  // Main Auditorium coordinates: 18.5204, 73.8567
  const targetLat = 18.5204;
  const targetLng = 73.8567;

  it("calculates Haversine distance accurately in meters", () => {
    // 5 meters away
    const closeLat = 18.52044;
    const closeLng = 73.85672;
    const distClose = calculateHaversineDistance(closeLat, closeLng, targetLat, targetLng);

    // 100 meters away
    const farLat = 18.5213;
    const farLng = 73.8567;
    const distFar = calculateHaversineDistance(farLat, farLng, targetLat, targetLng);

    expect(distClose).toBeLessThan(15);
    expect(distFar).toBeGreaterThan(90);
  });

  it("validates 15-meter check-in radius correctly", () => {
    // Exact location -> inside radius
    expect(isWithinRadius(targetLat, targetLng, targetLat, targetLng)).toBe(true);

    // 8 meters away -> inside radius
    const insideLat = 18.52045;
    const insideLng = 73.8567;
    expect(isWithinRadius(insideLat, insideLng, targetLat, targetLng)).toBe(true);

    // 50 meters away -> outside radius
    const outsideLat = 18.5209;
    const outsideLng = 73.8567;
    expect(isWithinRadius(outsideLat, outsideLng, targetLat, targetLng)).toBe(false);
  });

  it("enforces 15-meter radius constant", () => {
    expect(HUNT_CHECKIN_RADIUS_METERS).toBe(15);
  });
});
