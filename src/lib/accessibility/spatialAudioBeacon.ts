/**
 * Spatial audio beacon (Issue #5458).
 *
 * Renders a continuous, subtle auditory beacon using the Web Audio API
 * (`PannerNode` with HRTF spatialization). The source position is set in
 * head-relative Cartesian space so the chime appears to emanate from the target's
 * direction: 0° straight ahead, positive = right, negative = left.
 *
 * This is web-browser spatial audio only. It does NOT claim Apple's native
 * dynamic head tracking or U1/UWB access; the platform-independent calculations
 * (see spatialWayfindingCalculations.ts) compute the head-relative bearing that
 * drives this node, and a future native module can reuse the same values.
 *
 * Browser constraints handled here:
 *  - AudioContext must be created/resumed from a user gesture (autoplay policy),
 *  - unsupported browsers (no AudioContext) degrade gracefully,
 *  - at most one AudioContext is kept alive at a time and it is closed on stop().
 */

export interface SpatialAudioBeaconConfig {
  chimeFrequencyHz: number;
  chimeVolume: number;
  lpfCutoffHz: number;
  refDistance: number;
  maxDistance: number;
  rolloffFactor: number;
  pulseRateHz: number;
  pulseDepth: number;
}

export const DEFAULT_SPATIAL_BEACON_CONFIG: SpatialAudioBeaconConfig = {
  chimeFrequencyHz: 880,
  chimeVolume: 0.12,
  lpfCutoffHz: 2400,
  refDistance: 1,
  maxDistance: 30,
  rolloffFactor: 1,
  pulseRateHz: 0.5,
  pulseDepth: 0.12,
};

const DEG_TO_RAD = Math.PI / 180;

export class SpatialAudioBeacon {
  private config: SpatialAudioBeaconConfig;
  private ctx: AudioContext | null = null;
  private oscillator: OscillatorNode | null = null;
  private pulseOscillator: OscillatorNode | null = null;
  private panner: PannerNode | null = null;
  private masterGain: GainNode | null = null;

  constructor(config: Partial<SpatialAudioBeaconConfig> = {}) {
    this.config = { ...DEFAULT_SPATIAL_BEACON_CONFIG, ...config };
  }

  public get isRunning(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  public static isSupported(): boolean {
    if (typeof window === "undefined") return false;
    return "AudioContext" in window || "webkitAudioContext" in window;
  }

  private getContextCtor(): typeof AudioContext | null {
    if (typeof window === "undefined") return null;
    return (
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ??
      null
    );
  }

  /**
   * Create (or resume) the audio graph. MUST be called from a user gesture to
   * work around browser autoplay restrictions. Returns false when unsupported.
   */
  public async start(): Promise<boolean> {
    const Ctor = this.getContextCtor();
    if (Ctor === null) return false;

    if (this.ctx !== null) {
      if (this.ctx.state !== "running") {
        try {
          await this.ctx.resume();
        } catch {
          return false;
        }
      }
      return this.ctx.state === "running";
    }

    try {
      return this.createGraph(new Ctor());
    } catch {
      this.stop();
      return false;
    }
  }

  private createGraph(ctx: AudioContext): boolean {
    const masterGain = ctx.createGain();
    masterGain.gain.value = this.config.chimeVolume;

    const lpf = ctx.createBiquadFilter();
    lpf.type = "lowpass";
    lpf.frequency.value = this.config.lpfCutoffHz;

    const panner = ctx.createPanner();
    panner.panningModel = "HRTF";
    panner.distanceModel = "inverse";
    panner.refDistance = this.config.refDistance;
    panner.maxDistance = this.config.maxDistance;
    panner.rolloffFactor = this.config.rolloffFactor;
    panner.positionX.value = 0;
    panner.positionY.value = 0;
    panner.positionZ.value = -4;

    const oscillator = ctx.createOscillator();
    oscillator.type = "sine";
    oscillator.frequency.value = this.config.chimeFrequencyHz;

    const oscGain = ctx.createGain();
    oscGain.gain.value = 0.85;

    // Slow tremolo so the beacon is perceptible without being loud.
    const pulseOscillator = ctx.createOscillator();
    pulseOscillator.type = "sine";
    pulseOscillator.frequency.value = this.config.pulseRateHz;

    const pulseGain = ctx.createGain();
    pulseGain.gain.value = this.config.pulseDepth;

    pulseOscillator.connect(pulseGain);
    pulseGain.connect(oscGain.gain);
    oscillator.connect(oscGain);
    oscGain.connect(panner);
    panner.connect(lpf);
    lpf.connect(masterGain);
    masterGain.connect(ctx.destination);

    oscillator.start();
    pulseOscillator.start();

    this.ctx = ctx;
    this.oscillator = oscillator;
    this.pulseOscillator = pulseOscillator;
    this.panner = panner;
    this.masterGain = masterGain;

    return ctx.state === "running";
  }

  /**
   * Update the beacon source position in head-relative space.
   * `relativeAzimuthDeg`: 0 ahead, + right, - left. `elevationM`: meters above ear.
   * Values are derived by the caller from user/target positions and head yaw.
   */
  public setPosition(relativeAzimuthDeg: number, distanceM: number, elevationM = 0): void {
    const ctx = this.ctx;
    const panner = this.panner;
    if (!ctx || !panner) return;

    const azimuthRad = relativeAzimuthDeg * DEG_TO_RAD;
    const x = distanceM * Math.sin(azimuthRad);
    const y = elevationM;
    const z = -distanceM * Math.cos(azimuthRad);

    const t = ctx.currentTime;
    if ("positionX" in panner) {
      panner.positionX.setTargetAtTime(x, t, 0.05);
      panner.positionY.setTargetAtTime(y, t, 0.05);
      panner.positionZ.setTargetAtTime(z, t, 0.05);
    } else {
      // Legacy implementations expose a positional `setPosition` method.
      (panner as unknown as { setPosition: (x: number, y: number, z: number) => void }).setPosition(
        x,
        y,
        z,
      );
    }
  }

  public setVolume(volume: number): void {
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(volume, this.ctx.currentTime, 0.05);
    }
  }

  /**
   * Stop the beacon and release all audio resources. Safe to call repeatedly.
   */
  public stop(): void {
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      this.oscillator?.stop();
    } catch {
      // Already stopped.
    }
    try {
      this.pulseOscillator?.stop();
    } catch {
      // Already stopped.
    }

    this.oscillator = null;
    this.pulseOscillator = null;
    this.panner = null;
    this.masterGain = null;

    // Close the context to release hardware. Fire-and-forget; a closed context
    // simply yields `false` on the next start(), which then creates a fresh one.
    void ctx.close().catch(() => undefined);
    this.ctx = null;
  }
}

export const spatialAudioBeacon = new SpatialAudioBeacon();
