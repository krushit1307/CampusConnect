/**
 * SensorCollector — Real-time spatial & kinematic telemetry capture.
 *
 * Streams accelerometer, gyroscope (rotation rate) and orientation data from
 * the Web DeviceMotion/DeviceOrientation APIs into a circular buffer, then
 * derives kinematic features (magnitude, jerk, hold angle, gait frequency)
 * for the continuous-authentication anomaly detector.
 *
 * Notes:
 *  - Requires HTTPS (or localhost). On iOS 13+, the user is prompted once via
 *    `DeviceMotionEvent.requestPermission()`.
 *  - The magnetometer has no public web API, so we use accelerometer +
 *    rotation-rate + device orientation as our kinematic signals.
 */

export interface MotionReading {
  /** Monotonic timestamp in ms */
  timestamp: number;
  /** Linear acceleration (gravity removed) x/y/z in m/s^2 */
  x: number;
  y: number;
  z: number;
  /** Rotation rate around x/y/z (deg/s) */
  rx: number;
  ry: number;
  rz: number;
  /** Gravity vector components (m/s^2) */
  gx: number;
  gy: number;
  gz: number;
  /** Orientation alpha/beta/gamma (deg) */
  alpha: number;
  beta: number;
  gamma: number;
}

export interface KinematicFeatureVector {
  /** Magnitude of linear acceleration (m/s^2) */
  accelerationMagnitude: number;
  /** First derivative of acceleration magnitude | jerk */
  jerk: number;
  /** Variance of accelerometer magnitude over the window */
  magnitudeVariance: number;
  /** Device hold angle (pitch in degrees, derived from beta) */
  holdPitch: number;
  /** Device hold angle (roll in degrees, derived from gamma) */
  holdRoll: number;
  /** Angular velocity magnitude (deg/s) */
  angularVelocity: number;
  /** Variance of angular velocity over the window */
  angularVariance: number;
  /** Estimated step/gait frequency (Hz) from zero-crossings */
  gaitFrequency: number;
  /** Gravity tilt angle (deg) */
  gravityTilt: number;
  /** Peak acceleration magnitude (m/s^2) — spikes indicate snatch */
  peakAcceleration: number;
  /** Number of samples in this window */
  sampleCount: number;
}

export type SensorAvailability =
  { type: "available" } | { type: "unavailable"; reason: string } | { type: "permission_denied" };

const DEFAULT_WINDOW_MS = 2500;
const DEFAULT_SAMPLE_HZ = 50;

declare global {
  interface Window {
    // iOS 13+ requires explicit request for device motion permission
    DeviceMotionEvent?: {
      requestPermission?: () => Promise<"granted" | "denied" | "unsupported">;
    };
    DeviceOrientationEvent?: {
      requestPermission?: () => Promise<"granted" | "denied" | "unsupported">;
    };
  }
}

export class SensorCollector {
  private buffer: MotionReading[] = [];
  private bufferSize: number;
  private isStarted = false;
  private listenersAdded = false;
  private motionHandler: ((event: DeviceMotionEvent) => void) | null = null;
  private orientationHandler: ((event: DeviceOrientationEvent) => void) | null = null;

  /** Most recent orientation angles in degrees */
  private latestOrientation: { alpha: number; beta: number; gamma: number } = {
    alpha: 0,
    beta: 0,
    gamma: 0,
  };

  /** Most recent linear acceleration in m/s^2 */
  private latestAccel: { x: number; y: number; z: number } = { x: 0, y: 0, z: 0 };

  /** Most recent rotation rate in deg/s */
  private latestRotation: { rx: number; ry: number; rz: number } = {
    rx: 0,
    ry: 0,
    rz: 0,
  };

  /** Most recent gravity vector */
  private latestGravity: { gx: number; gy: number; gz: number } = {
    gx: 0,
    gy: 0,
    gz: 0,
  };

  private lastTimestamp = 0;
  private listeners: Array<() => void> = [];

  constructor(opts?: { windowMs?: number; sampleHz?: number }) {
    const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
    const sampleHz = opts?.sampleHz ?? DEFAULT_SAMPLE_HZ;
    this.bufferSize = Math.ceil((windowMs / 1000) * sampleHz);
  }

