/**
 * useAudioTranscription.ts — Broadcast real-time transcripts via Supabase
 * Realtime and Deepgram (Issue #4505).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface AudioTranscriptionOptions {
  eventId: string | null;
  isOrganizer: boolean;
  enabled: boolean;
  lang?: string;
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
  const { eventId, isOrganizer, enabled, lang } = options;

  const [supabase] = useState(() => createClient());
  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopTranscription = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    streamRef.current = null;
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    wsRef.current = null;
    
    setIsListening(false);
  }, []);

  const startTranscription = useCallback(async () => {
    if (!isOrganizer || !eventId) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id || "anonymous";

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const baseUrl = import.meta.env.VITE_SUPABASE_URL || "";
      const wsUrl = `${baseUrl.replace(/^http/, "ws")}/functions/v1/live-transcript-relay?eventId=${eventId}&userId=${userId}`;
      const ws = new WebSocket(wsUrl, ["bearer", import.meta.env.VITE_SUPABASE_ANON_KEY || ""]);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsListening(true);
        setError(null);
        
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.addEventListener("dataavailable", (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(event.data);
          }
        });

        mediaRecorder.start(250);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.channel?.alternatives?.[0]) {
            const alt = data.channel.alternatives[0];
            const transcript = alt.transcript;

            if (transcript) {
              if (data.is_final) {
                setFinalTranscript((prev) => prev + (prev ? " " : "") + transcript);
                setInterimTranscript("");

                // Broadcast final to viewers via dedicated data channel
                const channel = supabase.channel(`event-captions:${eventId}`);
                channel.send({
                  type: "broadcast",
                  event: "transcript",
                  payload: {
                    channel: { alternatives: [{ transcript, words: alt.words }] },
                    is_final: true,
                    timestamp: Date.now(),
                  },
                });
              } else {
                setInterimTranscript(transcript);

                // Broadcast interim
                const channel = supabase.channel(`event-captions:${eventId}`);
                channel.send({
                  type: "broadcast",
                  event: "transcript",
                  payload: {
                    channel: { alternatives: [{ transcript, words: alt.words }] },
                    is_final: false,
                    timestamp: Date.now(),
                  },
                });
              }
            }
          }
        } catch (err) {
          // Ignore non-JSON Deepgram messages or parse errors
        }
      };

      ws.onerror = (e) => {
        console.error("Deepgram WebSocket error", e);
        setError("WebSocket connection failed");
        stopTranscription();
      };

      ws.onclose = () => {
        stopTranscription();
      };
    } catch (err: any) {
      console.error("Transcription error:", err);
      setError(err.message || "Failed to start transcription");
      setIsListening(false);
    }
  }, [eventId, isOrganizer, supabase, stopTranscription]);

  useEffect(() => {
    if (enabled && !isListening) {
      startTranscription();
    } else if (!enabled && isListening) {
      stopTranscription();
    }
  }, [enabled, isListening, startTranscription, stopTranscription]);

  useEffect(() => {
    return () => {
      stopTranscription();
    };
  }, [stopTranscription]);

  const setLanguage = useCallback((_lang: string) => {
    // Language handled via Deepgram URL query params if needed
  }, []);

  return {
    isSupported: typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia,
    isListening,
    finalTranscript,
    interimTranscript,
    error,
    startTranscription,
    stopTranscription,
    setLanguage,
  };
}
