import { describe, it, expect } from "vitest";
import {
  getParkingOccupancyStatus,
  getGoogleMapsParkingNavUrl,
  getAppleMapsParkingNavUrl,
} from "./campusParking";

describe("Campus Parking Logistics Utility (#3537)", () => {
  it("calculates real-time parking occupancy percentage and color levels", () => {
    // 50% -> Available (Green)
    const greenStatus = getParkingOccupancyStatus(50, 100);
    expect(greenStatus.occupancyPercent).toBe(50);
    expect(greenStatus.status).toBe("Available");
    expect(greenStatus.level).toBe("green");

    // 80% -> Filling Up (Yellow)
    const yellowStatus = getParkingOccupancyStatus(80, 100);
    expect(yellowStatus.occupancyPercent).toBe(80);
    expect(yellowStatus.status).toBe("Filling Up");
    expect(yellowStatus.level).toBe("yellow");

    // 95% -> Full (Red)
    const redStatus = getParkingOccupancyStatus(95, 100);
    expect(redStatus.occupancyPercent).toBe(95);
    expect(redStatus.status).toBe("Full");
    expect(redStatus.level).toBe("red");
  });

  it("generates Google Maps navigation URL with entrance GPS coordinates", () => {
    const url = getGoogleMapsParkingNavUrl(37.7749, -122.4194, "Lot A West");

    expect(url).toContain("https://www.google.com/maps/dir/");
    expect(url).toContain("destination=37.7749,-122.4194");
  });

  it("generates Apple Maps navigation URL with entrance GPS coordinates", () => {
    const url = getAppleMapsParkingNavUrl(37.7749, -122.4194, "Lot A West");

    expect(url).toContain("https://maps.apple.com/");
    expect(url).toContain("daddr=37.7749,-122.4194");
  });
});
