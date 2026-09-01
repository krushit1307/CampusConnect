"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  FireAlarmDetector,
  FFT_SIZE,
  SAMPLE_RATE,
  buildEvacuationPayload,
} from "@/lib/audio/fireAlarmFingerprint";
import { fireEvacuationWithRetry } from "@/lib/turnstile/turnstileControl";

export type FireAlarmMonitorStatus =
  "idle" | "listening" | "detecting" | "evacuating" | "error" | "unsupported";

export type UseFireAlarmMonitorOptions = {
  eventId: string;
  bouncerId: string | null;
  venueId?: string | null;
  enabled?: boolean; // default true when bouncer page mounted
  onEvacuationTriggered?: (payload: {
    detectionDurationSeconds: number;
    peakFreqHz: number | null;
  }) => void;
};

/**
 * Highly optimized background audio thread for Bouncer iPad.
 * - Requests microphone (single channel, 48kHz, echoCancellation off for fingerprint fidelity)
 * - Creates AudioContext + MediaStreamSource + AnalyserNode (FFT_SIZE 2048)
 * - Runs rAF loop: getByteFrequencyData → FireAlarmDetector.ingest() → if triggered, fires EMERGENCY_EVACUATION payload
 * - Drops magnetic locks via backend RPC; no badge-out required after.
 * Respects bouncer lifecycle: stops on unmount, handles permission denied gracefully.
 */
export function useFireAlarmMonitor(opts: UseFireAlarmMonitorOptions) {
  const { eventId, bouncerId, venueId, enabled = true, onEvacuationTriggered } = opts;
  const [status, setStatus] = useState<FireAlarmMonitorStatus>("idle");
  const [isSupported, setIsSupported] = useState(true);
  const [lastPeakHz, setLastPeakHz] = useState<number | null>(null);
  const detectorRef = useRef<FireAlarmDetector | null>(null);
  const rafRef = useRef<number | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const triggeredRef = useRef(false);

  const stop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    } catch (_e) {
      // ignore cleanup errors
    }
    streamRef.current = null;
    try {
      void ctxRef.current?.close();
    } catch (_e) {
      // ignore cleanup errors
    }
    ctxRef.current = null;
    detectorRef.current?.reset();
    setStatus("idle");
  }, []);

  useEffect(() => {
    if (!enabled || !eventId || !bouncerId) {
      setStatus("idle");
      return;
    }

    const supported =
      typeof window !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia &&
      (window.AudioContext != null ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext !=
          null);
    if (!supported) {
      setIsSupported(false);
      setStatus("unsupported");
      return;
    }

    let cancelled = false;
    detectorRef.current = new FireAlarmDetector({ cooldownMs: 30_000 });

    async function start() {
      try {
        setStatus("listening");
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            sampleRate: SAMPLE_RATE,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctor({ sampleRate: SAMPLE_RATE, latencyHint: "interactive" });
        ctxRef.current = ctx;

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        analyser.smoothingTimeConstant = 0.15;
        source.connect(analyser);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        // Convert Uint8 (0-255) to linear magnitude 0..1 for detector
        const mags = new Float32Array(analyser.frequencyBinCount);

        const loop = () => {
          if (cancelled || !detectorRef.current) return;
          analyser.getByteFrequencyData(freqData);
          for (let i = 0; i < freqData.length; i++) mags[i] = freqData[i] / 255;

          const now = Date.now();
          const { present, triggered, detection } = detectorRef.current.ingest(
            mags,
            ctx.sampleRate,
            analyser.fftSize,
            now,
          );
          if (present) {
            setLastPeakHz(detection.peakFreqHz);
            setStatus("detecting");
          }

          if (triggered && !triggeredRef.current) {
            triggeredRef.current = true;
            setStatus("evacuating");
            const payload = buildEvacuationPayload({
              eventId,
              bouncerId: bouncerId!,
              detectionDurationSeconds: 5.5,
              peakFreqHz: detection.peakFreqHz,
              venueId: venueId ?? null,
            });
            // High-priority fire-and-forget, non-blocking for audio thread
            void fireEvacuationWithRetry(payload).then((res) => {
              if (!res.success) {
                // Retry once already inside helper; if still fails, surface error but keep listening
                setStatus("error");
                triggeredRef.current = false; // allow retry after failure
              } else {
                onEvacuationTriggered?.({
                  detectionDurationSeconds: payload.detectionDurationSeconds,
                  peakFreqHz: detection.peakFreqHz,
                });
                // Stay in evacuating state; backend has dropped locks. Reset detector after cooldown.
                setTimeout(() => {
                  triggeredRef.current = false;
                  detectorRef.current?.reset();
                }, 30_000);
              }
            });
          }

          rafRef.current = requestAnimationFrame(loop);
        };
        rafRef.current = requestAnimationFrame(loop);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Permission denied, NotAllowedError etc -> unsupported / error
        if (msg.toLowerCase().includes("permission") || msg.toLowerCase().includes("notallowed")) {
          setStatus("error");
        } else {
          setStatus("error");
        }
      }
    }

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [enabled, eventId, bouncerId, venueId, onEvacuationTriggered, stop]);

  return { status, isSupported, lastPeakHz, stop } as const;
}
