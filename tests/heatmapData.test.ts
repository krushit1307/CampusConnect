import { describe, it, expect } from "vitest";
import { buildHeatmapDataset } from "../src/utils/heatmap";
import { ActiveEventMapData } from "../src/types/heatmap";

describe("buildHeatmapDataset", () => {
  it("correctly maps ActiveEventMapData to leaflet.heat format", () => {
    const mockEvents: ActiveEventMapData[] = [
      { id: "1", lat: 10, lng: 20, rsvpCount: 50, status: "active" },
      { id: "2", lat: 30, lng: 40, rsvpCount: 500, status: "active" },
    ];

    const result = buildHeatmapDataset(mockEvents);

    expect(result.length).toBe(2);
    expect(result[0]).toEqual([10, 20, 0.3]); // 50 RSVPs = 0.3 weight
    expect(result[1]).toEqual([30, 40, 1.0]); // 500 RSVPs = 1.0 weight
  });

  it("handles empty arrays", () => {
    expect(buildHeatmapDataset([])).toEqual([]);
  });
});
