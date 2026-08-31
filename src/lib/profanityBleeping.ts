export interface ProfanityUtterance {
  word: string;
  startMs: number;
  durationMs: number;
}

export interface WebRtcAudioFrame {
  timestampMs: number;
  sampleRate: number;
  durationMs: number;
  buffer: Float32Array;
}

export interface BleepMaskResult {
  isMasked: boolean;
  maskType: "passthrough" | "1000Hz_sine_wave_bleep";
  outputBuffer: Float32Array;
}

export const BLEEP_SINE_FREQUENCY_HZ = 1000;

/**
 * Generates a 1000 Hz sine wave "Bleep" audio buffer for a given sample rate and duration.
 */
export function generateSineWaveBleepBuffer(
  sampleRate: number,
  durationMs: number,
  frequencyHz = BLEEP_SINE_FREQUENCY_HZ,
): Float32Array {
  const totalSamples = Math.floor((sampleRate * durationMs) / 1000);
  const buffer = new Float32Array(totalSamples);
  const angularFrequency = 2 * Math.PI * frequencyHz;

  for (let i = 0; i < totalSamples; i++) {
    const timeSec = i / sampleRate;
    buffer[i] = Math.sin(angularFrequency * timeSec) * 0.5; // 0.5 amplitude
  }

  return buffer;
}

/**
 * Checks if a given frame timestamp falls within a detected profanity utterance window.
 */
export function isTimestampInProfanityWindow(
  frameTimestampMs: number,
  utterance: ProfanityUtterance,
): boolean {
  const windowEndMs = utterance.startMs + utterance.durationMs;
  return frameTimestampMs >= utterance.startMs && frameTimestampMs <= windowEndMs;
}

/**
 * Intercepts WebRTC audio frames via WebCodecs API principles and overwrites profanity with a 1000 Hz bleep.
 */
export function processWebRtcAudioFrameForProfanity(
  frame: WebRtcAudioFrame,
  activeProfanities: ProfanityUtterance[],
): BleepMaskResult {
  const hasProfanity = activeProfanities.some((p) =>
    isTimestampInProfanityWindow(frame.timestampMs, p),
  );

  if (!hasProfanity) {
    return {
      isMasked: false,
      maskType: "passthrough",
      outputBuffer: frame.buffer,
    };
  }

  const bleepBuffer = generateSineWaveBleepBuffer(frame.sampleRate, frame.durationMs);

  return {
    isMasked: true,
    maskType: "1000Hz_sine_wave_bleep",
    outputBuffer: bleepBuffer,
  };
}
