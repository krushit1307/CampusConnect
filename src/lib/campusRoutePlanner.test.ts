import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  calculateCampusRoute,
  GeoCoordinates,
} from "./campusRoutePlanner";

describe("Campus Map Route Planner Suite (#2675)", () => {
  const studentCenter: GeoCoordinates = { latitude: 42.3592, longitude: -71.0932 };
  const engineeringBuilding: GeoCoordinates = { latitude: 42.3601, longitude: -71.0915 };

  it("calculates accurate Haversine geodesic distance in meters", () => {
    const distance = calculateHaversineDistance(studentCenter, engineeringBuilding);
    expect(distance).toBeGreaterThan(100);
    expect(distance).toBeLessThan(300);
  });

  it("generates walking route with ETA and waypoints tuple array for map rendering", () => {
    const route = calculateCampusRoute({
      origin: studentCenter,
      destination: engineeringBuilding,
    });
    expect(route.distanceMeters).toBeGreaterThan(0);
    expect(route.estimatedWalkingMinutes).toBeGreaterThanOrEqual(1);
    expect(route.waypoints.length).toBe(3);
    expect(route.formattedDistance).toMatch(/m|km/);
  });
});
