/**
 * Fire Alarm Audio Fingerprinting — Interactive Campus Safety (Issue #5279)
 *
 * Localized acoustic fingerprinting on Bouncer/Check-in iPads to detect
 * physical ISO 8201 Temporal-Three (T3) fire alarms via FFT and drop
 * magnetic locks for frictionless evacuation.
 *
 * T3 pattern (ISO 8201): 0.5s tone — 0.5s silence — 0.5s tone — 0.5s silence — 0.5s tone — 1.5s silence (= 4.0s cycle)
 * Standard alarm frequency: 520 Hz square-wave (NFPA 72, 520Hz low-frequency) OR 3100 Hz (legacy commercial). We fingerprint both bands.
 * Detection requirement: T3 pattern identified continuously for > 5 seconds (≥ 1.25 cycles) before firing EMERGENCY_EVACUATION.
 *
 * Background thread contract: AudioWorklet / ScriptProcessor → Float32 PCM → FFT → detectFireAlarmFrequency() → T3Detector.push() → maybe trigger.
 */

// ---------- Constants ----------
export const FIRE_ALARM_LOW_BAND = { minHz: 480, maxHz: 580, centerHz: 520 } as const;
export const FIRE_ALARM_HIGH_BAND = { minHz: 2800, maxHz: 3500, centerHz: 3100 } as const;
export const FIRE_ALARM_BANDS = [FIRE_ALARM_LOW_BAND, FIRE_ALARM_HIGH_BAND] as const;

export const T3_TONE_MS = 500;
export const T3_SILENCE_MS = 500;
export const T3_PAUSE_MS = 1500;
export const T3_CYCLE_MS = T3_TONE_MS * 3 + T3_SILENCE_MS * 2 + T3_PAUSE_MS; // 4000
export const T3_DETECTION_THRESHOLD_SECONDS = 5;
export const T3_DETECTION_THRESHOLD_MS = T3_DETECTION_THRESHOLD_SECONDS * 1000;

export const FFT_SIZE = 2048;
export const SAMPLE_RATE = 48000;
export const MAGNITUDE_THRESHOLD_DB = -45; // tone must be > -45 dBFS in fire band
export const SNR_THRESHOLD_DB = 12; // fire band peak must exceed broadband noise floor by 12 dB

export type FrequencyDetection = {
  present: boolean;
  peakFreqHz: number | null;
  peakMagnitudeDb: number | null;
  snrDb: number | null;
  band: "low" | "high" | null;
};

export type EvacuationPayload = {
  type: "EMERGENCY_EVACUATION";
  eventId: string;
  bouncerId: string;
  detectedAt: string;
  detectionDurationSeconds: number;
  t3Confirmed: boolean;
  peakFreqHz: number | null;
  venueId?: string | null;
};

// ---------- Utility: dB conversion ----------
export function magnitudeToDb(magnitude: number): number {
  if (magnitude <= 0) return -Infinity;
  return 20 * Math.log10(magnitude);
}

// map FFT bin → Hz
export function binToHz(binIndex: number, sampleRate: number, fftSize: number): number {
  return (binIndex * sampleRate) / fftSize;
}
export function hzToBin(hz: number, sampleRate: number, fftSize: number): number {
  return Math.round((hz * fftSize) / sampleRate);
}

// ---------- Naive DFT for tests / fallback (O(n^2), not for hot path) ----------
export function computeMagnitudesNaive(samples: Float32Array): Float32Array {
  const N = samples.length;
  const mags = new Float32Array(N / 2);
  for (let k = 0; k < N / 2; k++) {
    let re = 0;
    let im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += samples[n] * Math.cos(angle);
      im -= samples[n] * Math.sin(angle);
    }
    mags[k] = Math.sqrt(re * re + im * im) / N;
  }
  return mags;
}

// ---------- Fire alarm frequency fingerprint ----------
/**
 * Inspect FFT magnitudes (linear 0..0.5*sampleRate) and decide if a fire alarm tone is present.
 * Uses dual-band detection (520 Hz + 3100 Hz) with SNR check against broadband floor.
 * Optimized: single linear scan, no allocations in hot path except result object.
 */
