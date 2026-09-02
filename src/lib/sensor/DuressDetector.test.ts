import { describe, expect, it } from "vitest";
import { DuressDetector } from "./DuressDetector";
import type { KinematicFeatureVector } from "./SensorCollector";
import type { AnomalyResult } from "./AnomalyDetector";

function normalFeature(overrides: Partial<KinematicFeatureVector> = {}): KinematicFeatureVector {
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
    ...overrides,
  };
}

function normalAnomaly(overrides: Partial<AnomalyResult> = {}): AnomalyResult {
  return {
    isAnomaly: false,
    confidence: 0.1,
    reconstructionError: 0.8,
    normalizedScore: 0.5,
    ...overrides,
  };
}

describe("DuressDetector", () => {
  it("returns normal for baseline motion", () => {
    const detector = new DuressDetector();
    detector.setBaselineGaitFrequency(1.2);
    const result = detector.evaluate(normalFeature(), normalAnomaly());
    expect(result.level).toBe("normal");
    expect(result.score).toBeLessThan(25);
  });

  it("detects a critical snatch from a high acceleration spike", () => {
    const detector = new DuressDetector();
    detector.setBaselineGaitFrequency(1.2);
    const result = detector.evaluate(normalFeature({ peakAcceleration: 55 }), normalAnomaly());
    expect(result.level).toBe("critical");
    expect(result.signals.spike).toBeGreaterThan(0);
  });

  it("detects a critical anomaly from kinematic signature mismatch", () => {
    const detector = new DuressDetector();
    detector.setBaselineGaitFrequency(1.2);
    const result = detector.evaluate(
      normalFeature(),
      normalAnomaly({ isAnomaly: true, confidence: 0.9, normalizedScore: 2.5 }),
    );
    expect(result.level).toBe("critical");
    expect(result.reason).toContain("Kinematic signature");
  });

  it("detects an elevated threat from moderate signals", () => {
    const detector = new DuressDetector();
    detector.setBaselineGaitFrequency(1.2);
    // Mild anomaly mismatch (confidence 0.3) + gait shift → elevated, not critical.
    const result = detector.evaluate(
      normalFeature({ gaitFrequency: 0.4, jerk: 30 }),
      normalAnomaly({ isAnomaly: true, confidence: 0.3, normalizedScore: 1.4 }),
    );
    expect(result.level).toBe("elevated");
  });

  it("detects a struggle from high jerk and angular variance", () => {
    const detector = new DuressDetector();
    detector.setBaselineGaitFrequency(1.2);
    const result = detector.evaluate(
      normalFeature({
        jerk: 100,
        peakAcceleration: 30,
        angularVariance: 3000,
        magnitudeVariance: 80,
      }),
      normalAnomaly(),
    );
    expect(result.level).toBe("critical");
    expect(result.signals.struggle).toBeGreaterThan(0);
  });

  it("flags a gait shift when the frequency differs significantly", () => {
    const detector = new DuressDetector();
    detector.setBaselineGaitFrequency(1.2);
    const result = detector.evaluate(normalFeature({ gaitFrequency: 0.3 }), normalAnomaly());
    expect(result.signals.gaitShift).toBeGreaterThan(0);
  });
});
