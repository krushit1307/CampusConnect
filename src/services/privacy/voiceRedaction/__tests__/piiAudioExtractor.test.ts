import { describe, it, expect } from "vitest";
import { PiiAudioExtractor, TranscriptWordSegment } from "../piiAudioExtractor";
import { AudioBufferWindow } from "@/types/voiceRedaction";

describe("PiiAudioExtractor", () => {
  const extractor = new PiiAudioExtractor();

  it("detects names, emails, and phone numbers in transcript words", () => {
    const words: TranscriptWordSegment[] = [
      { word: "Hello", startSec: 0.0, endSec: 0.5 },
      { word: "John", startSec: 0.6, endSec: 0.9 },
      { word: "Smith", startSec: 1.0, endSec: 1.4 },
      { word: "email", startSec: 1.5, endSec: 1.8 },
      { word: "user@campus.edu", startSec: 1.9, endSec: 2.5 },
      { word: "phone", startSec: 2.6, endSec: 2.9 },
      { word: "555-123-4567", startSec: 3.0, endSec: 3.8 },
    ];

    const spans = extractor.detectPiiSpans(words);

    expect(spans.length).toBeGreaterThanOrEqual(3);

    const nameSpan = spans.find((s) => s.category === "name");
    expect(nameSpan).toBeDefined();
    expect(nameSpan?.startTimeSec).toBe(0.6);
    expect(nameSpan?.replacementText).toBe("the student");

    const emailSpan = spans.find((s) => s.category === "email");
    expect(emailSpan).toBeDefined();
    expect(emailSpan?.replacementText).toBe("email address redacted");

    const phoneSpan = spans.find((s) => s.category === "phone");
    expect(phoneSpan).toBeDefined();
    expect(phoneSpan?.replacementText).toBe("contact details redacted");
  });

  it("extracts a sliced AudioBufferWindow for a target timestamp range", () => {
    const sampleRate = 44100;
    const totalSamples = sampleRate * 5; // 5-second buffer
    const channel = new Float32Array(totalSamples).fill(0.5);

    const masterAudio: AudioBufferWindow = {
      sampleRate,
      channels: 1,
      channelData: [channel],
      durationSec: 5.0,
    };

    const slice = extractor.extractAudioSlice(masterAudio, 1.0, 2.0); // 1-second slice

    expect(slice.sampleRate).toBe(sampleRate);
    expect(slice.durationSec).toBeCloseTo(1.0, 2);
    expect(slice.channelData[0].length).toBe(sampleRate * 1.0);
  });
});
