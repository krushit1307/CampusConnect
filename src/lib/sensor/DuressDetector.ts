/**
 * DuressDetector — Classifies the current threat level from multiple
 * kinematic signals.
 *
 * Combines:
 *   1. Sudden acceleration spikes (snatch detection)
 *   2. Kinematic-signature mismatch (from the AnomalyDetector)
 *   3. Erratic movement / high jerk variance (struggle detection)
 *   4. Gait-frequency shift (different carrier)
 *
 * The composite score maps to a threat level. Critical triggers an emergency
 * lock on the escrow ledger.
 */

import type { AnomalyResult } from "./AnomalyDetector";
import type { KinematicFeatureVector } from "./SensorCollector";

export type ThreatLevel = "normal" | "elevated" | "critical";

export interface ThreatEvaluation {
  level: ThreatLevel;
  /** 0..100 composite threat score */
  score: number;
  /** Individual signal contributions (for audit/debug) */
  signals: {
    spike: number;
    anomaly: number;
    struggle: number;
    gaitShift: number;
  };
  /** Human-readable reason for the current level */
  reason: string;
}

// Acceleration above this magnitude (m/s²) at a single instant = snatch.
const SNATCH_ACCEL_THRESHOLD = 35; // ~3.5g
// Critical confidence for a kinematic anomaly.
const ANOMALY_CRITICAL_CONFIDENCE = 0.6;
// Jerk above this (m/s³) indicates a struggle.
const STRUGGLE_JERK_THRESHOLD = 40;
// Gait frequency shift fraction required to flag different carrier.
const GAIT_SHIFT_FRACTION = 0.5;

export class DuressDetector {
  private baselineGaitFrequency = 0;

  /**
   * Provide the baseline gait frequency to calibrate gait-shift detection.
   */
  setBaselineGaitFrequency(freq: number): void {
    this.baselineGaitFrequency = freq;
  }

  /**
   * Evaluates the current threat level from a feature vector + anomaly result.
   */
  evaluate(feature: KinematicFeatureVector, anomaly: AnomalyResult): ThreatEvaluation {
    // 1. Snatch spike detection
    let spike = 0;
    if (feature.peakAcceleration > SNATCH_ACCEL_THRESHOLD) {
      // Scale intensity between threshold and ~6g (60 m/s²)
      spike = Math.min(
        100,
        ((feature.peakAcceleration - SNATCH_ACCEL_THRESHOLD) / (60 - SNATCH_ACCEL_THRESHOLD)) * 100,
      );
    }

    // 2. Anomaly mismatch
    let anomalySignal = 0;
    if (anomaly.isAnomaly) {
      anomalySignal = anomaly.confidence * 100;
    }

    // 3. Struggle detection via jerk + angular variance
    let struggle = 0;
    if (feature.jerk > STRUGGLE_JERK_THRESHOLD) {
      struggle = Math.min(100, ((feature.jerk - STRUGGLE_JERK_THRESHOLD) / 80) * 100);
    }
    // Boost struggle if angular variance is high and magnitude variance high
    if (feature.angularVariance > 2000 && feature.magnitudeVariance > 50) {
      struggle = Math.min(100, struggle + 20);
    }

    // 4. Gait shift
    let gaitShift = 0;
    if (this.baselineGaitFrequency > 0) {
      const delta = Math.abs(feature.gaitFrequency - this.baselineGaitFrequency);
      const frac = delta / this.baselineGaitFrequency;
      if (frac > GAIT_SHIFT_FRACTION) {
        gaitShift = Math.min(100, (frac / 2) * 100);
      }
    }

    const signals = { spike, anomaly: anomalySignal, struggle, gaitShift };

    // Composite scoring — a single strong signal OR multiple moderate signals.
    const composite = 0.45 * spike + 0.35 * anomalySignal + 0.15 * struggle + 0.05 * gaitShift;

    let level: ThreatLevel;
    let reason: string;

    if (spike >= 70) {
      level = "critical";
      reason = "Sudden high acceleration spike detected (possible snatch).";
    } else if (struggle >= 70) {
      level = "critical";
      reason = "Violent, erratic movement detected (possible struggle).";
    } else if (anomalySignal >= ANOMALY_CRITICAL_CONFIDENCE * 100) {
      level = "critical";
      reason = "Kinematic signature no longer matches the authenticated user.";
    } else if (composite >= 45) {
      level = "critical";
      reason = "Multiple elevated signals indicate a struggle or device theft.";
    } else if (composite >= 22 || anomalySignal >= 22) {
      level = "elevated";
      reason = "Slight kinematic variation detected; monitoring closely.";
    } else {
      level = "normal";
      reason = "";
    }

    return { level, score: composite, signals, reason };
  }
}