  /**
   * Checks whether the device motion/orientation APIs are available and
   * whether permission has (or can) be granted.
   */
  static async checkAvailability(): Promise<SensorAvailability> {
    if (typeof window === "undefined") {
      return { type: "unavailable", reason: "SSR / no window" };
    }

    const hasMotion =
      "DeviceMotionEvent" in window && typeof window.DeviceMotionEvent !== "undefined";
    if (!hasMotion) {
      return { type: "unavailable", reason: "DeviceMotionEvent not supported" };
    }

    // iOS 13+: request permission explicitly
    const dm = window.DeviceMotionEvent as unknown as
      { requestPermission?: () => Promise<"granted" | "denied"> } | undefined;

    if (dm && typeof dm.requestPermission === "function") {
      try {
        const result = await dm.requestPermission();
        if (result === "denied") {
          return { type: "permission_denied" };
        }
      } catch {
        return { type: "permission_denied" };
      }
    }

    return { type: "available" };
  }

  /**
   * Registers raw sensor handlers. Does not start the inference loop.
   */
  async start(): Promise<SensorAvailability> {
    const availability = await SensorCollector.checkAvailability();
    if (availability.type !== "available") {
      return availability;
    }

    if (this.isStarted || this.listenersAdded) {
      return { type: "available" };
    }

    this.motionHandler = (event: DeviceMotionEvent) => {
      this.handleMotionEvent(event);
    };

    this.orientationHandler = (event: DeviceOrientationEvent) => {
      this.handleOrientationEvent(event);
    };

    window.addEventListener("devicemotion", this.motionHandler, { passive: true });
    window.addEventListener("deviceorientation", this.orientationHandler, {
      passive: true,
    });

    this.listenersAdded = true;
    this.isStarted = true;

    return { type: "available" };
  }

  /** Whether sensors are actively streaming. */
  isActive(): boolean {
    return this.isStarted;
  }

  /** True if at least some motion samples have been collected. */
  hasData(): boolean {
    return this.buffer.length > 0;
  }

  /**
   * Stops streaming and cleans up listeners.
   */
  stop(): void {
    if (!this.listenersAdded) {
      return;
    }

    if (this.motionHandler) {
      window.removeEventListener("devicemotion", this.motionHandler);
      this.motionHandler = null;
    }

    if (this.orientationHandler) {
      window.removeEventListener("deviceorientation", this.orientationHandler);
      this.orientationHandler = null;
    }

    this.listenersAdded = false;
    this.isStarted = false;
    this.buffer = [];

    // Notify any subscribers
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
    this.listeners = [];
  }

  /**
   * Register a callback invoked when new motion data arrives.
   * Returns an unsubscribe function.
   */
  onDataReceived(cb: () => void): () => void {
    this.listeners.push(cb);
    return () => {
      this.listeners = this.listeners.filter((f) => f !== cb);
    };
  }

  /**
   * Computes the kinematic feature vector from the current buffer window.
   */
  getFeatureVector(): KinematicFeatureVector {
    if (this.buffer.length === 0) {
      return this.emptyFeatureVector();
    }

    const magnitudes: number[] = [];
    const angularVelocities: number[] = [];
    let peakAcceleration = 0;
    let zeroCrossings = 0;
    let prevMag = 0;

    // We subtract gravity by using the latest gravity vector if available.
    const gravity = this.latestGravity;
    const gravMag = Math.sqrt(gravity.gx ** 2 + gravity.gy ** 2 + gravity.gz ** 2) || 9.81;

    for (let i = 0; i < this.buffer.length; i++) {
      const m = this.buffer[i];

      // Remove gravity by vector subtraction (approximate)
      const ax = m.x - (gravity.gx / gravMag) * 9.81;
      const ay = m.y - (gravity.gy / gravMag) * 9.81;
      const az = m.z - (gravity.gz / gravMag) * 9.81;

      const mag = Math.sqrt(ax * ax + ay * ay + az * az);
      magnitudes.push(mag);

      if (mag > peakAcceleration) {
        peakAcceleration = mag;
      }

      // Zero-crossing detection for gait estimation
      if (i > 0) {
        const prev = prevMag - 9.81; // baseline gravity offset
        const curr = mag - 9.81;
        if ((prev < 0 && curr >= 0) || (prev >= 0 && curr < 0)) {
          zeroCrossings++;
        }
      }
      prevMag = mag;

      const angVel = Math.sqrt(m.rx ** 2 + m.ry ** 2 + m.rz ** 2);
      angularVelocities.push(angVel);
    }

    const meanMag = magnitudes.reduce((a, b) => a + b, 0) / magnitudes.length;
    const magnitudeVariance =
      magnitudes.reduce((a, b) => a + (b - meanMag) ** 2, 0) / magnitudes.length;

    const meanAng = angularVelocities.reduce((a, b) => a + b, 0) / angularVelocities.length;
    const angularVariance =
      angularVelocities.reduce((a, b) => a + (b - meanAng) ** 2, 0) / angularVelocities.length;

    // Time span in seconds
    const durationSec = this.buffer.length / DEFAULT_SAMPLE_HZ;
    const gaitFrequency = durationSec > 0 ? zeroCrossings / 2 / durationSec : 0;

    return {
      accelerationMagnitude: meanMag,
      jerk: this.computeJerk(magnitudes),
      magnitudeVariance,
      holdPitch: this.latestOrientation.beta,
      holdRoll: this.latestOrientation.gamma,
      angularVelocity: meanAng,
      angularVariance,
      gaitFrequency,
      gravityTilt:
        Math.atan2(Math.sqrt(gravity.gx ** 2 + gravity.gy ** 2), Math.abs(gravity.gz) || 1) *
        (180 / Math.PI),
      peakAcceleration,
      sampleCount: this.buffer.length,
    };
  }

