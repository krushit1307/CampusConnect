import { describe, it, expect } from "vitest";
import { calculateWaitlistProbability, DISCLAIMER_TEXT } from "./waitlistPredictor";

describe("Waitlist Capacity Predictor (#2980)", () => {
  it("calculates High admission probability when position is within expected dropouts", () => {
    // Position #3 on waitlist for 100 capacity free event (~22 expected dropouts)
    const result = calculateWaitlistProbability({
      position: 3,
      capacity: 100,
      isFree: true,
      pastEventsCount: 5,
      historicalDropoutRate: 0.25,
    });

    expect(result.tier).toBe("High");
    expect(result.probabilityPercentage).toBeGreaterThanOrEqual(70);
    expect(result.estimatedDropouts).toBe(25);
    expect(result.isFallback).toBe(false);
  });

  it("calculates Low/Unlikely admission probability when position is far beyond expected dropouts", () => {
    // Position #45 on waitlist for 100 capacity event (~20 expected dropouts)
    const result = calculateWaitlistProbability({
      position: 45,
      capacity: 100,
      isFree: true,
      pastEventsCount: 5,
      historicalDropoutRate: 0.20,
    });

    expect(["Low", "Unlikely"]).toContain(result.tier);
    expect(result.probabilityPercentage).toBeLessThan(40);
  });

  it("falls back to global campus category averages for new clubs with <2 past events", () => {
    // New club, free event -> 22% fallback
    const freeResult = calculateWaitlistProbability({
      position: 5,
      capacity: 100,
      isFree: true,
      pastEventsCount: 0,
    });

    expect(freeResult.isFallback).toBe(true);
    expect(freeResult.historicalDropoutRate).toBe(22);

    // New club, paid event -> 3% fallback
    const paidResult = calculateWaitlistProbability({
      position: 5,
      capacity: 100,
      isFree: false,
      pastEventsCount: 1,
    });

    expect(paidResult.isFallback).toBe(true);
    expect(paidResult.historicalDropoutRate).toBe(3);
  });

  it("includes legal disclaimer setting expectations without making guarantees", () => {
    const result = calculateWaitlistProbability({
      position: 1,
      capacity: 50,
    });

    expect(result.disclaimer).toBe(DISCLAIMER_TEXT);
    expect(result.disclaimer).toContain("Estimated Probability");
    expect(result.disclaimer).toContain("not guaranteed");
  });
});
