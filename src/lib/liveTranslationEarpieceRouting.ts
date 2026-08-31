// ---------------------------------------------------------------------------
// Issue #5285 — Dynamic "Alumni Speaker" Live Translation Earpiece Routing
//
// Pure, framework-free helpers for the Deepgram → DeepL → TTS → WebRTC
// pipeline. Deliberately free of React and Supabase imports so the maths,
// canonicalisation, and latency budgeting can be unit-tested in isolation.
//
// Pipeline (see migration 20261233000000):
//   English audio ──(Deepgram WS)──► transcript chunk ──(DeepL)──► Mandarin
//   text ──(AWS Polly / ElevenLabs)──► audio buffer ──(WebRTC)──► AirPods
//
// The browser never talks to Deepgram/DeepL/Polly directly in tests; the
// edge function `live-translation-router` does, while this module provides
// the deterministic, latency-aware orchestration used by both the edge
// function and the student earpiece hook / organiser session panel.
// ---------------------------------------------------------------------------

export const SUPPORTED_SOURCE_LANGUAGES = ["en"] as const;
export type SourceLanguage = (typeof SUPPORTED_SOURCE_LANGUAGES)[number];

export const SUPPORTED_TARGET_LANGUAGES = [
  "zh",
  "es",
  "hi",
  "fr",
  "de",
  "ja",
  "ko",
  "ar",
  "pt",
] as const;
export type TargetLanguage = (typeof SUPPORTED_TARGET_LANGUAGES)[number];

export const DEFAULT_TARGET_LANGUAGE: TargetLanguage = "zh";

export const EARPIECE_DEVICE_TYPES = [
  "airpods",
  "headphones",
  "hearing_aid",
  "speaker",
  "other",
] as const;
export type EarpieceDeviceType = (typeof EARPIECE_DEVICE_TYPES)[number];

