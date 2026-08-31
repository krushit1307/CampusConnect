/**
 * useSpeechRecognition.ts — Real-time speech recognition hook (Issue #3925).
 *
 * Captures audio from a MediaStream (or the default microphone) and
 * transcribes it in real-time using the browser's Web Speech API
 * (SpeechRecognition / webkitSpeechRecognition).
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ── Web Speech API type declarations ─────────────────────────────────────

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResult {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionResultList {
  length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number;
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

// ── Hook types ───────────────────────────────────────────────────────────

export interface SpeechRecognitionOptions {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

export interface SpeechRecognitionState {
  isSupported: boolean;
  isListening: boolean;
  finalTranscript: string;
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  setLang: (lang: string) => void;
}

// ── Hook implementation ──────────────────────────────────────────────────

export function useSpeechRecognition(
  options: SpeechRecognitionOptions = {},
): SpeechRecognitionState {
  const {
    lang: initialLang = "en-US",
    continuous = true,
    interimResults = true,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldListenRef = useRef(false);
  const langRef = useRef(initialLang);

  const isSupported =
    typeof window !== "undefined" &&
    (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));

  useEffect(() => {
    if (!isSupported) return;

    const SpeechRecognitionCtor = (
      (window as unknown as Record<string, SpeechRecognitionConstructor>)
        .SpeechRecognition ||
      (window as unknown as Record<string, SpeechRecognitionConstructor>)
        .webkitSpeechRecognition
    );

    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = langRef.current;
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }

      if (final) {
        setFinalTranscript((prev) => prev + final);
      }
      setInterimTranscript(interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(event.error || "Speech recognition error");
      }
      if (event.error === "not-allowed") {
        shouldListenRef.current = false;
        setIsListening(false);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      setInterimTranscript("");

      if (shouldListenRef.current) {
        try {
          recognition.lang = langRef.current;
          recognition.start();
        } catch {
          // Already started — ignore
        }
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      try {
        recognition.abort();
      } catch {
        // ignore
      }
    };
  }, [isSupported, continuous, interimResults]);

  const start = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError("Speech recognition is not supported in this browser.");
      return;
    }

    shouldListenRef.current = true;
    try {
      recognitionRef.current.lang = langRef.current;
      recognitionRef.current.start();
    } catch {
      // Already started — ignore
    }
  }, [isSupported]);

  const stop = useCallback(() => {
    shouldListenRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const setLang = useCallback((newLang: string) => {
    langRef.current = newLang;
    if (recognitionRef.current) {
      recognitionRef.current.lang = newLang;
    }
  }, []);

  return {
    isSupported,
    isListening,
    finalTranscript,
    interimTranscript,
    error,
    start,
    stop,
    setLang,
  };
}
