/**
 * Pure audio waveform utilities for the AudioWaveformTrimmer (#2399).
 *
 * These helpers are intentionally side-effect free (no DOM / Web Audio
 * objects) so they are trivially unit-testable and safe to reuse inside a
 * Web Worker.
 */

export interface WaveformResult {
  /** Absolute peak amplitude per bucket, normalized to [0, 1]. */
  peaks: number[];
  /** Total duration of the audio in seconds. */
  duration: number;
  /** Sample rate reported by the decoded audio. */
  sampleRate: number;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Formats seconds as `mm:ss.t` (e.g. `01:32.4`), matching the label style
 * used by media trimmer UIs.
 */
export function formatTime(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const totalTenths = Math.round(safe * 10);
  const minutes = Math.floor(totalTenths / 600);
  const secs = Math.floor((totalTenths % 600) / 10);
  const tenths = totalTenths % 10;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${tenths}`;
}

/** Averages all channels into a single mono Float32Array. */
export function downmixToMono(channels: Float32Array[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  if (channels.length === 1) return channels[0];

  const length = channels[0].length;
  const mono = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    let sum = 0;
    for (let c = 0; c < channels.length; c++) {
      sum += channels[c][i];
    }
    mono[i] = sum / channels.length;
  }
  return mono;
}

/**
 * Downsamples a mono signal into `bucketCount` buckets, returning the
 * absolute peak amplitude of each bucket. This is the core "waveform" data.
 */
export function computePeaks(mono: Float32Array, bucketCount: number): number[] {
  if (bucketCount <= 0 || mono.length === 0) return [];

  const peaks: number[] = new Array(bucketCount).fill(0);
  const samplesPerBucket = mono.length / bucketCount;

  for (let i = 0; i < bucketCount; i++) {
    const start = Math.floor(i * samplesPerBucket);
    const end = Math.min(mono.length, Math.floor((i + 1) * samplesPerBucket));
    let max = 0;
    for (let j = start; j < end; j++) {
      const amplitude = Math.abs(mono[j]);
      if (amplitude > max) max = amplitude;
    }
    peaks[i] = max;
  }

  return peaks;
}

/** Normalizes peak amplitudes to the [0, 1] range (scaled by `scale`). */
export function normalizePeaks(peaks: number[], scale = 1): number[] {
  const maxPeak = peaks.reduce((max, value) => Math.max(max, value), 0);
  const divisor = maxPeak > 0 ? maxPeak : 1;
  return peaks.map((value) => clamp(value / divisor, 0, 1) * scale);
}

/** Resolves the browser AudioContext constructor (with webkit fallback). */
export function getAudioContextConstructor(): typeof AudioContext | undefined {
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  );
}

/**
 * Decodes an ArrayBuffer of audio bytes into an AudioBuffer on the main
 * thread. `decodeAudioData` runs off the main thread in modern browsers;
 * this is used as the fallback when a Web Worker is unavailable.
 */
export async function decodeAudioArrayBuffer(arrayBuffer: ArrayBuffer): Promise<AudioBuffer> {
  const AudioCtor = getAudioContextConstructor();
  if (!AudioCtor) {
    throw new Error("Web Audio API is not supported in this browser");
  }

  const context = new AudioCtor();
  try {
    return await context.decodeAudioData(arrayBuffer);
  } finally {
    void context.close();
  }
}