export const PIPELINE_STAGES = [
  "idle",
  "transcribing",
  "translating",
  "synthesizing",
  "streaming",
  "error",
  "ended",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const CONNECTION_STATES = ["disconnected", "connecting", "connected", "error"] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const LATENCY_BUDGET_DEFAULT_MS = 1200;
export const LATENCY_BUDGET_MIN_MS = 200;
export const LATENCY_BUDGET_MAX_MS = 5000;

// Mirrors `hardwareClosedCaptions.DeepgramTranscriptChunk`
export type DeepgramTranscriptChunk = {
  text: string;
  isFinal: boolean;
};

export type TranslationRequest = {
  text: string;
  sourceLang: SourceLanguage;
  targetLang: TargetLanguage;
};

export type TranslationResult = {
  translatedText: string;
  sourceLang: SourceLanguage;
  targetLang: TargetLanguage;
  charCount: number;
};

export type TtsRequest = {
  text: string;
  language: TargetLanguage;
  voiceId?: string | null;
};

export type TtsAudioBuffer = {
  audioUrl: string;
  byteLength: number;
  durationMs: number;
  language: TargetLanguage;
};

export type WebRtcSignal = {
  type: "offer" | "answer";
  sdp: string;
};

export type EarpieceRouteConfig = {
  sessionId: string;
  targetLanguage: TargetLanguage;
  deviceType: EarpieceDeviceType;
  webrtcRoomId: string;
};

export type PipelineOrchestrationResult = {
  transcript: DeepgramTranscriptChunk;
  translation: TranslationResult;
  audio: TtsAudioBuffer;
  latencyMs: number;
  cadenceOffsetMs: number;
  withinBudget: boolean;
};

export const TARGET_LANGUAGE_LABELS: Record<TargetLanguage, string> = {
  zh: "Mandarin (中文)",
  es: "Spanish (Español)",
  hi: "Hindi (हिन्दी)",
  fr: "French (Français)",
  de: "German (Deutsch)",
  ja: "Japanese (日本語)",
  ko: "Korean (한국어)",
  ar: "Arabic (العربية)",
  pt: "Portuguese (Português)",
};

export const EARPIECE_DEVICE_LABELS: Record<EarpieceDeviceType, string> = {
  airpods: "AirPods",
  headphones: "Headphones",
  hearing_aid: "Hearing Aid",
  speaker: "Speaker",
  other: "Other",
};

// ─── Guards ────────────────────────────────────────────────────────

export function isSupportedTargetLanguage(
  value: string | null | undefined,
): value is TargetLanguage {
  return (SUPPORTED_TARGET_LANGUAGES as readonly string[]).includes((value ?? "").toLowerCase());
}

export function normalizeLanguageTag(value: string | null | undefined): TargetLanguage | null {
  const tag = (value ?? "").trim().toLowerCase();
  if (isSupportedTargetLanguage(tag)) return tag as TargetLanguage;
  return null;
}

export function isEarpieceDeviceType(
  value: string | null | undefined,
): value is EarpieceDeviceType {
  return (EARPIECE_DEVICE_TYPES as readonly string[]).includes((value ?? "").toLowerCase());
}

export function isPipelineStage(value: string | null | undefined): value is PipelineStage {
  return (PIPELINE_STAGES as readonly string[]).includes((value ?? "").toLowerCase());
}

export function isConnectionState(value: string | null | undefined): value is ConnectionState {
  return (CONNECTION_STATES as readonly string[]).includes((value ?? "").toLowerCase());
}

export function clampLatencyBudget(value: number | null | undefined): number {
  const n =
    typeof value === "number" && Number.isFinite(value)
      ? Math.round(value)
      : LATENCY_BUDGET_DEFAULT_MS;
  return Math.min(LATENCY_BUDGET_MAX_MS, Math.max(LATENCY_BUDGET_MIN_MS, n));
}

// ─── Deepgram ─────────────────────────────────────────────────────

/**
 * Pull the live transcript string out of a Deepgram listen WebSocket payload.
 * Mirrors `hardwareClosedCaptions.extractDeepgramTranscript` but kept here
 * so this module has zero cross-file imports for isolated testing.
 */
export function extractDeepgramTranscript(chunk: unknown): DeepgramTranscriptChunk | null {
  if (!chunk || typeof chunk !== "object") return null;
  const data = chunk as {
    is_final?: boolean;
    channel?: { alternatives?: Array<{ transcript?: string }> };
  };
  const text = data.channel?.alternatives?.[0]?.transcript?.trim() ?? "";
  if (!text) return null;
  return { text, isFinal: Boolean(data.is_final) };
}

// ─── DeepL (mock / deterministic) ─────────────────────────────────

/**
 * Deterministic mock for the DeepL translation hop.
 * Phase 1 stores a real DeepL call in the edge function; the lib mock must
 * be pure so vitest can assert pipeline latency without network.
 *
 * Contract: non-empty trimmed input → `translatedText` is a reversible,
 * language-tagged envelope so tests can verify round-trip without calling
 * the vendor. Empty input returns null (caller should skip TTS).
 */
export function translateTranscriptMock(request: TranslationRequest): TranslationResult | null {
  const text = (request.text ?? "").trim();
  if (!text) return null;
  const target = normalizeLanguageTag(request.targetLang) ?? DEFAULT_TARGET_LANGUAGE;
  // Deterministic envelope: `[zh] original text`
  const translatedText = `[${target}] ${text}`;
  return {
    translatedText,
    sourceLang: "en",
    targetLang: target,
    charCount: text.length,
  };
}

// ─── TTS (mock / deterministic) ───────────────────────────────────

/**
 * Deterministic mock for AWS Polly / ElevenLabs TTS.
 * Returns a synthetic audio URL whose byteLength and duration scale linearly
 * with the input char count, so the WebRTC throttler can reason about
 * bandwidth even in unit tests.
 */
export function synthesizeAudioBufferMock(request: TtsRequest): TtsAudioBuffer | null {
  const text = (request.text ?? "").trim();
  if (!text) return null;
  const language = normalizeLanguageTag(request.language) ?? DEFAULT_TARGET_LANGUAGE;
  const byteLength = Math.max(1024, text.length * 240); // ~240 bytes / char (mock PCM)
  const durationMs = Math.max(250, text.length * 55 + 300); // heuristic pacing
  const audioUrl = `data:audio/wav;mock,${encodeURIComponent(language)}:${encodeURIComponent(text.slice(0, 32))}`;
  return { audioUrl, byteLength, durationMs, language };
}

// ─── Latency & cadence ────────────────────────────────────────────

/** Heuristic full-pipeline latency: transcription + translation + TTS + network. */
export function estimatePipelineLatencyMs(transcript: string, targetLang: TargetLanguage): number {
  const chars = transcript.trim().length;
  if (chars === 0) return 0;
  const transcribingMs = 120 + Math.min(300, chars * 2);
  const translatingMs = 80 + chars * 3;
  const synthesizingMs = 200 + chars * 4;
  const networkMs = targetLang === "zh" ? 90 : 110;
  return Math.round(transcribingMs + translatingMs + synthesizingMs + networkMs);
}

export function shouldThrottlePipeline(latencyMs: number, budgetMs: number): boolean {
  return latencyMs > clampLatencyBudget(budgetMs);
}

/**
 * Speaker-cadence sync offset: how far the translated audio should be
 * delayed to stay "perfectly synchronized with the speaker's cadence"
 * (issue #5285). Positive = audio lags speaker; we return the amount to
 * advance playback so the earpiece feels live.
 */
export function formatCadenceSyncOffset(latencyMs: number, budgetMs: number): number {
  const budget = clampLatencyBudget(budgetMs);
  return Math.max(0, latencyMs - budget);
}

// ─── WebRTC signalling helpers ────────────────────────────────────

export function buildWebRtcOffer(roomId: string, offerSdp?: string): WebRtcSignal {
  const sdp =
    (offerSdp ?? "").trim() ||
    `v=0\r\no=- ${roomId} 0 IN IP4 127.0.0.1\r\ns=LiveTranslationOffer ${roomId}\r\n`;
  return { type: "offer", sdp };
}

export function buildWebRtcAnswer(roomId: string, answerSdp?: string): WebRtcSignal {
  const sdp =
    (answerSdp ?? "").trim() ||
    `v=0\r\no=- ${roomId} 0 IN IP4 127.0.0.1\r\ns=LiveTranslationAnswer ${roomId}\r\n`;
  return { type: "answer", sdp };
}

export function isValidWebRtcSignal(value: unknown): value is WebRtcSignal {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    (v.type === "offer" || v.type === "answer") && typeof v.sdp === "string" && v.sdp.length > 0
  );
}