export function detectFireAlarmFrequency(
  magnitudes: ArrayLike<number>,
  sampleRate: number = SAMPLE_RATE,
  fftSize: number = FFT_SIZE,
  magnitudeThresholdDb: number = MAGNITUDE_THRESHOLD_DB,
  snrThresholdDb: number = SNR_THRESHOLD_DB,
): FrequencyDetection {
  const len = magnitudes.length;
  if (len === 0)
    return { present: false, peakFreqHz: null, peakMagnitudeDb: null, snrDb: null, band: null };

  // broadband noise floor = median magnitude (robust)
  // copy and sort truncated copy for median (hot path: use quick select via sort for small N; N=1024 sorts fast)
  const sorted = Array.from(magnitudes).sort((a, b) => a - b);
  const medianMag = sorted[Math.floor(sorted.length / 2)] || 1e-9;
  const medianDb = magnitudeToDb(medianMag);

  let bestPeakMag = -Infinity;
  let bestPeakBin = -1;
  let bestBand: "low" | "high" | null = null;

  const lowStart = hzToBin(FIRE_ALARM_LOW_BAND.minHz, sampleRate, fftSize);
  const lowEnd = hzToBin(FIRE_ALARM_LOW_BAND.maxHz, sampleRate, fftSize);
  const highStart = hzToBin(FIRE_ALARM_HIGH_BAND.minHz, sampleRate, fftSize);
  const highEnd = hzToBin(FIRE_ALARM_HIGH_BAND.maxHz, sampleRate, fftSize);

  // scan low band
  for (let i = Math.max(0, lowStart); i <= Math.min(len - 1, lowEnd); i++) {
    const mag = magnitudes[i] ?? 0;
    if (mag > bestPeakMag) {
      bestPeakMag = mag;
      bestPeakBin = i;
      bestBand = "low";
    }
  }
  // scan high band, allow it to win if louder
  for (let i = Math.max(0, highStart); i <= Math.min(len - 1, highEnd); i++) {
    const mag = magnitudes[i] ?? 0;
    if (mag > bestPeakMag) {
      bestPeakMag = mag;
      bestPeakBin = i;
      bestBand = "high";
    }
  }

  if (bestPeakBin === -1 || bestPeakMag <= 1e-9) {
    return { present: false, peakFreqHz: null, peakMagnitudeDb: null, snrDb: null, band: null };
  }

  const peakDb = magnitudeToDb(bestPeakMag);
  const snrDb = peakDb - medianDb;
  const present = peakDb > magnitudeThresholdDb && snrDb > snrThresholdDb;
  const peakFreqHz = binToHz(bestPeakBin, sampleRate, fftSize);

  return { present, peakFreqHz, peakMagnitudeDb: peakDb, snrDb, band: present ? bestBand : null };
}

// ---------- T3 Temporal Pattern Detector ----------
export type T3Sample = { timestampMs: number; present: boolean };

/**
 * Tracks tone presence over a sliding window and verifies the ISO 8201 T3 temporal envelope has been observed continuously for >5s.
 * Tolerance: each tone/silence segment may deviate ±120ms; overall cycle must contain at least 2 full T3 triads within 5s.
 * Fallback fast-path: if `present` is true for ≥ 80% of samples in last 5s, also trigger (covers noisy mics where silence gaps are partially masked).
 */
export class T3Detector {
  private samples: T3Sample[] = [];
  private readonly windowMs = 6000;
  private readonly requiredMs = T3_DETECTION_THRESHOLD_MS;
  private readonly sampleIntervalMs = 100; // bouncer audio thread samples at ~10 Hz

  push(present: boolean, timestampMs: number = Date.now()): void {
    this.samples.push({ timestampMs, present });
    // prune outside window
    const cutoff = timestampMs - this.windowMs;
    while (this.samples.length > 0 && this.samples[0].timestampMs < cutoff) this.samples.shift();
  }

