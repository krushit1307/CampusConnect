import { describe, expect, it } from "vitest";
import { KinematicProfiler } from "./KinematicProfiler";
import type { KinematicFeatureVector } from "./SensorCollector";

function feature(v: Partial<KinematicFeatureVector> = {}): KinematicFeatureVector {
  return {
    accelerationMagnitude: 9.8,
    jerk: 5,
    magnitudeVariance: 5,
    holdPitch: 0,
    holdRoll: 0,
    angularVelocity: 10,
    angularVariance: 50,
    gaitFrequency: 1.2,
    gravityTilt: 90,
    peakAcceleration: 12,
    sampleCount: 125,
    ...v,
  };
}

describe("KinematicProfiler baseline computation", () => {
  it("computes an anomaly threshold above 0", () => {
    // Instantiate with a placeholder collector (unused for pure baseline calc).
    const profiler = new KinematicProfiler({} as never);
    const baseline = profiler.computeBaseline([
      feature({ accelerationMagnitude: 9.8 }),
      feature({ accelerationMagnitude: 9.5 }),
      feature({ accelerationMagnitude: 10.1 }),
    ]);
    expect(baseline.anomalyThreshold).toBeGreaterThan(0);
    expect(baseline.calibrationSamples).toBe(3);
  });

  it("computes means and non-zero std devs", () => {
    const profiler = new KinematicProfiler({} as never);
    const baseline = profiler.computeBaseline([
      feature({ accelerationMagnitude: 9.8, jerk: 2 }),
      feature({ accelerationMagnitude: 9.8, jerk: 3 }),
      feature({ accelerationMagnitude: 9.8, jerk: 7 }),
    ]);
    expect(baseline.meanAccelerationMagnitude).toBeCloseTo(9.8, 1);
    expect(baseline.stdJerk).toBeGreaterThan(0);
  });

  it("throws on an empty feature set", () => {
    const profiler = new KinematicProfiler({} as never);
    expect(() => profiler.computeBaseline([])).toThrow();
  });
});
