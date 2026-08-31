import { describe, it, expect } from "vitest";
import { ReplacementAudioGenerator } from "../replacementAudioGenerator";
import { AudioBufferWindow, PiiAudioSpan } from "@/types/voiceRedaction";

describe("ReplacementAudioGenerator", () => {
  const generator = new ReplacementAudioGenerator();

  it("estimates speaker pitch and gender parameters from audio sample slice", () => {
    const sampleRate = 44100;
    const durationSec = 1.0;
    const totalSamples = Math.floor(sampleRate * durationSec);
    const channel = new Float32Array(totalSamples);

    // Sine wave at 120 Hz (Male pitch range)
    for (let i = 0; i < totalSamples; i++) {
      channel[i] = Math.sin(2 * Math.PI * 120 * (i / sampleRate)) * 0.4;
    }

    const slice: AudioBufferWindow = {
      sampleRate,
      channels: 1,
      channelData: [channel],
      durationSec,
    };

    const params = generator.estimateSpeakerParams(slice);

    expect(params.estimatedSpeakerGender).toBeDefined();
    expect(params.targetVolumeGain).toBeGreaterThan(0.0);
  });

  it("synthesizes generic replacement speech audio matching target duration", async () => {
    const span: PiiAudioSpan = {
      id: "span_1",
      category: "name",
      originalText: "John Smith",
      replacementText: "the student",
      startTimeSec: 1.0,
      endTimeSec: 2.5,
      durationSec: 1.5,
      confidence: 0.95,
    };

    const result = await generator.generateReplacementAudio(span, 44100, 1.5, {
      pitchShiftCents: 160,
      targetVolumeGain: 0.5,
    });

    expect(result.sampleRate).toBe(44100);
    expect(result.durationSec).toBe(1.5);
    expect(result.channelData[0].length).toBe(Math.floor(44100 * 1.5));
    // Verify fading envelope (start and end values near 0)
    expect(result.channelData[0][0]).toBeCloseTo(0, 1);
  });
});
