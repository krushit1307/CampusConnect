import { describe, it, expect } from "vitest";
import {
  calculatePitchRetentionCurve,
  formatRetentionTimestamp,
  PitchTelemetryPing,
} from "./clubPitchAnalytics";

describe("Club Pitch Audio Retention Analytics Utility (#4271)", () => {
  it("formats seconds into MM:SS timestamp strings correctly", () => {
    expect(formatRetentionTimestamp(0)).toBe("0:00");
    expect(formatRetentionTimestamp(15)).toBe("0:15");
    expect(formatRetentionTimestamp(65)).toBe("1:05");
  });

  it("aggregates 5-second interval retention percentages and completion rates", () => {
    const rawPings: PitchTelemetryPing[] = [
      // Session 1: Listened full 60s
      { clubId: "c1", pitchId: "p1", sessionId: "s1", maxTimeListenedSec: 60, totalDurationSec: 60, swipedAway: false },
      // Session 2: Listened full 60s
      { clubId: "c1", pitchId: "p1", sessionId: "s2", maxTimeListenedSec: 60, totalDurationSec: 60, swipedAway: false },
      // Session 3: Swiped away at 15s
      { clubId: "c1", pitchId: "p1", sessionId: "s3", maxTimeListenedSec: 15, totalDurationSec: 60, swipedAway: true },
      // Session 4: Swiped away at 15s
      { clubId: "c1", pitchId: "p1", sessionId: "s4", maxTimeListenedSec: 15, totalDurationSec: 60, swipedAway: true },
    ];

    const analytics = calculatePitchRetentionCurve(rawPings, 60);

    expect(analytics.totalListens).toBe(4);
    expect(analytics.completionCount).toBe(2);
    expect(analytics.completionRate).toBe(50); // 2 / 4 = 50%
    expect(analytics.avgTimeListenedSec).toBe(37.5); // (60+60+15+15)/4

    // 0s bucket -> 100% retention
    expect(analytics.retentionCurve[0].retentionPercentage).toBe(100);

    // 15s bucket -> 100% (s3 & s4 dropped off AT 15s, so they reached 15s)
    // 20s bucket -> 50% retention (only s1 & s2)
    const bucket20s = analytics.retentionCurve.find((b) => b.second === 20);
    expect(bucket20s?.retentionPercentage).toBe(50);
  });

  it("pinpoints exact highest drop-off second", () => {
    const rawPings: PitchTelemetryPing[] = [
      { clubId: "c1", pitchId: "p1", sessionId: "s1", maxTimeListenedSec: 60, totalDurationSec: 60, swipedAway: false },
      { clubId: "c1", pitchId: "p1", sessionId: "s2", maxTimeListenedSec: 15, totalDurationSec: 60, swipedAway: true },
      { clubId: "c1", pitchId: "p1", sessionId: "s3", maxTimeListenedSec: 15, totalDurationSec: 60, swipedAway: true },
      { clubId: "c1", pitchId: "p1", sessionId: "s4", maxTimeListenedSec: 15, totalDurationSec: 60, swipedAway: true },
    ];

    const analytics = calculatePitchRetentionCurve(rawPings, 60);

    expect(analytics.highestDropOffSecond).toBe(20);
    expect(analytics.highestDropOffFormatted).toBe("0:20");
    expect(analytics.dropOffInsight).toContain("Biggest audience drop-off occurs at 0:20");
  });

  it("handles empty telemetry data gracefully", () => {
    const analytics = calculatePitchRetentionCurve([], 60);

    expect(analytics.totalListens).toBe(0);
    expect(analytics.completionRate).toBe(0);
    expect(analytics.retentionCurve).toHaveLength(0);
  });
});
