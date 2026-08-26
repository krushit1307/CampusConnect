/**
 * TranscriptionControls.tsx — Organizer panel for live audio transcription
 * (Issue #3925).
 */

import React, { useState } from "react";
import { Mic, MicOff, AlertCircle, Loader2, Globe } from "lucide-react";
import { useAudioTranscription } from "@/hooks/useAudioTranscription";

interface TranscriptionControlsProps {
  eventId: string;
}

const LANGUAGES: Array<{ code: string; label: string }> = [
  { code: "en-US", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es-ES", label: "Spanish" },
  { code: "fr-FR", label: "French" },
  { code: "de-DE", label: "German" },
  { code: "hi-IN", label: "Hindi" },
  { code: "zh-CN", label: "Chinese (Simplified)" },
  { code: "ja-JP", label: "Japanese" },
  { code: "ko-KR", label: "Korean" },
  { code: "pt-BR", label: "Portuguese (Brazil)" },
  { code: "ar-SA", label: "Arabic" },
  { code: "ru-RU", label: "Russian" },
];

export function TranscriptionControls({ eventId }: TranscriptionControlsProps) {
  const [enabled, setEnabled] = useState(false);
  const [language, setLanguage] = useState("en-US");

  const {
    isSupported,
    isListening,
    interimTranscript,
    error,
    setLanguage: setRecognitionLang,
  } = useAudioTranscription({
    eventId,
    isOrganizer: true,
    enabled,
    lang: language,
  });

  const handleToggle = () => {
    if (!isSupported) return;
    setEnabled((prev) => !prev);
  };

  const handleLanguageChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLang = e.target.value;
    setLanguage(newLang);
    setRecognitionLang(newLang);
  };

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Live Transcription</h3>
        <span
          className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
            !isSupported
              ? "bg-red-500/10 text-red-400"
              : isListening
                ? "bg-green-500/10 text-green-400"
                : enabled
                  ? "bg-yellow-500/10 text-yellow-400"
                  : "bg-gray-500/10 text-gray-400"
          }`}
        >
          {!isSupported ? (
            <>
              <AlertCircle className="h-3 w-3" />
              Unsupported
            </>
          ) : isListening ? (
            <>
              <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
              Listening
            </>
          ) : enabled ? (
            <>
              <Loader2 className="h-3 w-3 animate-spin" />
              Starting...
            </>
          ) : (
            "Off"
          )}
        </span>
      </div>

      {!isSupported && (
        <p className="mb-3 text-xs text-gray-400">
          Your browser does not support the Web Speech API. Please use Chrome,
          Edge, or Safari 14.1+ for live transcription.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handleToggle}
          disabled={!isSupported}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
            enabled
              ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
              : "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
          }`}
        >
          {enabled ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          {enabled ? "Stop Transcription" : "Start Transcription"}
        </button>

        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-gray-400" />
          <select
            value={language}
            onChange={handleLanguageChange}
            disabled={!isSupported}
            className="rounded-lg bg-white/10 px-2 py-2 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-40"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-gray-900">
                {lang.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error === "not-allowed"
            ? "Microphone access denied. Please grant permission in your browser settings."
            : `Transcription error: ${error}`}
        </div>
      )}

      {isListening && interimTranscript && (
        <div className="mt-3 rounded-lg bg-black/40 px-3 py-2">
          <p className="text-xs text-gray-500">Live preview:</p>
          <p className="mt-1 text-sm text-gray-200">{interimTranscript}</p>
        </div>
      )}
    </div>
  );
}

export default TranscriptionControls;