// ─── Earpiece routing decisions ───────────────────────────────────

export type RoutingEligibility = {
  eligible: boolean;
  reason?: string;
};

export function evaluateEarpieceRouting(opts: {
  isCheckedIn: boolean;
  isSessionLive: boolean;
  targetLanguage: string | null | undefined;
  connectionState?: string | null | undefined;
}): RoutingEligibility {
  if (!opts.isCheckedIn) return { eligible: false, reason: "not_checked_in" };
  if (!opts.isSessionLive) return { eligible: false, reason: "session_not_live" };
  if (!isSupportedTargetLanguage(opts.targetLanguage ?? ""))
    return { eligible: false, reason: "unsupported_language" };
  if (opts.connectionState === "error") return { eligible: false, reason: "route_in_error" };
  return { eligible: true };
}

// ─── Full pipeline orchestration (pure) ───────────────────────────

/**
 * Orchestrate Deepgram → DeepL → TTS for a single transcript chunk.
 * Pure + synchronous (mocks); the real async pipeline lives in the edge
 * function, but this deterministic version is what vitest and the hook
 * use to simulate near-real-time earpiece streaming without network.
 */
export function orchestratePipeline(opts: {
  deepgramPayload: unknown;
  targetLanguage: TargetLanguage;
  latencyBudgetMs?: number;
}): PipelineOrchestrationResult | null {
  const transcript = extractDeepgramTranscript(opts.deepgramPayload);
  if (!transcript) return null;

  const target = normalizeLanguageTag(opts.targetLanguage) ?? DEFAULT_TARGET_LANGUAGE;
  const translation = translateTranscriptMock({
    text: transcript.text,
    sourceLang: "en",
    targetLang: target,
  });
  if (!translation) return null;

  const audio = synthesizeAudioBufferMock({ text: translation.translatedText, language: target });
  if (!audio) return null;

  const budget = clampLatencyBudget(opts.latencyBudgetMs);
  const latencyMs = estimatePipelineLatencyMs(transcript.text, target);
  const cadenceOffsetMs = formatCadenceSyncOffset(latencyMs, budget);
  const withinBudget = !shouldThrottlePipeline(latencyMs, budget);

  return { transcript, translation, audio, latencyMs, cadenceOffsetMs, withinBudget };
}

// ─── Deepgram → Translation pipeline request builder ─────────────

/**
 * Build the edge-function POST body for the multi-stage AI pipeline.
 * The edge function (`supabase/functions/live-translation-router`) fans it
 * out to Deepgram/DeepL/Polly and returns a WebRTC audio buffer URL.
 */
export function buildPipelineRequest(opts: {
  sessionId: string;
  routeId: string;
  transcript: string;
  sourceLang?: SourceLanguage;
  targetLang: TargetLanguage;
  isFinal?: boolean;
}): {
  url: string;
  method: "POST";
  body: Record<string, unknown>;
} {
  return {
    url: "/functions/v1/live-translation-router",
    method: "POST",
    body: {
      session_id: opts.sessionId,
      route_id: opts.routeId,
      transcript: opts.transcript,
      source_language: opts.sourceLang ?? "en",
      target_language: normalizeLanguageTag(opts.targetLang) ?? DEFAULT_TARGET_LANGUAGE,
      is_final: Boolean(opts.isFinal),
      pipeline: ["deepgram", "deepl", "tts", "webrtc"] as const,
    },
  };
}
