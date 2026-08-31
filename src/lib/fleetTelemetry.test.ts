import { describe, it, expect } from "vitest";
import {
  processShuttleTelemetryBlip,
  aggregateFleetTelemetryDashboard,
  RawShuttleTelemetry,
} from "./fleetTelemetry";

describe("Develop Dynamic Hardware Resource Fleet Telemetry Dashboard Suite (#4777)", () => {
  const normalShuttle: RawShuttleTelemetry = {
    shuttleCode: "SHUTTLE_01",
    batteryPercent: 85.5,
    currentSpeedMph: 15.2,
    occupancyCount: 4,
    maxCapacity: 12,
    coordinates: { lat: 40.7128, lng: -74.006 },
  };

  const lowBatteryShuttle: RawShuttleTelemetry = {
    shuttleCode: "SHUTTLE_07",
    batteryPercent: 8.4, // < 10%
    currentSpeedMph: 8.0,
    occupancyCount: 1,
    maxCapacity: 12,
    coordinates: { lat: 40.715, lng: -74.002 },
  };

  it("renders green Leaflet blip for shuttles with healthy battery levels", () => {
    const blip = processShuttleTelemetryBlip(normalShuttle);

    expect(blip.markerColor).toBe("green");
    expect(blip.isLowBattery).toBe(false);
    expect(blip.dispatchCommand).toBeNull();
    expect(blip.occupancyRatio).toBe("4/12");
    expect(blip.coordinates).toEqual([40.7128, -74.006]);
  });

  it("turns blip RED and automatically issues ROUTE_TO_CHARGING_DEPOT dispatch when battery < 10%", () => {
    const blip = processShuttleTelemetryBlip(lowBatteryShuttle);

    expect(blip.markerColor).toBe("red");
    expect(blip.isLowBattery).toBe(true);
    expect(blip.dispatchCommand).toBe("ROUTE_TO_CHARGING_DEPOT");
    expect(blip.popupHtml).toContain("DISPATCH: ROUTE_TO_CHARGING_DEPOT");
  });

  it("aggregates fleet telemetry statistics for Leaflet dashboard rendering", () => {
    const fleet = aggregateFleetTelemetryDashboard([normalShuttle, lowBatteryShuttle]);

    expect(fleet.totalActiveFleet).toBe(2);
    expect(fleet.chargingRequiredCount).toBe(1);
    expect(fleet.blips.length).toBe(2);
  });
});
