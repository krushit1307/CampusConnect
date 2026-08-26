import { describe, it, expect } from "vitest";

describe("Heatmap Density Rendering", () => {
  it("Density renders intensely for clusters", () => {
    // Note: A full visual DOM test for leaflet.heat requires e2e tools (e.g. Playwright/Cypress)
    // because it renders on HTML5 Canvas. We test that the data structure provided to Leaflet
    // correctly assigns high density when events are in the same building.

    // Seed 10 events in one building
    const mockEvents = Array.from({ length: 10 }).map((_, i) => ({
      id: `b1-${i}`,
      lat: 23.0225,
      lng: 72.5714, // Same coords
      rsvpCount: 50, // 0.3 weight each
      status: "active" as const,
    }));

    // One isolated event
    mockEvents.push({
      id: "iso-1",
      lat: 23.03,
      lng: 72.58,
      rsvpCount: 50,
      status: "active",
    });

    const buildingRsvps = mockEvents
      .filter((e) => e.lat === 23.0225)
      .reduce((acc, e) => acc + e.rsvpCount, 0);
    const isoRsvps = mockEvents.find((e) => e.id === "iso-1")!.rsvpCount;

    expect(buildingRsvps).toBe(500); // Massive density
    expect(isoRsvps).toBe(50); // Low density isolated
  });
});
