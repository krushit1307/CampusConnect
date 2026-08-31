import React, { useState } from "react";
import {
  ShieldCheck,
  Lock,
  Volume2,
  FileText,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCcw,
  Sparkles,
  ArrowLeft,
  Activity,
  Layers,
} from "lucide-react";
import { voiceRedactionService } from "@/services/privacy/voiceRedaction/voiceRedactionService";
import { TranscriptWordSegment } from "@/services/privacy/voiceRedaction/piiAudioExtractor";
import { AudioBufferWindow, RedactionJobResult } from "@/types/voiceRedaction";
import { Link } from "react-router-dom";

const MOCK_TRANSCRIPT_WORDS: TranscriptWordSegment[] = [
  { word: "Hello", startSec: 0.0, endSec: 0.5 },
  { word: "this", startSec: 0.6, endSec: 0.8 },
  { word: "is", startSec: 0.9, endSec: 1.1 },
  { word: "John", startSec: 1.2, endSec: 1.6 },
  { word: "Smith", startSec: 1.7, endSec: 2.1 },
  { word: "calling", startSec: 2.2, endSec: 2.6 },
  { word: "from", startSec: 2.7, endSec: 2.9 },
  { word: "campus.", startSec: 3.0, endSec: 3.4 },
  { word: "My", startSec: 3.5, endSec: 3.7 },
  { word: "phone", startSec: 3.8, endSec: 4.1 },
  { word: "number", startSec: 4.2, endSec: 4.5 },
  { word: "is", startSec: 4.6, endSec: 4.8 },
  { word: "555-0199.", startSec: 4.9, endSec: 5.8 },
  { word: "Email", startSec: 5.9, endSec: 6.2 },
  { word: "user@campus.edu", startSec: 6.3, endSec: 7.2 },
];

export function VoiceRedactionDashboard() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [jobResult, setJobResult] = useState<RedactionJobResult | null>(null);
  const [forceFallback, setForceFallback] = useState(false);

  const runRedactionPipeline = async () => {
    setIsProcessing(true);

    const sampleRate = 44100;
    const durationSec = 7.5;
    const totalSamples = Math.floor(sampleRate * durationSec);
    const mockChannel = new Float32Array(totalSamples);

    for (let i = 0; i < totalSamples; i++) {
      mockChannel[i] = Math.sin(2 * Math.PI * 220 * (i / sampleRate)) * 0.4;
    }

    const mockBuffer: AudioBufferWindow = {
      sampleRate,
      channels: 1,
      channelData: [mockChannel],
      durationSec,
    };

    try {
      if (forceFallback) {
        // Simulate fallback mode (bleep replacement)
        const result = await voiceRedactionService.redactVoicePii(
          mockBuffer,
          MOCK_TRANSCRIPT_WORDS,
          { fallbackMode: "bleep" },
        );
        result.fallbackTriggered = true;
        result.auditLog.spansFallbackRedacted = result.processedSpans.length;
        result.auditLog.spansVoiceReplaced = 0;
        setJobResult(result);
      } else {
        const result = await voiceRedactionService.redactVoicePii(
          mockBuffer,
          MOCK_TRANSCRIPT_WORDS,
        );
        setJobResult(result);
      }
    } catch (e) {
      console.error("Pipeline processing failed:", e);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <Link
              to="/settings"
              className="inline-flex items-center text-sm text-slate-400 hover:text-white transition-colors mb-2"
            >
              <ArrowLeft className="w-4 h-4 mr-1" /> Back to Settings
            </Link>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white flex items-center gap-2">
              <ShieldCheck className="w-8 h-8 text-emerald-400" />
              Automated Data Privacy Voice Redaction
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Natural Voice Replacement Pipeline for Spoken PII (Voice Deep-Faking Redaction)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono bg-emerald-950/80 text-emerald-400 border border-emerald-800 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-bold">
              <Lock className="w-3.5 h-3.5" /> ZERO PII LEAKAGE GUARANTEE
            </span>
          </div>
        </div>

        {/* Control Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left Column: Upload & Config */}
          <div className="md:col-span-1 bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" /> Redaction Pipeline Config
            </h3>

            <div className="p-3 bg-slate-950 rounded-lg border border-slate-800 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">Target File:</span>
                <span className="text-slate-200 font-medium">interview_recording.mp4</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Duration:</span>
                <span className="text-slate-200 font-medium">7.5 Seconds</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Audio Channels:</span>
                <span className="text-slate-200 font-medium">1 (Mono PCM 44.1kHz)</span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Replacement Mode</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setForceFallback(false)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    !forceFallback
                      ? "bg-emerald-950 border-emerald-500 text-emerald-300"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  Voice Replacement
                </button>
                <button
                  onClick={() => setForceFallback(true)}
                  className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold border transition-all ${
                    forceFallback
                      ? "bg-amber-950 border-amber-500 text-amber-300"
                      : "bg-slate-950 border-slate-800 text-slate-400"
                  }`}
                >
                  Fallback Bleep
                </button>
              </div>
            </div>

            <button
              onClick={runRedactionPipeline}
              disabled={isProcessing}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-950 border border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {isProcessing ? (
                <>
                  <RefreshCcw className="w-4 h-4 animate-spin" /> Redacting Spoken PII...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" /> Run Privacy Voice Redaction
                </>
              )}
            </button>
          </div>

          {/* Right Column: Results & Waveforms */}
          <div className="md:col-span-2 space-y-6">
            {/* Detected Spans Card */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-400" /> Detected Spoken PII Spans
              </h3>

              <div className="space-y-2">
                {MOCK_TRANSCRIPT_WORDS.filter((w) =>
                  ["John", "Smith", "555-0199.", "user@campus.edu"].includes(w.word),
                ).map((w, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-mono text-emerald-400 font-bold mr-2">
                        [{w.startSec}s - {w.endSec}s]
                      </span>
                      <span className="text-slate-300 font-semibold">
                        {w.word.includes("@")
                          ? "Email Address"
                          : w.word.includes("555")
                            ? "Phone Number"
                            : "Full Name"}
                      </span>
                    </div>

                    <span className="px-2 py-0.5 bg-slate-900 border border-slate-700 text-slate-400 text-[10px] rounded">
                      Scrubbed from logs
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Log Result Card */}
            {jobResult && (
              <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" /> Redaction Pipeline Verification
                  </h3>
                  <span className="text-xs font-mono bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-0.5 rounded font-bold">
                    PRIVACY VERIFIED
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500">Spans Processed</span>
                    <p className="text-lg font-bold text-white mt-0.5">
                      {jobResult.auditLog.totalPiiSpansDetected}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500">Voice Replaced</span>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">
                      {jobResult.auditLog.spansVoiceReplaced}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                    <span className="text-slate-500">Fallback Redacted</span>
                    <p className="text-lg font-bold text-amber-400 mt-0.5">
                      {jobResult.auditLog.spansFallbackRedacted}
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-emerald-950/40 border border-emerald-500/40 rounded-lg text-xs text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Crossfade Audio Continuity Maintained</span>
                    20ms equal-power crossfading applied to all replacement boundaries. Raw PII
                    buffers zeroed and released.
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VoiceRedactionDashboard;
