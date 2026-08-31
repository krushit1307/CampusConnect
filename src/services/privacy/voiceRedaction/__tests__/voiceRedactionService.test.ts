import { describe, it, expect, vi } from "vitest";
import { VoiceRedactionService } from "../voiceRedactionService";
import { PiiAudioExtractor, TranscriptWordSegment } from "../piiAudioExtractor";
import { ReplacementAudioGenerator } from "../replacementAudioGenerator";
import { AudioSegmentStitcher } from "../audioSegmentStitcher";
import { AudioBufferWindow } from "@/types/voiceRedaction";

describe("VoiceRedactionService", () => {
  const sampleRate = 44100;
  const durationSec = 4.0;
  const masterBuffer: AudioBufferWindow = {
    sampleRate,
    channels: 1,
    channelData: [new Float32Array(Math.floor(sampleRate * durationSec)).fill(0.5)],
    durationSec,
  };

  const transcriptWords: TranscriptWordSegment[] = [
    { word: "My", startSec: 0.0, endSec: 0.4 },
    { word: "name", startSec: 0.5, endSec: 0.8 },
    { word: "is", startSec: 0.9, endSec: 1.1 },
    { word: "John", startSec: 1.2, endSec: 1.5 },
    { word: "Smith", startSec: 1.6, endSec: 2.0 },
    { word: "phone", startSec: 2.1, endSec: 2.4 },
    { word: "555-0199", startSec: 2.5, endSec: 3.5 },
  ];

  it("executes end-to-end PII voice replacement redaction", async () => {
    const service = new VoiceRedactionService();

    const result = await service.redactVoicePii(masterBuffer, transcriptWords);

    expect(result.processedSpans.length).toBeGreaterThanOrEqual(2);
    expect(result.fallbackTriggered).toBe(false);
    expect(result.auditLog.privacyVerified).toBe(true);
    expect(result.auditLog.spansVoiceReplaced).toBeGreaterThanOrEqual(2);
  });

  it("guarantees zero PII leakage by falling back to bleeping if voice generation fails", async () => {
    const extractor = new PiiAudioExtractor();
    const failingGenerator = new ReplacementAudioGenerator();

    // Mock generator to throw error simulating synthesis failure
    vi.spyOn(failingGenerator, "generateReplacementAudio").mockRejectedValue(
      new Error("Voice synthesis API connection timeout"),
    );

    const stitcher = new AudioSegmentStitcher();
    const service = new VoiceRedactionService(extractor, failingGenerator, stitcher);

    const result = await service.redactVoicePii(masterBuffer, transcriptWords);

    expect(result.fallbackTriggered).toBe(true);
    expect(result.auditLog.spansFallbackRedacted).toBeGreaterThanOrEqual(1);
    expect(result.auditLog.privacyVerified).toBe(true);
  });
});
