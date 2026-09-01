import { describe, it, expect } from "vitest";
import {
  formatSecondsToTimestamp,
  aggregateEmotionBatch,
  computeEmotionTimelineSummary,
  ClientEmotionReading,
  AggregatedEmotionSnapshot,
} from "./biometricEmotionTracking";

describe("Implement Automated Event Feedback Biometric Emotion Tracking Suite (#4817)", () => {
  it("formats seconds into MM:SS video timeline timestamps", () => {
    expect(formatSecondsToTimestamp(862)).toBe("14:22"); // 14 mins, 22 secs
    expect(formatSecondsToTimestamp(1680)).toBe("28:00"); // 28 mins, 0 secs
    expect(formatSecondsToTimestamp(0)).toBe("00:00");
  });

  it("aggregates privacy-preserving client emotion readings and determines dominant emotion", () => {
    const readings: ClientEmotionReading[] = [
      { joy: 85, surprise: 10, boredom: 12 },
      { joy: 90, surprise: 20, boredom: 8 },
      { joy: 80, surprise: 15, boredom: 10 },
    ];

    const aggregated = aggregateEmotionBatch("evt_keynote_ai", 862, readings);

    expect(aggregated.sampleSize).toBe(3);
    expect(aggregated.avgJoy).toBe(85.0);
    expect(aggregated.avgBoredom).toBe(10.0);
    expect(aggregated.avgSurprise).toBe(15.0);
    expect(aggregated.dominantEmotion).toBe("joy");
  });

  it("computes peak joy and boredom timestamps with accurate organizer summary", () => {
    const snapshots: AggregatedEmotionSnapshot[] = [
      {
        eventId: "evt_keynote_ai",
        timestampOffsetSeconds: 300, // 05:00
        sampleSize: 20,
        avgJoy: 40.0,
        avgSurprise: 10.0,
        avgBoredom: 30.0,
        dominantEmotion: "joy",
      },
      {
        eventId: "evt_keynote_ai",
        timestampOffsetSeconds: 862, // 14:22 -> Peak Joy
        sampleSize: 20,
        avgJoy: 95.0,
        avgSurprise: 20.0,
        avgBoredom: 5.0,
        dominantEmotion: "joy",
      },
      {
        eventId: "evt_keynote_ai",
        timestampOffsetSeconds: 1680, // 28:00 -> Peak Boredom
        sampleSize: 20,
        avgJoy: 10.0,
        avgSurprise: 5.0,
        avgBoredom: 88.0,
        dominantEmotion: "boredom",
      },
    ];

    const summary = computeEmotionTimelineSummary(snapshots);

    expect(summary.peakJoyTimestamp).toBe("14:22");
    expect(summary.peakBoredomTimestamp).toBe("28:00");
    expect(summary.executiveSummary).toBe(
      "Audience Joy peaked at 14:22. Audience Boredom peaked at 28:00.",
    );
  });
});
