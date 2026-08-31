// src/lib/keystrokeDynamics.test.ts
// Issue: #5008 - Automated "Event Feedback" Linguistic Sentiment Drift
// Tests for keystroke dynamics tracking and coercion detection

import { describe, it, expect, beforeEach } from "vitest";
import { KeystrokeTracker, analyzeSentiment } from "./keystrokeDynamics";

describe("KeystrokeTracker", () => {
  let tracker: KeystrokeTracker;

  beforeEach(() => {
    tracker = new KeystrokeTracker();
  });

  describe("handleKeyDown", () => {
    it("should record keydown timestamp", () => {
      const event = new KeyboardEvent("keydown", { key: "a" });
      tracker.handleKeyDown(event);

      const data = tracker.getKeystrokeData();
      expect(data.length).toBe(0); // No complete event yet (needs keyup)
    });

    it("should set start time on first keystroke", () => {
      const event = new KeyboardEvent("keydown", { key: "a" });
      tracker.handleKeyDown(event);

      const metrics = tracker.getMetrics();
      expect(metrics.typingDuration).toBeGreaterThan(0);
    });
  });

  describe("handleKeyUp", () => {
    it("should record complete keystroke event with dwell and flight time", () => {
      const downEvent = new KeyboardEvent("keydown", { key: "a" });
      const upEvent = new KeyboardEvent("keyup", { key: "a" });

      tracker.handleKeyDown(downEvent);
      // Simulate some dwell time
      setTimeout(() => {
        tracker.handleKeyUp(upEvent);

        const data = tracker.getKeystrokeData();
        expect(data.length).toBe(1);
        expect(data[0].key).toBe("a");
        expect(data[0].dwellTime).toBeGreaterThan(0);
      }, 50);
    });

    it("should calculate flight time between keystrokes", () => {
      const downA = new KeyboardEvent("keydown", { key: "a" });
      const upA = new KeyboardEvent("keyup", { key: "a" });
      const downB = new KeyboardEvent("keydown", { key: "b" });
      const upB = new KeyboardEvent("keyup", { key: "b" });

      tracker.handleKeyDown(downA);
      setTimeout(() => {
        tracker.handleKeyUp(upA);
        tracker.handleKeyDown(downB);
        setTimeout(() => {
          tracker.handleKeyUp(upB);

          const data = tracker.getKeystrokeData();
          expect(data.length).toBe(2);
          expect(data[1].flightTime).toBeGreaterThan(0);
        }, 50);
      }, 50);
    });
  });

  describe("getMetrics", () => {
    it("should calculate average dwell time", () => {
      const events = [
        { key: "a", timestamp: 100, dwellTime: 100, flightTime: 0 },
        { key: "b", timestamp: 200, dwellTime: 150, flightTime: 50 },
      ];

      // Manually set keystrokes for testing
      (tracker as any).keystrokes = events;

      const metrics = tracker.getMetrics();
      expect(metrics.avgDwellTime).toBe(125);
    });

    it("should calculate average flight time", () => {
      const events = [
        { key: "a", timestamp: 100, dwellTime: 100, flightTime: 0 },
        { key: "b", timestamp: 200, dwellTime: 150, flightTime: 50 },
        { key: "c", timestamp: 300, dwellTime: 120, flightTime: 100 },
      ];

      (tracker as any).keystrokes = events;

      const metrics = tracker.getMetrics();
      expect(metrics.avgFlightTime).toBe(75);
    });

    it("should count backspace events", () => {
      const events = [
        { key: "a", timestamp: 100, dwellTime: 100, flightTime: 0 },
        { key: "Backspace", timestamp: 200, dwellTime: 150, flightTime: 50 },
        { key: "Delete", timestamp: 300, dwellTime: 120, flightTime: 100 },
      ];

      (tracker as any).keystrokes = events;

      const metrics = tracker.getMetrics();
      expect(metrics.backspaceCount).toBe(2);
    });

    it("should calculate correction rate", () => {
      const events = [
        { key: "a", timestamp: 100, dwellTime: 100, flightTime: 0 },
        { key: "b", timestamp: 200, dwellTime: 150, flightTime: 50 },
        { key: "Backspace", timestamp: 300, dwellTime: 120, flightTime: 100 },
      ];

      (tracker as any).keystrokes = events;

      const metrics = tracker.getMetrics();
      expect(metrics.correctionRate).toBeCloseTo(0.333, 2);
    });

    it("should return zero metrics when no keystrokes", () => {
      const metrics = tracker.getMetrics();
      expect(metrics.avgDwellTime).toBe(0);
      expect(metrics.avgFlightTime).toBe(0);
      expect(metrics.backspaceCount).toBe(0);
      expect(metrics.totalKeystrokes).toBe(0);
      expect(metrics.correctionRate).toBe(0);
    });
  });

  describe("reset", () => {
    it("should clear all tracked data", () => {
      const event = new KeyboardEvent("keydown", { key: "a" });
      tracker.handleKeyDown(event);

      tracker.reset();

      const data = tracker.getKeystrokeData();
      expect(data.length).toBe(0);
    });
  });

  describe("getSubmissionData", () => {
    it("should return data formatted for database", () => {
      const events = [{ key: "a", timestamp: 100, dwellTime: 100, flightTime: 0 }];

      (tracker as any).keystrokes = events;
      (tracker as any).startTime = 0;

      const data = tracker.getSubmissionData();
      expect(data).toHaveProperty("keystroke_data");
      expect(data).toHaveProperty("avg_dwell_time_ms");
      expect(data).toHaveProperty("avg_flight_time_ms");
      expect(data).toHaveProperty("backspace_count");
      expect(data).toHaveProperty("correction_rate");
      expect(data).toHaveProperty("typing_duration_ms");
    });
  });
});

describe("analyzeSentiment", () => {
  it("should return positive score for positive text", () => {
    const text = "This was an amazing event! I loved it and had a great time.";
    const score = analyzeSentiment(text);
    expect(score).toBeGreaterThan(0);
  });

  it("should return negative score for negative text", () => {
    const text = "This was terrible and awful. I hated it and it was boring.";
    const score = analyzeSentiment(text);
    expect(score).toBeLessThan(0);
  });

  it("should return neutral score for neutral text", () => {
    const text = "The event was okay. It happened on Tuesday.";
    const score = analyzeSentiment(text);
    expect(score).toBe(0);
  });

  it("should return 0 for empty text", () => {
    const score = analyzeSentiment("");
    expect(score).toBe(0);
  });

  it("should normalize score to -1 to 1 range", () => {
    const veryPositive =
      "amazing awesome excellent great fantastic wonderful good love loved best perfect enjoyed fun brilliant outstanding superb magnificent terrific happy pleased delighted impressed " +
      "amazing awesome excellent great fantastic wonderful good love loved best perfect enjoyed fun brilliant outstanding superb magnificent terrific happy pleased delighted impressed";
    const score = analyzeSentiment(veryPositive);
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(-1);
  });

  it("should handle mixed sentiment", () => {
    const text = "The event was amazing but the food was terrible.";
    const score = analyzeSentiment(text);
    expect(score).toBeGreaterThanOrEqual(-1);
    expect(score).toBeLessThanOrEqual(1);
  });
});
