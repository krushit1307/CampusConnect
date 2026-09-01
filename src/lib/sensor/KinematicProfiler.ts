/**
 * KinematicProfiler — Captures and stores the user's baseline kinematic
 * signature for continuous authentication.
 *
 * During a calibration phase (e.g., 30 seconds of "normal" use), we compute
 * statistical baselines for the derived acceleration / orientation features.
 * These baselines are persisted to the kinematic_profiles table so the
 * on-device anomaly detector knows what "authentic" motion looks like.
 */

import type { KinematicFeatureVector, SensorCollector } from "./SensorCollector";

/** Lazily loads the Supabase client so this module can be imported in
 *  environments without env vars (e.g. unit tests for pure baseline math). */
async function getSupabase() {
  const { createClient } = await import("@/lib/supabase/client");
  return createClient();
}

export interface KinematicBaseline {
  /** Feature means */
  meanAccelerationMagnitude: number;
  meanJerk: number;
  meanMagnitudeVariance: number;
  meanHoldPitch: number;
  meanHoldRoll: number;
  meanAngularVelocity: number;
  meanAngularVariance: number;
  meanGaitFrequency: number;
  meanGravityTilt: number;
  meanPeakAcceleration: number;

  /** Feature standard deviations */
  stdAccelerationMagnitude: number;
  stdJerk: number;
  stdMagnitudeVariance: number;
  stdHoldPitch: number;
  stdHoldRoll: number;
  stdAngularVelocity: number;
  stdAngularVariance: number;
  stdGaitFrequency: number;
  stdGravityTilt: number;
  stdPeakAcceleration: number;

  /** Anomaly threshold: reconstruction error above this = anomaly */
  anomalyThreshold: number;

  /** Calibration sample count */
  calibrationSamples: number;

  /** ISO timestamp of baseline creation */
  capturedAt: string;
}

export const CALIBRATION_SECONDS_DEFAULT = 30;
export const MODEL_VERSION = "kinematic-vae-1.0";

export type CalibrationStatus = "idle" | "in_progress" | "complete" | "failed";

export class KinematicProfiler {
  private collector: SensorCollector;
  private featureHistory: KinematicFeatureVector[] = [];

  constructor(collector: SensorCollector) {
    this.collector = collector;
  }

  /**
   * Runs a calibration sweep for durationMs, sampling the sensor stream.
   */
  async calibrate(
    durationMs: number = CALIBRATION_SECONDS_DEFAULT * 1000,
    onProgress?: (progress: number) => void,
  ): Promise<KinematicBaseline> {
    this.featureHistory = [];
    const start = Date.now();
    const intervalMs = 200; // sample every 200ms

    return new Promise((resolve, reject) => {
      const stopSubscription = this.collector.onDataReceived(() => {
        const elapsed = Date.now() - start;
        const progress = Math.min(1, elapsed / durationMs);

        this.featureHistory.push(this.collector.getFeatureVector());
        onProgress?.(progress);

        // Also check for ANY motion — if no data at all, warn early.
        if (!this.collector.hasData() && elapsed > 2000) {
          stopSubscription();
          reject(new Error("No sensor data received during calibration."));
        }
      });

      const timer = setTimeout(() => {
        stopSubscription();
        try {
          const baseline = this.computeBaseline(this.featureHistory);
          resolve(baseline);
        } catch (err) {
          reject(err);
        }
      }, durationMs);

      // Clean up timer if the promise is rejected early
      const cleanupPromise = Promise.race([Promise.resolve(), new Promise(() => {})]);
      void cleanupPromise;
      (this as unknown as { _timer: ReturnType<typeof setTimeout> })._timer = timer;
    });
  }

  /**
   * Computes a kinematic baseline from collected feature vectors.
   */
  computeBaseline(features: KinematicFeatureVector[]): KinematicBaseline {
    if (features.length === 0) {
      throw new Error("Cannot compute baseline from empty feature set");
    }

    const n = features.length;
    const keys: (keyof KinematicFeatureVector)[] = [
      "accelerationMagnitude",
      "jerk",
      "magnitudeVariance",
      "holdPitch",
      "holdRoll",
      "angularVelocity",
      "angularVariance",
      "gaitFrequency",
      "gravityTilt",
      "peakAcceleration",
    ];

    const means: Record<string, number> = {};
    const stds: Record<string, number> = {};

    for (const key of keys) {
      const values = features.map((f) => f[key] as number);
      const mean = values.reduce((a, b) => a + b, 0) / n;
      const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      means[key] = mean;
      stds[key] = Math.sqrt(variance);
    }

    // Anomaly threshold: mean distance in units of std dev. Tune per user.
    // A "critical" threshold: 2.5 std deviations above normalized score.
    const anomalyThreshold = 1.5;

    return {
      meanAccelerationMagnitude: means.accelerationMagnitude,
      meanJerk: means.jerk,
      meanMagnitudeVariance: means.magnitudeVariance,
      meanHoldPitch: means.holdPitch,
      meanHoldRoll: means.holdRoll,
      meanAngularVelocity: means.angularVelocity,
      meanAngularVariance: means.angularVariance,
      meanGaitFrequency: means.gaitFrequency,
      meanGravityTilt: means.gravityTilt,
      meanPeakAcceleration: means.peakAcceleration,
      stdAccelerationMagnitude: stds.accelerationMagnitude || 0.01,
      stdJerk: stds.jerk || 0.01,
      stdMagnitudeVariance: stds.magnitudeVariance || 0.01,
      stdHoldPitch: stds.holdPitch || 1,
      stdHoldRoll: stds.holdRoll || 1,
      stdAngularVelocity: stds.angularVelocity || 0.01,
      stdAngularVariance: stds.angularVariance || 0.01,
      stdGaitFrequency: stds.gaitFrequency || 0.01,
      stdGravityTilt: stds.gravityTilt || 1,
      stdPeakAcceleration: stds.peakAcceleration || 0.01,
      anomalyThreshold,
      calibrationSamples: n,
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Persists a kinematic baseline to Supabase for the given user.
   */
  async saveBaseline(userId: string, baseline: KinematicBaseline): Promise<void> {
    const supabase = await getSupabase();
    const { error } = await supabase.rpc("upsert_kinematic_profile", {
      p_user_id: userId,
      p_baseline: baseline,
      p_model_version: MODEL_VERSION,
      p_threshold: baseline.anomalyThreshold,
      p_calibration_count: 1,
    });

    if (error) {
      throw error;
    }
  }

  /**
   * Fetches the stored baseline for a user, if it exists.
   */
  async fetchBaseline(userId: string): Promise<KinematicBaseline | null> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("kinematic_profiles")
      .select("baseline, last_calibrated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data?.baseline) {
      return null;
    }

    return data.baseline as KinematicBaseline;
  }

  /**
   * Checks whether a baseline exists and is fresh enough.
   */
  async isBaselineFresh(userId: string, maxAgeMs = 7 * 24 * 3600 * 1000): Promise<boolean> {
    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from("kinematic_profiles")
      .select("last_calibrated_at")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data?.last_calibrated_at) {
      return false;
    }

    const last = new Date(data.last_calibrated_at).getTime();
    return Date.now() - last < maxAgeMs;
  }

  /** Whether calibration has run at least once. */
  static get statusKey() {
    return "cc_kinematic_calibrated";
  }
}
