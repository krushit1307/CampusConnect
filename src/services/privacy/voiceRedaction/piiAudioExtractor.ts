/**
 * PII Audio Extractor Service (Issue #5141).
 *
 * Identifies sensitive PII timestamps in audio/video transcript metadata
 * and extracts precise target PCM audio sample windows.
 */

import { AudioBufferWindow, PiiAudioSpan, PiiCategory } from "@/types/voiceRedaction";

export interface TranscriptWordSegment {
  word: string;
  startSec: number;
  endSec: number;
  confidence?: number;
}

const PII_NAME_PATTERNS = [
  /\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, // Full Names e.g. "John Smith"
  /\b(Mr\.|Mrs\.|Ms\.|Dr\.)\s+[A-Z][a-z]+\b/g,
];

const PII_PHONE_PATTERN =
  /\b(?:\+?1[-. ]?)?\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}\b|\b\d{3}[-. ]\d{4}\b/g;
const PII_EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PII_SSN_PATTERN = /\b\d{3}-\d{2}-\d{4}\b/g;

export class PiiAudioExtractor {
  /**
   * Scans a list of timestamped transcript words and returns detected PII audio spans.
   */
  public detectPiiSpans(transcriptWords: TranscriptWordSegment[]): PiiAudioSpan[] {
    if (!transcriptWords || transcriptWords.length === 0) return [];

    const fullText = transcriptWords.map((w) => w.word).join(" ");
    const spans: PiiAudioSpan[] = [];

    // Helper to map text index to timestamp span
    const mapMatchToSpan = (matchText: string, category: PiiCategory) => {
      const matchWords = matchText
        .trim()
        .split(/\s+/)
        .map((w) => w.replace(/[.,!?]/g, "").toLowerCase());
      if (matchWords.length === 0) return;

      // Find exact sequence of transcript words matching matchWords
      let startIdx = -1;
      for (let i = 0; i <= transcriptWords.length - matchWords.length; i++) {
        let match = true;
        for (let j = 0; j < matchWords.length; j++) {
          if (transcriptWords[i + j].word.replace(/[.,!?]/g, "").toLowerCase() !== matchWords[j]) {
            match = false;
            break;
          }
        }
        if (match) {
          startIdx = i;
          break;
        }
      }

      if (startIdx === -1) return;

      const finalEndIdx = startIdx + matchWords.length - 1;
      const startSec = transcriptWords[startIdx].startSec;
      const endSec = transcriptWords[Math.min(transcriptWords.length - 1, finalEndIdx)].endSec;
      const durationSec = Math.max(0.1, endSec - startSec);

      const replacementText = this.deriveReplacementPhrase(category, matchText);

      spans.push({
        id: `pii_${category}_${Math.round(startSec * 100)}_${Date.now()}`,
        category,
        originalText: matchText,
        replacementText,
        startTimeSec: startSec,
        endTimeSec: endSec,
        durationSec: Number(durationSec.toFixed(3)),
        confidence: 0.95,
      });
    };

    // 1. Scan Emails
    const emailMatches = fullText.match(PII_EMAIL_PATTERN);
    if (emailMatches) {
      emailMatches.forEach((m) => mapMatchToSpan(m, "email"));
    }

    // 2. Scan Phones
    const phoneMatches = fullText.match(PII_PHONE_PATTERN);
    if (phoneMatches) {
      phoneMatches.forEach((m) => mapMatchToSpan(m, "phone"));
    }

    // 3. Scan SSN
    const ssnMatches = fullText.match(PII_SSN_PATTERN);
    if (ssnMatches) {
      ssnMatches.forEach((m) => mapMatchToSpan(m, "ssn"));
    }

    // 4. Scan Names (if not already matched)
    const COMMON_NON_NAME_WORDS = new Set([
      "hello",
      "hi",
      "my",
      "the",
      "this",
      "is",
      "a",
      "an",
      "in",
      "on",
      "at",
      "to",
      "from",
      "by",
      "for",
      "with",
      "about",
      "email",
      "phone",
    ]);

    PII_NAME_PATTERNS.forEach((pattern) => {
      const matches = fullText.match(pattern);
      if (matches) {
        matches.forEach((m) => {
          const parts = m.trim().split(/\s+/);
          let targetMatch = m;
          if (parts.length > 1 && COMMON_NON_NAME_WORDS.has(parts[0].toLowerCase())) {
            targetMatch = parts.slice(1).join(" ");
          }
          if (!spans.some((s) => s.originalText.includes(targetMatch))) {
            mapMatchToSpan(targetMatch, "name");
          }
        });
      }
    });

    return spans.sort((a, b) => a.startTimeSec - b.startTimeSec);
  }

  /**
   * Generates a context-aware generic replacement phrase for PII.
   */
  public deriveReplacementPhrase(category: PiiCategory, originalText: string): string {
    switch (category) {
      case "name":
        return "the student";
      case "phone":
        return "contact details redacted";
      case "email":
        return "email address redacted";
      case "ssn":
        return "identification number redacted";
      case "address":
        return "campus location redacted";
      default:
        return "information redacted";
    }
  }

  /**
   * Extracts a specific slice of Float32Array PCM audio buffer corresponding to a PII span.
   */
  public extractAudioSlice(
    audioBuffer: AudioBufferWindow,
    startTimeSec: number,
    endTimeSec: number,
  ): AudioBufferWindow {
    const startSample = Math.max(0, Math.floor(startTimeSec * audioBuffer.sampleRate));
    const endSample = Math.min(
      audioBuffer.channelData[0].length,
      Math.ceil(endTimeSec * audioBuffer.sampleRate),
    );
    const sliceLength = Math.max(1, endSample - startSample);

    const slicedChannels: Float32Array[] = audioBuffer.channelData.map((ch) =>
      ch.slice(startSample, endSample),
    );

    return {
      sampleRate: audioBuffer.sampleRate,
      channels: audioBuffer.channels,
      channelData: slicedChannels,
      durationSec: sliceLength / audioBuffer.sampleRate,
    };
  }
}

export const piiAudioExtractor = new PiiAudioExtractor();
