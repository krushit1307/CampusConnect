import { describe, it, expect } from "vitest";
import { AudioSegmentStitcher } from "../audioSegmentStitcher";
import { AudioBufferWindow } from "@/types/voiceRedaction";

describe("AudioSegmentStitcher", () => {
  const stitcher = new AudioSegmentStitcher();
  const sampleRate = 44100;

  it("time-aligns replacement audio to match target duration", () => {
    const sourceSamples = Math.floor(sampleRate * 2.0); // 2.0s
    const sourceAudio: AudioBufferWindow = {
      sampleRate,
      channels: 1,
      channelData: [new Float32Array(sourceSamples).fill(0.3)],
      durationSec: 2.0,
    };

    const aligned = stitcher.alignAudioDuration(sourceAudio, 1.5); // Align to 1.5s

    expect(aligned.durationSec).toBe(1.5);
    expect(aligned.channelData[0].length).toBe(Math.floor(sampleRate * 1.5));
  });

  it("stitches replacement audio into master track with equal-power crossfading", () => {
    const masterDurationSec = 4.0;
    const masterSamples = Math.floor(sampleRate * masterDurationSec);
    const masterChannel = new Float32Array(masterSamples).fill(0.8);

    const masterAudio: AudioBufferWindow = {
      sampleRate,
      channels: 1,
      channelData: [masterChannel],
      durationSec: masterDurationSec,
    };

    const repSamples = Math.floor(sampleRate * 1.0);
    const replacementAudio: AudioBufferWindow = {
      sampleRate,
      channels: 1,
      channelData: [new Float32Array(repSamples).fill(0.2)],
      durationSec: 1.0,
    };

    // Stitch replacement between 1.0s and 2.0s
    const stitched = stitcher.stitchSegment(masterAudio, replacementAudio, 1.0, 2.0, 20);

    expect(stitched.durationSec).toBe(masterDurationSec);

    // Mid-span sample should equal replacement audio value (0.2)
    const midIndex = Math.floor(1.5 * sampleRate);
    expect(stitched.channelData[0][midIndex]).toBeCloseTo(0.2, 1);

    // Unmodified audio before span should remain original master audio value (0.8)
    const beforeIndex = Math.floor(0.5 * sampleRate);
    expect(stitched.channelData[0][beforeIndex]).toBeCloseTo(0.8, 1);
  });
});
