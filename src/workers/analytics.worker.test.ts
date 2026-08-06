import { describe, it, expect } from "vitest";
import { processAnalyticsData, RawEventData } from "./analytics.worker";

describe("Analytics Web Worker Logic", () => {
  it("correctly aggregates empty arrays", () => {
    const result = processAnalyticsData([]);
    expect(result.totalEvents).toBe(0);
    expect(result.totalRevenue).toBe(0);
    expect(result.averageAttendees).toBe(0);
    expect(result.maxDuration).toBe(0);
    expect(result.categoryBreakdown).toEqual({});
  });

  it("correctly calculates stats for a sample dataset", () => {
    const mockData: RawEventData[] = [
      {
        id: "1",
        category: "Tech",
        revenue: 1000,
        attendees: 50,
        durationMinutes: 120,
        date: "2026-01-01",
      },
      {
        id: "2",
        category: "Tech",
        revenue: 2000,
        attendees: 100,
        durationMinutes: 180,
        date: "2026-01-02",
      },
      {
        id: "3",
        category: "Arts",
        revenue: 500,
        attendees: 30,
        durationMinutes: 60,
        date: "2026-01-03",
      },
    ];

    const result = processAnalyticsData(mockData);

    expect(result.totalEvents).toBe(3);
    expect(result.totalRevenue).toBe(3500);
    expect(result.averageAttendees).toBe(60); // (50 + 100 + 30) / 3
    expect(result.maxDuration).toBe(180);

    expect(result.categoryBreakdown["Tech"]).toEqual({ count: 2, revenue: 3000 });
    expect(result.categoryBreakdown["Arts"]).toEqual({ count: 1, revenue: 500 });
  });

  it("handles massive datasets without throwing (simulated 5MB load)", () => {
    // Generate 50,000 records to simulate heavy load
    const massiveData: RawEventData[] = Array.from({ length: 50000 }, (_, i) => ({
      id: `evt-${i}`,
      category: "StressTest",
      revenue: 100,
      attendees: 10,
      durationMinutes: 30,
      date: "2026-01-01",
    }));

    // This should complete in milliseconds in the worker, vs blocking main thread
    const result = processAnalyticsData(massiveData);

    expect(result.totalEvents).toBe(50000);
    expect(result.totalRevenue).toBe(5000000);
    expect(result.categoryBreakdown["StressTest"].count).toBe(50000);
  });
});
