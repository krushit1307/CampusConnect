import React, { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AnimatePresence, motion } from "framer-motion";
import Type from "lucide-react/dist/esm/icons/type";
import X from "lucide-react/dist/esm/icons/x";

interface TranscriptChunk {
  id: string;
  speaker: number | null;
  text: string;
  isFinal: boolean;
  timestamp: number;
}

interface CaptionsOverlayProps {
  eventId: string;
  enabled: boolean;
}

interface CaptionSettings {
  fontSize: number;
  backgroundOpacity: number;
  position: "bottom" | "top";
  language: string;
}

const DEFAULT_SETTINGS: CaptionSettings = {
  fontSize: 20,
  backgroundOpacity: 0.7,
  position: "bottom",
  language: "en-US",
};

const SUPPORTED_LANGUAGES: Array<{ code: string; label: string }> = [
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

export function CaptionsOverlay({ eventId, enabled }: CaptionsOverlayProps) {
  const [chunks, setChunks] = useState<TranscriptChunk[]>([]);
  const [settings, setSettings] = useState<CaptionSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const supabase = createClient();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = localStorage.getItem("caption-settings");
    if (stored) {
      try {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(stored) });
      } catch {
        // ignore parse errors
      }
    }
  }, []);

  const updateSettings = useCallback((updates: Partial<CaptionSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      localStorage.setItem("caption-settings", JSON.stringify(next));
      return next;
    });
  }, []);

  useEffect(() => {
    if (!enabled) {
      setChunks([]);
      return;
    }

    const channel = supabase.channel(`event-captions:${eventId}`);

    channel
      .on("broadcast", { event: "transcript" }, (payload) => {
        const data = payload.payload;
        if (data && data.channel?.alternatives?.[0]?.transcript) {
          const alt = data.channel.alternatives[0];
          const text = alt.transcript;
          if (text.trim().length === 0) return;

          const isFinal = data.is_final;
          const speaker = alt.words?.[0]?.speaker ?? null;

          setChunks((prev) => {
            const newChunks = [...prev];
            if (newChunks.length > 0 && !newChunks[newChunks.length - 1].isFinal) {
              newChunks[newChunks.length - 1] = {
                ...newChunks[newChunks.length - 1],
                text,
                isFinal,
                speaker,
                timestamp: Date.now(),
              };
            } else {
              newChunks.push({
                id: Math.random().toString(36).substr(2, 9),
                speaker,
                text,
                isFinal,
                timestamp: Date.now(),
              });
            }

            if (newChunks.length > 5) {
              return newChunks.slice(newChunks.length - 5);
            }
            return newChunks;
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, enabled, supabase]);

  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chunks]);

  if (!enabled) return null;

  const positionClass = settings.position === "top" ? "top-20" : "bottom-24";

  return (
    <div
      className={`pointer-events-none absolute ${positionClass} left-0 w-full px-4 sm:px-12 pb-4 flex flex-col justify-end items-center z-50`}
    >
      <div className="w-full max-w-3xl flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className="pointer-events-auto self-end mb-1 rounded-full bg-black/60 p-2 text-white backdrop-blur-sm transition hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Toggle caption settings"
        >
          <Type className="w-4 h-4" />
        </button>

        <AnimatePresence>
          {showSettings && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.2 }}
              className="pointer-events-auto mb-2 w-full rounded-xl bg-black/80 p-4 backdrop-blur-md"
            >
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Caption Settings</h3>
                <button
                  type="button"
                  onClick={() => setShowSettings(false)}
                  className="rounded p-1 text-gray-400 hover:text-white"
                  aria-label="Close settings"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs text-gray-300">
                  Font Size: {settings.fontSize}px
                </label>
                <input
                  type="range"
                  min={14}
                  max={32}
                  value={settings.fontSize}
                  onChange={(e) => updateSettings({ fontSize: Number(e.target.value) })}
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs text-gray-300">
                  Background Opacity: {Math.round(settings.backgroundOpacity * 100)}%
                </label>
                <input
                  type="range"
                  min={0.3}
                  max={1}
                  step={0.1}
                  value={settings.backgroundOpacity}
                  onChange={(e) =>
                    updateSettings({ backgroundOpacity: Number(e.target.value) })
                  }
                  className="w-full accent-indigo-500"
                />
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-xs text-gray-300">Position</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => updateSettings({ position: "bottom" })}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                      settings.position === "bottom"
                        ? "bg-indigo-600 text-white"
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    }`}
                  >
                    Bottom
                  </button>
                  <button
                    type="button"
                    onClick={() => updateSettings({ position: "top" })}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition ${
                      settings.position === "top"
                        ? "bg-indigo-600 text-white"
                        : "bg-white/10 text-gray-300 hover:bg-white/20"
                    }`}
                  >
                    Top
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs text-gray-300">Language</label>
                <select
                  value={settings.language}
                  onChange={(e) => updateSettings({ language: e.target.value })}
                  className="w-full rounded-lg bg-white/10 px-2 py-1 text-xs text-white outline-none focus:ring-2 focus:ring-indigo-400"
                >
                  {SUPPORTED_LANGUAGES.map((lang) => (
                    <option key={lang.code} value={lang.code} className="bg-gray-900">
                      {lang.label}
                    </option>
                  ))}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {chunks.map((chunk, idx) => {
            const distanceFromEnd = chunks.length - 1 - idx;
            const opacity = Math.max(0.2, 1 - distanceFromEnd * 0.25);

            return (
              <motion.div
                key={chunk.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="w-full text-center"
              >
                <span
                  className="inline-block rounded px-3 py-1 font-medium shadow-lg backdrop-blur-md"
                  style={{
                    fontSize: `${settings.fontSize}px`,
                    backgroundColor: `rgba(0, 0, 0, ${settings.backgroundOpacity})`,
                    color: chunk.isFinal ? "#ffffff" : "#d1d5db",
                    textShadow: "0px 1px 2px rgba(0,0,0,0.8)",
                  }}
                >
                  {chunk.speaker !== null && (
                    <span className="mr-2 font-bold text-yellow-400">
                      [Speaker {chunk.speaker}]
                    </span>
                  )}
                  {chunk.text}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
