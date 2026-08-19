import { describe, expect, it } from "vitest";
import {
  formatWifiSpeed,
  getVenueWifiWarning,
  isTechHeavyEvent,
  sortVenuesForEvent,
  type VenueWifiMetrics,
} from "./venueWifi";

const venue = (overrides: Partial<VenueWifiMetrics> = {}): VenueWifiMetrics => ({
  id: "science-basement",
  name: "Science Basement",
  building: "Science",
  capacity: 500,
  avg_wifi_speed_mbps: 42,
  max_device_capacity: 100,
  wifi_report_count: 4,
  ...overrides,
});

describe("venue Wi-Fi helpers", () => {
  it("identifies tech-heavy tags and descriptions", () => {
    expect(isTechHeavyEvent(["Hackathon"])).toBe(true);
    expect(isTechHeavyEvent(["Career"])).toBe(false);
    expect(isTechHeavyEvent([], "General", "Robotics club meetup")).toBe(true);
  });

  it("warns when a tech-heavy event exceeds the historical device capacity", () => {
    expect(getVenueWifiWarning(venue(), true, 500)).toBe(
      "This venue historically drops connections with > 100 people. Consider booking the Library instead.",
    );
  });

  it("does not warn for non-tech events or suitable attendance", () => {
    expect(getVenueWifiWarning(venue(), false, 500)).toBeNull();
    expect(getVenueWifiWarning(venue({ avg_wifi_speed_mbps: 75 }), true, 80)).toBeNull();
    expect(
      getVenueWifiWarning(venue({ max_device_capacity: null, avg_wifi_speed_mbps: 75 }), true, 500),
    ).toBeNull();
  });

  it("warns when measured speed is below the tech-event threshold", () => {
    expect(getVenueWifiWarning(venue({ max_device_capacity: 600 }), true, 80)).toContain(
      "average Wi-Fi speed",
    );
  });

  it("formats missing and measured speeds consistently", () => {
    expect(formatWifiSpeed(null)).toBe("No recent test");
    expect(formatWifiSpeed(100)).toBe("100 Mbps avg.");
    expect(formatWifiSpeed(42.5)).toBe("42.5 Mbps avg.");
  });

  it("puts suitable high-capacity venues first for tech-heavy events", () => {
    const venues = [venue(), venue({ id: "library", name: "Library", max_device_capacity: 600 })];
    expect(sortVenuesForEvent(venues, true, 500).map((candidate) => candidate.id)).toEqual([
      "library",
      "science-basement",
    ]);
    expect(sortVenuesForEvent(venues, false, 500).map((candidate) => candidate.id)).toEqual([
      "science-basement",
      "library",
    ]);
  });
});