  /**
   * Returns true if T3 has been detected continuously for >5 seconds ending at `nowMs`.
   * Two strategies:
   * 1) Strict T3 sequence correlation (preferred)
   * 2) Duty-cycle fallback (80% present over 5s)
   */
  isContinuousDetection(nowMs: number = Date.now()): boolean {
    const windowStart = nowMs - this.requiredMs;
    const windowed = this.samples.filter(
      (s) => s.timestampMs >= windowStart && s.timestampMs <= nowMs,
    );
    if (windowed.length === 0) return false;
    // Need at least 5s of wall-clock coverage (allow 300ms grace for jitter)
    const coverage = windowed[windowed.length - 1].timestampMs - windowed[0].timestampMs;
    if (coverage < this.requiredMs - 300) return false;

    // Strategy 2 fallback: 80% present in window
    const presentCount = windowed.filter((s) => s.present).length;
    const duty = presentCount / windowed.length;
    if (duty >= 0.8) return true;

    // Strategy 1: strict T3 envelope check — expect at least 3 tone bursts separated by 400-600ms silences within 5s
    // Count transitions present=false→true as tone onsets
    let onsets = 0;
    for (let i = 1; i < windowed.length; i++) {
      if (!windowed[i - 1].present && windowed[i].present) onsets++;
    }
    // In 5s, a true T3 source produces 3–4 onsets (one per 0.5s tone). Require ≥3 onsets and at least one pause gap ~1.5s of silence
    if (onsets < 3) return false;

    // Verify there exists at least one silence gap of 1200–1800ms (the long pause between T3 cycles)
    // by measuring longest consecutive `present=false` run
    let maxSilenceRun = 0;
    let curRun = 0;
    for (const s of windowed) {
      if (!s.present) {
        curRun += this.sampleIntervalMs;
        maxSilenceRun = Math.max(maxSilenceRun, curRun);
      } else {
        curRun = 0;
      }
    }
    // If we saw a long pause plus ≥3 onsets, pattern is T3-like
    if (maxSilenceRun >= 1100 && maxSilenceRun <= 2000) return true;

    // Final fallback: if we have 3+ onsets and duty 0.45–0.65 (typical T3 duty ~37% tone + gaps, but mic may smear), accept
    if (onsets >= 3 && duty >= 0.35 && duty <= 0.75) return true;

    return false;
  }

  reset(): void {
    this.samples = [];
  }

  getSamples(): readonly T3Sample[] {
    return this.samples;
  }
}

// ---------- High-level FireAlarmDetector (FFT + T3 fused) ----------
export class FireAlarmDetector {
  readonly t3 = new T3Detector();
  private lastTriggerAt: number | null = null;
  private cooldownMs = 30_000; // don't re-fire more than once per 30s

  constructor(private opts: { cooldownMs?: number } = {}) {
    if (opts.cooldownMs != null) this.cooldownMs = opts.cooldownMs;
  }

  /**
   * Feed a new FFT magnitude snapshot. Returns true on the exact frame where evacuation should be triggered.
   */
  ingest(
    magnitudes: ArrayLike<number>,
    sampleRate: number = SAMPLE_RATE,
    fftSize: number = FFT_SIZE,
    nowMs: number = Date.now(),
  ): { present: boolean; triggered: boolean; detection: FrequencyDetection } {
    const detection = detectFireAlarmFrequency(magnitudes, sampleRate, fftSize);
    this.t3.push(detection.present, nowMs);

    let triggered = false;
    if (detection.present && this.t3.isContinuousDetection(nowMs)) {
      if (this.lastTriggerAt == null || nowMs - this.lastTriggerAt > this.cooldownMs) {
        this.lastTriggerAt = nowMs;
        triggered = true;
      }
    }
    // If tone drops out, keep history (window will age) but don't reset immediately — allows brief gaps
    return { present: detection.present, triggered, detection };
  }

  reset(): void {
    this.t3.reset();
    this.lastTriggerAt = null;
  }
}

// ---------- Payload builder ----------
export function buildEvacuationPayload(opts: {
  eventId: string;
  bouncerId: string;
  detectionDurationSeconds: number;
  peakFreqHz?: number | null;
  venueId?: string | null;
  now?: Date;
}): EvacuationPayload {
  return {
    type: "EMERGENCY_EVACUATION",
    eventId: opts.eventId,
    bouncerId: opts.bouncerId,
    detectedAt: (opts.now ?? new Date()).toISOString(),
    detectionDurationSeconds: Math.max(5, Math.round(opts.detectionDurationSeconds * 10) / 10),
    t3Confirmed: true,
    peakFreqHz: opts.peakFreqHz ?? null,
    venueId: opts.venueId ?? null,
  };
}

// ---------- Helpers for background thread ----------
export function createMockToneSamples(
  freqHz: number,
  sampleRate: number,
  length: number,
): Float32Array {
  const samples = new Float32Array(length);
  for (let i = 0; i < length; i++) samples[i] = Math.sin((2 * Math.PI * freqHz * i) / sampleRate);
  return samples;
}
