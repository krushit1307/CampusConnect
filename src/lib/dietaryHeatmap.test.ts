import { describe, it, expect } from "vitest";
import {
  aggregateDietaryHeatmap,
  generateDiningLogisticsRecommendation,
  calculateHeatmapIntensity,
  RawRsvpDietaryPoint,
} from "./dietaryHeatmap";

describe("Dynamic Dietary Restriction Heatmap Suite (#3706)", () => {
  const samplePoints: RawRsvpDietaryPoint[] = [
    {
      eventId: "e1",
      venueId: "v_eng_quad",
      venueName: "Engineering Quad",
      latitude: 37.7749,
      longitude: -122.4194,
      userId: "usr_1",
      dietaryRestrictions: ["gluten-free", "vegan"],
      eventStartTimeIso: "2026-08-21T12:00:00Z",
      eventEndTimeIso: "2026-08-21T14:00:00Z",
    },
    {
      eventId: "e1",
      venueId: "v_eng_quad",
      venueName: "Engineering Quad",
      latitude: 37.7749,
      longitude: -122.4194,
      userId: "usr_2",
      dietaryRestrictions: ["gluten-free"],
      eventStartTimeIso: "2026-08-21T12:00:00Z",
      eventEndTimeIso: "2026-08-21T14:00:00Z",
    },
    {
      eventId: "e2",
      venueId: "v_south_hall",
      venueName: "South Hall",
      latitude: 37.77,
      longitude: -122.415,
      userId: "usr_3",
      dietaryRestrictions: ["halal"],
      eventStartTimeIso: "2026-08-21T12:00:00Z",
      eventEndTimeIso: "2026-08-21T14:00:00Z",
    },
  ];

  it("calculates heatmap intensity weight accurately capped at 1.0", () => {
    expect(calculateHeatmapIntensity(50)).toBe(0.5);
    expect(calculateHeatmapIntensity(150)).toBe(1.0);
    expect(calculateHeatmapIntensity(0)).toBe(0.0);
  });

  it("aggregates student counts by venue and dietary restriction tag", () => {
    const heatmap = aggregateDietaryHeatmap(samplePoints);

    expect(heatmap.length).toBe(3); // (Eng Quad: gluten-free=2, vegan=1) & (South Hall: halal=1)

    const engGlutenFree = heatmap.find(
      (h) => h.venueId === "v_eng_quad" && h.dietaryTag === "gluten-free",
    );
    expect(engGlutenFree?.studentCount).toBe(2);
    expect(engGlutenFree?.intensityWeight).toBe(0.02);
  });

  it("filters heatmap by specific dietary tag and generates food truck routing recommendations", () => {
    const gfOnly = aggregateDietaryHeatmap(samplePoints, "gluten-free");
    expect(gfOnly.length).toBe(1);
    expect(gfOnly[0].venueName).toBe("Engineering Quad");

    const recommendation = generateDiningLogisticsRecommendation(gfOnly);
    expect(recommendation?.recommendedVenueName).toBe("Engineering Quad");
    expect(recommendation?.targetDietaryTag).toBe("gluten-free");
    expect(recommendation?.reason).toContain("2 gluten-free students");
  });
});
