import { describe, expect, it } from "vitest";
import {
  DEFAULT_TARGET_LANGUAGE,
  EARPIECE_DEVICE_TYPES,
  SUPPORTED_TARGET_LANGUAGES,
  buildPipelineRequest,
  buildWebRtcAnswer,
  buildWebRtcOffer,
  clampLatencyBudget,
  estimatePipelineLatencyMs,
  evaluateEarpieceRouting,
  extractDeepgramTranscript,
  formatCadenceSyncOffset,
  isConnectionState,
  isEarpieceDeviceType,
  isPipelineStage,
  isSupportedTargetLanguage,
  isValidWebRtcSignal,
  normalizeLanguageTag,
  orchestratePipeline,
  shouldThrottlePipeline,
  synthesizeAudioBufferMock,
  translateTranscriptMock,
} from "./liveTranslationEarpieceRouting";

const DEEPGRAM_FINAL = {
  is_final: true,
  channel: { alternatives: [{ transcript: "Welcome to the alumni keynote" }] },
};

const DEEPGRAM_INTERIM = {
  is_final: false,
  channel: { alternatives: [{ transcript: "  hello world  " }] },
};

describe("live translation earpiece routing (#5285)", () => {
  it("identifies supported target languages and normalizes tags", () => {
    expect(SUPPORTED_TARGET_LANGUAGES).toContain(DEFAULT_TARGET_LANGUAGE);
    expect(isSupportedTargetLanguage("zh")).toBe(true);
    expect(isSupportedTargetLanguage("ZH")).toBe(true);
    expect(isSupportedTargetLanguage("xx")).toBe(false);
    expect(normalizeLanguageTag(" Zh ")).toBe("zh");
    expect(normalizeLanguageTag("  ")).toBeNull();
    expect(normalizeLanguageTag("es")).toBe("es");
  });

  it("identifies earpiece device types and pipeline/connection states", () => {
    expect(EARPIECE_DEVICE_TYPES).toContain("airpods");
    expect(isEarpieceDeviceType("airpods")).toBe(true);
    expect(isEarpieceDeviceType("AirPods")).toBe(true);
    expect(isEarpieceDeviceType("unknown")).toBe(false);
    expect(isPipelineStage("streaming")).toBe(true);
    expect(isPipelineStage("STREAMING")).toBe(true);
    expect(isPipelineStage("unknown")).toBe(false);
    expect(isConnectionState("connected")).toBe(true);
    expect(isConnectionState("disconnected")).toBe(true);
    expect(isConnectionState("bogus")).toBe(false);
  });

  it("clamps latency budget to 200-5000 ms", () => {
    expect(clampLatencyBudget(1200)).toBe(1200);
    expect(clampLatencyBudget(10)).toBe(200);
    expect(clampLatencyBudget(9999)).toBe(5000);
    expect(clampLatencyBudget(null)).toBe(1200);
    expect(clampLatencyBudget(undefined)).toBe(1200);
  });

  it("extracts Deepgram transcript chunks", () => {
    expect(extractDeepgramTranscript(DEEPGRAM_FINAL)).toEqual({
      text: "Welcome to the alumni keynote",
      isFinal: true,
    });
    expect(extractDeepgramTranscript(DEEPGRAM_INTERIM)).toEqual({
      text: "hello world",
      isFinal: false,
    });
    expect(
      extractDeepgramTranscript({
        is_final: true,
        channel: { alternatives: [{ transcript: "   " }] },
      }),
    ).toBeNull();
    expect(extractDeepgramTranscript(null)).toBeNull();
  });

  it("mocks DeepL translation deterministically", () => {
    const r = translateTranscriptMock({ text: "Hello world", sourceLang: "en", targetLang: "zh" });
    expect(r).not.toBeNull();
    expect(r!.translatedText).toBe("[zh] Hello world");
    expect(r!.targetLang).toBe("zh");
    expect(r!.charCount).toBe(11);
    expect(translateTranscriptMock({ text: "  ", sourceLang: "en", targetLang: "zh" })).toBeNull();
    // falls back to zh for unsupported tag
    const fallback = translateTranscriptMock({
      text: "Hi",
      sourceLang: "en",
      targetLang: "xx" as never,
    });
    expect(fallback!.targetLang).toBe("zh");
  });

  it("mocks TTS audio buffer with language-aware sizing", () => {
    const a = synthesizeAudioBufferMock({ text: "Hello", language: "zh" });
    expect(a).not.toBeNull();
    expect(a!.language).toBe("zh");
    expect(a!.byteLength).toBeGreaterThan(1024);
    expect(a!.durationMs).toBeGreaterThan(0);
    expect(a!.audioUrl.startsWith("data:audio/wav;mock,")).toBe(true);
    expect(synthesizeAudioBufferMock({ text: "   ", language: "zh" })).toBeNull();
  });

  it("estimates pipeline latency and throttling", () => {
    const latency = estimatePipelineLatencyMs("Welcome to the alumni keynote", "zh");
    expect(latency).toBeGreaterThan(400);
    expect(estimatePipelineLatencyMs("", "zh")).toBe(0);
    expect(shouldThrottlePipeline(latency, 1200)).toBe(latency > 1200);
    expect(shouldThrottlePipeline(500, 1200)).toBe(false);
    expect(shouldThrottlePipeline(2000, 1200)).toBe(true);
    expect(formatCadenceSyncOffset(1500, 1200)).toBe(300);
    expect(formatCadenceSyncOffset(800, 1200)).toBe(0);
  });

  it("builds WebRTC offer/answer and validates signals", () => {
    const offer = buildWebRtcOffer("room_123");
    expect(offer.type).toBe("offer");
    expect(offer.sdp).toContain("room_123");
    expect(isValidWebRtcSignal(offer)).toBe(true);
    const answer = buildWebRtcAnswer("room_123", "v=0\r\no=answer");
    expect(answer.type).toBe("answer");
    expect(isValidWebRtcSignal(answer)).toBe(true);
    expect(isValidWebRtcSignal({ type: "offer", sdp: "" })).toBe(false);
    expect(isValidWebRtcSignal(null)).toBe(false);
  });

  it("evaluates earpiece routing eligibility", () => {
    expect(
      evaluateEarpieceRouting({ isCheckedIn: false, isSessionLive: true, targetLanguage: "zh" }),
    ).toEqual({
      eligible: false,
      reason: "not_checked_in",
    });
    expect(
      evaluateEarpieceRouting({ isCheckedIn: true, isSessionLive: false, targetLanguage: "zh" }),
    ).toEqual({
      eligible: false,
      reason: "session_not_live",
    });
    expect(
      evaluateEarpieceRouting({ isCheckedIn: true, isSessionLive: true, targetLanguage: "xx" }),
    ).toEqual({
      eligible: false,
      reason: "unsupported_language",
    });
    expect(
      evaluateEarpieceRouting({
        isCheckedIn: true,
        isSessionLive: true,
        targetLanguage: "zh",
        connectionState: "error",
      }),
    ).toEqual({
      eligible: false,
      reason: "route_in_error",
    });
    expect(
      evaluateEarpieceRouting({ isCheckedIn: true, isSessionLive: true, targetLanguage: "zh" }),
    ).toEqual({ eligible: true });
  });

  it("orchestrates the full Deepgram→DeepL→TTS→WebRTC pipeline", () => {
    const result = orchestratePipeline({
      deepgramPayload: DEEPGRAM_FINAL,
      targetLanguage: "zh",
      latencyBudgetMs: 1200,
    });
    expect(result).not.toBeNull();
    expect(result!.transcript.text).toBe("Welcome to the alumni keynote");
    expect(result!.translation.translatedText).toBe("[zh] Welcome to the alumni keynote");
    expect(result!.audio.language).toBe("zh");
    expect(result!.latencyMs).toBeGreaterThan(0);
    expect(typeof result!.withinBudget).toBe("boolean");

    expect(
      orchestratePipeline({
        deepgramPayload: { is_final: true, channel: { alternatives: [{ transcript: "" }] } },
        targetLanguage: "zh",
      }),
    ).toBeNull();
  });

  it("builds edge-function pipeline request bodies", () => {
    const req = buildPipelineRequest({
      sessionId: "sess-1",
      routeId: "route-1",
      transcript: "Hello",
      targetLang: "zh",
      isFinal: true,
    });
    expect(req.url).toBe("/functions/v1/live-translation-router");
    expect(req.method).toBe("POST");
    expect(req.body.session_id).toBe("sess-1");
    expect(req.body.target_language).toBe("zh");
    expect(req.body.pipeline as string[]).toContain("webrtc");
  });
});
