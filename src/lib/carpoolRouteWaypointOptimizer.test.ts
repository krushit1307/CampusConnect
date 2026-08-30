import { describe, it, expect } from "vitest";
import {
  optimizeCarpoolPickupOrder,
  generateGoogleMapsNavigationUrl,
  processCarpoolRouteOptimization,
  CarpoolWaypoint,
  CarpoolRouteOptimizationRequest,
} from "./carpoolRouteWaypointOptimizer";

describe("Dynamic Carpool Route Waypoint Optimizer Utility (#4678)", () => {
  const sampleWaypoints: CarpoolWaypoint[] = [
    { riderId: "r1", riderName: "Alice Vance", pickupLocation: "North Dorms", lat: 37.7749, lng: -122.4194 },
    { riderId: "r2", riderName: "Bob Chen", pickupLocation: "South Quad", lat: 37.7833, lng: -122.4167 },
    { riderId: "r3", riderName: "Elena Rostova", riderName: "Elena Rostova", pickupLocation: "West Village", lat: 37.7690, lng: -122.4480 },
    { riderId: "r4", riderName: "David Miller", pickupLocation: "East Towers", lat: 37.7710, lng: -122.4050 },
  ];

  const sampleRequest: CarpoolRouteOptimizationRequest = {
    carpoolId: "carpool-9901",
    driverId: "u-driver-1",
    venueName: "Regional Hackathon Arena",
    venueLat: 37.7900,
    venueLng: -122.4000,
    waypoints: sampleWaypoints,
  };

  it("optimizes pickup waypoint sequence solving Traveling Salesperson Problem", () => {
    const sorted = optimizeCarpoolPickupOrder(sampleWaypoints, 37.7900, -122.4000);
    expect(sorted).toHaveLength(4);
    expect(sorted[0].riderId).toBe("r1");
  });

  it("generates Google Maps Directions API deep link URL with optimize:true", () => {
    const url = generateGoogleMapsNavigationUrl(sampleWaypoints, 37.7900, -122.4000);
    expect(url).toContain("https://www.google.com/maps/dir/?api=1");
    expect(url).toContain("waypoints=optimize:true");
  });

  it("processes carpool route optimization and computes distance & time savings", () => {
    const result = processCarpoolRouteOptimization(sampleRequest);

    expect(result.originalDistanceMiles).toBe(18.5);
    expect(result.optimizedDistanceMiles).toBe(10.1);
    expect(result.timeSavedMinutes).toBe(25);
    expect(result.googleMapsDirectionsUrl).toBeDefined();
    expect(result.optimizedWaypoints).toHaveLength(4);
  });
});
