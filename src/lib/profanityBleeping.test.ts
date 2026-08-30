import { describe, it, expect } from "vitest";
import {
  generateSineWaveBleepBuffer,
  isTimestampInProfanityWindow,
  processWebRtcAudioFrameForProfanity,
  ProfanityUtterance,
  WebRtcAudioFrame,
} from "./profanityBleeping";

describe("Build Real-Time Audio/Visual Check Automated Profanity Bleeping Suite (#4788)", () => {
  const profanityUtterance: ProfanityUtterance = {
    word: "toxic_slur",
    startMs: 12000,
    durationMs: 600, // 12000ms to 12600ms
  };

  const sampleRate = 48000; // 48kHz audio stream

  it("generates 1000 Hz sine wave bleep buffer of precise sample length", () => {
    const durationMs = 100; // 100ms frame
    const buffer = generateSineWaveBleepBuffer(sampleRate, durationMs, 1000);

    const expectedSamples = Math.floor((48000 * 100) / 1000); // 4800 samples
    expect(buffer.length).toBe(expectedSamples);
    expect(buffer[0]).toBeCloseTo(0, 4); // sin(0) = 0
  });

  it("identifies timestamps falling inside flagged profanity windows", () => {
    expect(isTimestampInProfanityWindow(11900, profanityUtterance)).toBe(false);
    expect(isTimestampInProfanityWindow(12200, profanityUtterance)).toBe(true);
    expect(isTimestampInProfanityWindow(12600, profanityUtterance)).toBe(true);
    expect(isTimestampInProfanityWindow(12700, profanityUtterance)).toBe(false);
  });

  it("masks audio buffer with 1000 Hz bleep during profanity and passes through normal speech", () => {
    const originalSpeechBuffer = new Float32Array(480).fill(0.123);

    const normalFrame: WebRtcAudioFrame = {
      timestampMs: 5000,
      sampleRate,
      durationMs: 10,
      buffer: originalSpeechBuffer,
    };

    const toxicFrame: WebRtcAudioFrame = {
      timestampMs: 12300,
      sampleRate,
      durationMs: 10,
      buffer: originalSpeechBuffer,
    };

    // 1. Process normal audio frame (passthrough)
    const normalResult = processWebRtcAudioFrameForProfanity(normalFrame, [profanityUtterance]);
    expect(normalResult.isMasked).toBe(false);
    expect(normalResult.maskType).toBe("passthrough");
    expect(normalResult.outputBuffer[0]).toBeCloseTo(0.123, 5);

    // 2. Process toxic frame (surgical bleep override)
    const toxicResult = processWebRtcAudioFrameForProfanity(toxicFrame, [profanityUtterance]);
    expect(toxicResult.isMasked).toBe(true);
    expect(toxicResult.maskType).toBe("1000Hz_sine_wave_bleep");
    expect(toxicResult.outputBuffer[0]).not.toBeCloseTo(0.123, 5); // Replaced with sine wave
  });
});
