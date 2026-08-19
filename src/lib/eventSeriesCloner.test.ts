import { describe, it, expect } from "vitest";
import {
  calculateTimeDeltaMs,
  shiftTimestamp,
  generateShiftedSeriesPreview,
  SeriesEventTemplate,
} from "./eventSeriesCloner";

describe("Event Series Clone & Shift Utility (#3538)", () => {
  const fallWeeklySeries: SeriesEventTemplate[] = [
    {
      id: "evt-1",
      series_id: "fall-series-2025",
      title: "Fall Workshop #1: Intro to Web3",
      event_date: "2025-09-01T18:00:00.000Z",
    },
    {
      id: "evt-2",
      series_id: "fall-series-2025",
      title: "Fall Workshop #2: Smart Contracts",
      event_date: "2025-09-08T18:00:00.000Z", // 7 days later
    },
    {
      id: "evt-3",
      series_id: "fall-series-2025",
      title: "Fall Workshop #3: Frontend DApps",
      event_date: "2025-09-15T18:00:00.000Z", // 7 days later
    },
  ];

  it("calculates time delta in milliseconds accurately", () => {
    // Sept 1, 2025 to Jan 15, 2026
    const deltaMs = calculateTimeDeltaMs("2025-09-01T18:00:00.000Z", "2026-01-15T18:00:00.000Z");
    const days = deltaMs / (1000 * 60 * 60 * 24);

    expect(days).toBe(136); // 136 days shift
  });

  it("shifts timestamp while preserving exact relative time", () => {
    const orig = "2025-09-01T18:00:00.000Z";
    const deltaMs = 7 * 24 * 60 * 60 * 1000; // 7 days in ms
    const shifted = shiftTimestamp(orig, deltaMs);

    expect(shifted).toBe("2025-09-08T18:00:00.000Z");
  });

  it("generates preview of shifted series preserving weekly 7-day relative spacing", () => {
    const previews = generateShiftedSeriesPreview(fallWeeklySeries, "2026-01-15T18:00:00.000Z");

    expect(previews).toHaveLength(3);
    expect(previews[0].title).toBe("Fall Workshop #1: Intro to Web3");
    expect(previews[0].shiftedDate).toBe("2026-01-15T18:00:00.000Z");
    expect(previews[0].status).toBe("draft");

    // Second event should be exactly 7 days after the first shifted event
    expect(previews[1].shiftedDate).toBe("2026-01-22T18:00:00.000Z");
    expect(previews[1].intervalDaysFromPrevious).toBe(7);

    // Third event should also be 7 days after the second shifted event
    expect(previews[2].shiftedDate).toBe("2026-01-29T18:00:00.000Z");
    expect(previews[2].intervalDaysFromPrevious).toBe(7);
  });
});
