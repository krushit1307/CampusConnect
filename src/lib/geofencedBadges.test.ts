import { describe, it, expect } from "vitest";

// Mock implementation of checking coordinate within bounding box of a zone
export interface MockZone {
  id: string;
  name: string;
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const MOCK_ZONES: MockZone[] = [
  {
    id: "zone-1",
    name: "North Campus Academic Zone",
    minLat: 10.0,
    maxLat: 10.1,
    minLng: 10.0,
    maxLng: 10.1,
  },
  {
    id: "zone-2",
    name: "South Campus Residential Complex",
    minLat: 20.0,
    maxLat: 20.1,
    minLng: 20.0,
    maxLng: 20.1,
  },
  {
    id: "zone-3",
    name: "East Campus Athletic Fields",
    minLat: 30.0,
    maxLat: 30.1,
    minLng: 30.0,
    maxLng: 30.1,
  },
  {
    id: "zone-4",
    name: "West Campus Innovation Hub",
    minLat: 40.0,
    maxLat: 40.1,
    minLng: 40.0,
    maxLng: 40.1,
  },
  {
    id: "zone-5",
    name: "Central Student Plaza",
    minLat: 50.0,
    maxLat: 50.1,
    minLng: 50.0,
    maxLng: 50.1,
  },
];

export function getZoneForCoordinates(
  lat: number,
  lng: number,
  zones: MockZone[],
): MockZone | null {
  for (const zone of zones) {
    if (lat >= zone.minLat && lat <= zone.maxLat && lng >= zone.minLng && lng <= zone.maxLng) {
      return zone;
    }
  }
  return null;
}

export function evaluateBadgeEligibility(checkins: { zoneId: string; date: Date }[]): string[] {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Filter checkins within monthly period
  const activeCheckins = checkins.filter((c) => c.date >= thirtyDaysAgo);

  // Get distinct zones
  const distinctZones = new Set(activeCheckins.map((c) => c.zoneId));

  const badges = [];
  if (distinctZones.size >= 5) {
    badges.push("Campus Explorer");
  }
  return badges;
}

describe("Geofenced Badge Evaluation", () => {
  it("resolves coordinates to correct campus zone", () => {
    const zone = getZoneForCoordinates(10.05, 10.05, MOCK_ZONES);
    expect(zone).not.toBeNull();
    expect(zone?.id).toBe("zone-1");
    expect(zone?.name).toBe("North Campus Academic Zone");
  });

  it("returns null if coordinates are outside any defined zone", () => {
    const zone = getZoneForCoordinates(15.0, 15.0, MOCK_ZONES);
    expect(zone).toBeNull();
  });

  it("does not award Campus Explorer badge if user has visited fewer than 5 distinct zones", () => {
    const checkins = [
      { zoneId: "zone-1", date: new Date() },
      { zoneId: "zone-2", date: new Date() },
      { zoneId: "zone-3", date: new Date() },
      { zoneId: "zone-4", date: new Date() },
      { zoneId: "zone-1", date: new Date() }, // Duplicate zone-1
    ];
    const badges = evaluateBadgeEligibility(checkins);
    expect(badges).not.toContain("Campus Explorer");
  });

  it("awards Campus Explorer badge when user visits exactly 5 distinct zones in the monthly period", () => {
    const checkins = [
      { zoneId: "zone-1", date: new Date() },
      { zoneId: "zone-2", date: new Date() },
      { zoneId: "zone-3", date: new Date() },
      { zoneId: "zone-4", date: new Date() },
      { zoneId: "zone-5", date: new Date() },
    ];
    const badges = evaluateBadgeEligibility(checkins);
    expect(badges).toContain("Campus Explorer");
  });

  it("ignores check-ins older than 30 days during evaluation", () => {
    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

    const checkins = [
      { zoneId: "zone-1", date: fortyDaysAgo }, // Expired
      { zoneId: "zone-2", date: new Date() },
      { zoneId: "zone-3", date: new Date() },
      { zoneId: "zone-4", date: new Date() },
      { zoneId: "zone-5", date: new Date() },
    ];
    const badges = evaluateBadgeEligibility(checkins);
    expect(badges).not.toContain("Campus Explorer");
  });
});
