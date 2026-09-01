/**
 * AnomalyDetector — Real-time kinematic anomaly detection using TensorFlow.js.
 *
 * A lightweight single-hidden-layer autoencoder is trained (on-device) on
 * samples drawn from the user's own kinematic baseline distribution. At
 * inference, each new feature vector is projected encoder → decoder; the
 * reconstruction error (MSE) is compared against the user-specific threshold.
 * A high error means the kinematic signature no longer matches the
 * authenticated user — signalling a potential snatch, struggle, or theft.
 *
 * The model weights are cached in IndexedDB to avoid retraining every session.
 */

import * as tf from "@tensorflow/tfjs";
import type { KinematicBaseline } from "./KinematicProfiler";
import type { KinematicFeatureVector } from "./SensorCollector";

export interface AnomalyResult {
  isAnomaly: boolean;
  /** 0..1 confidence that this is a genuine anomaly */
  confidence: number;
  /** Mean squared reconstruction error */
  reconstructionError: number;
  /** Normalized anomaly score relative to the user threshold */
  normalizedScore: number;
}

const LATENT_DIM = 4;
const HIDDEN_DIM = 12;
const INPUT_DIM = 10;

// Feature order must match KinematicFeatureVector extraction order.
const FEATURE_KEYS: (keyof KinematicFeatureVector)[] = [
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

const MODEL_KEY = "cc_kinematic_anomaly_model";

function featureStats(baseline: KinematicBaseline): Array<{ mean: number; std: number }> {
  return [
    { mean: baseline.meanAccelerationMagnitude, std: baseline.stdAccelerationMagnitude },
    { mean: baseline.meanJerk, std: baseline.stdJerk },
    { mean: baseline.meanMagnitudeVariance, std: baseline.stdMagnitudeVariance },
    { mean: baseline.meanHoldPitch, std: baseline.stdHoldPitch },
    { mean: baseline.meanHoldRoll, std: baseline.stdHoldRoll },
    { mean: baseline.meanAngularVelocity, std: baseline.stdAngularVelocity },
    { mean: baseline.meanAngularVariance, std: baseline.stdAngularVariance },
    { mean: baseline.meanGaitFrequency, std: baseline.stdGaitFrequency },
    { mean: baseline.meanGravityTilt, std: baseline.stdGravityTilt },
    { mean: baseline.meanPeakAcceleration, std: baseline.stdPeakAcceleration },
  ];
}

/** Convert a raw feature vector into Z-scored features (for model input). */
function featuresToStandardized(
  feature: KinematicFeatureVector,
  stats: Array<{ mean: number; std: number }>,
): number[] {
  return FEATURE_KEYS.map((key, i) => {
    const raw = feature[key] as number;
    const { mean, std } = stats[i];
    return (raw - mean) / (std || 1);
  });
}

/** Draw a synthetic "normal" sample from the baseline distribution. */
function sampleNormal(stats: Array<{ mean: number; std: number }>): number[] {
  // Box–Muller transform for standard normal numbers.
  const gaussian = () => {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };

  return stats.map(({ mean, std }) => (mean + gaussian() * std) / (std || 1));
}

export class AnomalyDetector {
  private baseline: KinematicBaseline;
  private stats: Array<{ mean: number; std: number }>;
  private model: tf.Sequential | null = null;
  private readyPromise: Promise<void> | null = null;
  private trained = false;

  constructor(baseline: KinematicBaseline) {
    this.baseline = baseline;
    this.stats = featureStats(baseline);
  }

  /** Ensures the model is loaded (cached) or trained. Safe to call repeatedly. */
  async ready(): Promise<void> {
    if (!this.readyPromise) {
      this.readyPromise = this.initializeModel();
    }
    return this.readyPromise;
  }

  private async initializeModel(): Promise<void> {
    // Try loading a cached, pre-trained model first.
    const cached = await this.loadFromCache();
    if (cached) {
      this.model = cached;
      this.trained = true;
      return;
    }

    this.model = this.buildModel();

    // Train on synthetic samples from the user's baseline distribution.
    await this.trainNow(this.model);
    this.trained = true;

    // Cache the trained weights.
    await this.saveToCache();
  }

  private buildModel(): tf.Sequential {
    const model = tf.sequential();

    model.add(
      tf.layers.dense({
        inputShape: [INPUT_DIM],
        units: HIDDEN_DIM,
        activation: "relu",
        kernelRegularizer: tf.regularizers.l2({ l2: 0.0005 }),
      }),
    );
    model.add(tf.layers.dense({ units: LATENT_DIM, activation: "relu" }));
    model.add(tf.layers.dense({ units: HIDDEN_DIM, activation: "relu" }));
    model.add(tf.layers.dense({ units: INPUT_DIM, activation: "linear" }));

    model.compile({
      optimizer: tf.train.adam(0.005),
      loss: "meanSquaredError",
    });

    return model;
  }

  private async trainNow(model: tf.Sequential): Promise<void> {
    const samples = 800;
    const trainingData: number[][] = [];
    for (let i = 0; i < samples; i++) {
      trainingData.push(sampleNormal(this.stats));
    }

    const X = tf.tensor2d(trainingData);
    await model.fit(X, X, {
      epochs: 80,
      batchSize: 32,
      shuffle: true,
      verbose: 0,
    });
    X.dispose();
  }

  private async loadFromCache(): Promise<tf.Sequential | null> {
    try {
      const model = (await tf.loadLayersModel("indexeddb://" + MODEL_KEY)) as tf.Sequential;
      // Only trust the cache if it has the expected layers.
      if (model.layers.length === 4) {
        return model;
      }
      return null;
    } catch {
      return null;
    }
  }

  private async saveToCache(): Promise<void> {
    if (!this.model) return;
    try {
      await this.model.save("indexeddb://" + MODEL_KEY);
    } catch {
      // Caching is best-effort; ignore failures.
    }
  }

  /**
   * Runs inference on a feature vector, returning an anomaly result.
   * @param feature The kinematic feature vector to evaluate.
   */
  async predict(feature: KinematicFeatureVector): Promise<AnomalyResult> {
    await this.ready();

    if (!this.model) {
      throw new Error("Anomaly detector model not initialized");
    }

    const inputVec = featuresToStandardized(feature, this.stats);
    const input = tf.tensor2d([inputVec]);

    try {
      const output = this.model.predict(input) as tf.Tensor;
      const mse = tf.metrics.meanSquaredError(input, output).dataSync()[0];
      output.dispose();

      // The MSE is on Z-scored features; reconstructing a normal sample
      // yields a small error (~1 or less), while a distant sample (snatch,
      // different carrier) yields a large error.
      const threshold = this.baseline.anomalyThreshold || 1.5;
      // Normalize: scores below/around 1 are "normal".
      const normalized = mse / Math.max(threshold, 0.1);

      const isAnomaly = normalized > 1;
      const confidence = Math.min(1, Math.max(0, (normalized - 1) / 2));

      return {
        isAnomaly,
        confidence,
        reconstructionError: mse,
        normalizedScore: normalized,
      };
    } finally {
      input.dispose();
    }
  }

  /** Clean up resources (model + tensors). */
  dispose(): void {
    if (this.model) {
      this.model.dispose();
      this.model = null;
    }
    this.readyPromise = null;
  }
}
