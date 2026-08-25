/**
 * useAudioTranscription.ts — Broadcast real-time transcripts via Supabase
 * Realtime (Issue #3925).
 *
 * Bridges the Web Speech API with Supabase Realtime broadcast channels.
 * Only the organizer (broadcaster) runs this hook.
 */

import { useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useSpeechRecognition, type SpeechRecognitionOptions } from "./useSpeechRecognition";

export interface AudioTranscriptionOptions extends SpeechRecognitionOptions {
  eventId: string | null;
  isOrganizer: boolean;
  enabled: boolean;
}

export interface AudioTranscriptionState {
  isSupported: boolean;
  isListening: boolean;
  finalTranscript: string;
  interimTranscript: string;
  error: string | null;
  startTranscription: () => void;
  stopTranscription: () => void;
  setLanguage: (lang: string) => void;
}

export function useAudioTranscription(
  options: AudioTranscriptionOptions,
): AudioTranscriptionState {
  const { eventId, isOrganizer, enabled, ...speechOptions } = options;

  const supabase = createClient();
  const lastBroadcastRef = useRef<string>("");

  const speech = useSpeechRecognition(speechOptions);

  // Broadcast final transcript chunks
  useEffect(() => {
    if (!isOrganizer || !enabled || !eventId || !speech.finalTranscript) return;

    const newText = speech.finalTranscript.slice(lastBroadcastRef.current.length);
    if (!newText.trim()) return;

    lastBroadcastRef.current = speech.finalTranscript;

    const channel = supabase.channel(`event-captions:${eventId}`);
    channel.send({
      type: "broadcast",
      event: "transcript",
      payload: {
        channel: { alternatives: [{ transcript: newText.trim() }] },
        is_final: true,
        timestamp: Date.now(),
      },
    });
  }, [speech.finalTranscript, isOrganizer, enabled, eventId, supabase]);

  // Broadcast interim transcript chunks
  useEffect(() => {
    if (!isOrganizer || !enabled || !eventId || !speech.interimTranscript) return;

    const channel = supabase.channel(`event-captions:${eventId}`);
    channel.send({
      type: "broadcast",
      event: "transcript",
      payload: {
        channel: { alternatives: [{ transcript: speech.interimTranscript.trim() }] },
        is_final: false,
        timestamp: Date.now(),
      },
    });
  }, [speech.interimTranscript, isOrganizer, enabled, eventId, supabase]);

  // Auto-start / auto-stop
  useEffect(() => {
    if (!isOrganizer) return;

    if (enabled && speech.isSupported) {
      speech.start();
    } else {
      speech.stop();
    }

    return () => {
      speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, isOrganizer, speech.isSupported]);

  const startTranscription = useCallback(() => {
    if (!isOrganizer || !speech.isSupported) return;
    speech.start();
  }, [isOrganizer, speech]);

  const stopTranscription = useCallback(() => {
    speech.stop();
  }, [speech]);

  const setLanguage = useCallback(
    (lang: string) => {
      speech.setLang(lang);
    },
    [speech],
  );

  return {
    isSupported: speech.isSupported,
    isListening: speech.isListening,
    finalTranscript: speech.finalTranscript,
    interimTranscript: speech.interimTranscript,
    error: speech.error,
    startTranscription,
    stopTranscription,
    setLanguage,
  };
}