  /**
   * Serializes the raw sensor readings into an array (for snapshotting).
   */
  getRawSnapshot(): MotionReading[] {
    return this.buffer.map((m) => ({ ...m }));
  }

  private emptyFeatureVector(): KinematicFeatureVector {
    return {
      accelerationMagnitude: 0,
      jerk: 0,
      magnitudeVariance: 0,
      holdPitch: this.latestOrientation.beta,
      holdRoll: this.latestOrientation.gamma,
      angularVelocity: 0,
      angularVariance: 0,
      gaitFrequency: 0,
      gravityTilt: 0,
      peakAcceleration: 0,
      sampleCount: 0,
    };
  }

  private computeJerk(magnitudes: number[]): number {
    if (magnitudes.length < 2) return 0;
    let total = 0;
    for (let i = 1; i < magnitudes.length; i++) {
      total += Math.abs(magnitudes[i] - magnitudes[i - 1]);
    }
    // dt = 1 / sampleHz
    return (total / (magnitudes.length - 1)) * DEFAULT_SAMPLE_HZ;
  }

  private handleMotionEvent(event: DeviceMotionEvent): void {
    if (!event.accelerationIncludingGravity || !event.rotationRate) {
      return;
    }

    const a = event.accelerationIncludingGravity;
    const rot = event.rotationRate;

    const motionX = a.x ?? 0;
    const motionY = a.y ?? 0;
    const motionZ = a.z ?? 0;

    const rotX = rot.alpha ?? 0;
    const rotY = rot.beta ?? 0;
    const rotZ = rot.gamma ?? 0;

    this.latestAccel = { x: motionX, y: motionY, z: motionZ };
    this.latestRotation = { rx: rotX, ry: rotY, rz: rotZ };

    // Gravity = accelerationIncludingGravity at rest; use event.acceleration
    // if available to derive gravity.
    if (event.acceleration) {
      // acceleration excludes gravity => gravity = including - acceleration
      const gx = motionX - (event.acceleration.x ?? 0);
      const gy = motionY - (event.acceleration.y ?? 0);
      const gz = motionZ - (event.acceleration.z ?? 0);
      this.latestGravity = { gx, gy, gz };
    }

    const now = performance.now();

    const reading: MotionReading = {
      timestamp: now,
      x: motionX,
      y: motionY,
      z: motionZ,
      rx: rotX,
      ry: rotY,
      rz: rotZ,
      gx: this.latestGravity.gx,
      gy: this.latestGravity.gy,
      gz: this.latestGravity.gz,
      alpha: this.latestOrientation.alpha,
      beta: this.latestOrientation.beta,
      gamma: this.latestOrientation.gamma,
    };

    this.buffer.push(reading);
    if (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }

    this.lastTimestamp = now;

    // Notify subscribers
    for (const fn of this.listeners) {
      try {
        fn();
      } catch {
        /* ignore */
      }
    }
  }

  private handleOrientationEvent(event: DeviceOrientationEvent): void {
    if (event.alpha != null && event.beta != null && event.gamma != null) {
      this.latestOrientation = {
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      };
    }
  }
}

/** Convenience singleton accessor. */
let sharedCollector: SensorCollector | null = null;
export function getSharedSensorCollector(): SensorCollector {
  if (!sharedCollector) {
    sharedCollector = new SensorCollector();
  }
  return sharedCollector;
}
