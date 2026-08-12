import { describe, it, expect } from "vitest";
import { predictEventTurnout, filterOutliers, HistoricalEventData } from "./eventSuccessPredictor";

describe("Event Success Predictor Analytics Engine Suite (#2798)", () => {
  const mockHistory: HistoricalEventData[] = [
    { id: "e1", clubId: "club_acm", category: "Tech", rsvpCount: 100, actualAttendanceCount: 70 },
    { id: "e2", clubId: "club_acm", category: "Tech", rsvpCount: 110, actualAttendanceCount: 75 },
    { id: "e3", clubId: "club_acm", category: "Tech", rsvpCount: 90, actualAttendanceCount: 65 },
    {
      id: "viral_outlier",
      clubId: "club_acm",
      category: "Tech",
      rsvpCount: 1000,
      actualAttendanceCount: 800,
    }, // Outlier
  ];

  it("filters out extreme statistical outliers from history dataset", () => {
    const clean = filterOutliers(mockHistory);

    expect(clean.length).toBe(3);
    expect(clean.find((e) => e.id === "viral_outlier")).toBeUndefined();
  });

  it("predicts attendance using club-specific historical drop-off rate", () => {
    const forecast = predictEventTurnout(
      { clubId: "club_acm", category: "Tech", dayOfWeek: 3, hasCompetingSameDayEvents: false },
      mockHistory,
    );

    expect(forecast.isColdStartFallback).toBe(false);
    expect(forecast.expectedRsvpsRange[0]).toBeGreaterThan(80);
    expect(forecast.expectedRsvpsRange[1]).toBeLessThan(120);
    expect(forecast.confidencePercent).toBeGreaterThanOrEqual(70);
  });

  it("gracefully falls back to campus category averages on cold start (new club)", () => {
    const forecast = predictEventTurnout(
      { clubId: "new_club_99", category: "Social", dayOfWeek: 5, hasCompetingSameDayEvents: false },
      mockHistory, // No history for 'new_club_99'
    );

    expect(forecast.isColdStartFallback).toBe(true);
    expect(forecast.notes).toContain("campus-wide category averages");
    expect(forecast.confidencePercent).toBe(60);
  });
});
