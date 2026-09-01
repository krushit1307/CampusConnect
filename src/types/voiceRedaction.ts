/**
 * Data Privacy Voice Redaction & Deep-Faking Replacement Types (Issue #5141).
 */

export type PiiCategory = "name" | "phone" | "email" | "address" | "ssn" | "other";

export interface PiiAudioSpan {
  id: string;
  category: PiiCategory;
  /** Original PII text detected in transcript (e.g., "John Smith") */
  originalText: string;
  /** Privacy replacement text (e.g., "the student") */
  replacementText: string;
  /** Start time of PII speech segment in seconds */
  startTimeSec: number;
  /** End time of PII speech segment in seconds */
  endTimeSec: number;
  /** Duration in seconds */
  durationSec: number;
  /** Confidence score of detection (0 to 1) */
  confidence: number;
}

export interface AudioBufferWindow {
  sampleRate: number;
  channels: number;
  /** Float32Array channel audio data */
  channelData: Float32Array[];
  durationSec: number;
}

export interface VoiceSynthesisParams {
  pitchShiftCents?: number;
  speakingRate?: number; // 0.8 to 1.2
  estimatedSpeakerGender?: "male" | "female" | "neutral";
  targetVolumeGain?: number;
}

export interface RedactionPipelineConfig {
  /** Crossfade duration in milliseconds (default: 20ms) */
  crossfadeMs: number;
  /** Fallback mode if voice generation fails (default: 'bleep') */
  fallbackMode: "bleep" | "mute";
  /** Bleep sine frequency in Hz (default: 1000Hz) */
  bleepFrequencyHz: number;
  /** Maximum allowable time stretch ratio for alignment (default: 1.25) */
  maxTimeStretchRatio: number;
  /** Enable background noise preservation during replacement */
  preserveAmbientBackground: boolean;
}

export interface AuditLogEntry {
  jobId: string;
  timestamp: string;
  totalPiiSpansDetected: number;
  spansVoiceReplaced: number;
  spansFallbackRedacted: number;
  originalDurationSec: number;
  processedDurationSec: number;
  privacyVerified: boolean;
}

export interface RedactionJobResult {
  jobId: string;
  processedBuffer: AudioBufferWindow;
  processedSpans: PiiAudioSpan[];
  fallbackTriggered: boolean;
  auditLog: AuditLogEntry;
}
