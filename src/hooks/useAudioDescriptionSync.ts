import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

export interface UseAudioDescriptionSyncOptions {
  eventId: string | null;
  enabled: boolean;
  videoElement: HTMLVideoElement | null;
  audioDescriptionUrl: string | null;
}

export function useAudioDescriptionSync(options: UseAudioDescriptionSyncOptions) {
  const { eventId, enabled, videoElement, audioDescriptionUrl } = options;
  const [isSynced, setIsSynced] = useState(false);
  const [ntpOffset, setNtpOffset] = useState<number>(0);

  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // 1. Emulate NTP synchronization using Database Server Time
  useEffect(() => {
    if (!enabled || !eventId) return;

    async function syncClock() {
      try {
        const supabase = createClient();
        const start = performance.now();
        const { data, error } = await supabase.rpc("get_current_db_timestamp");
        const end = performance.now();

        if (error) throw error;

        const rtt = end - start;
        const serverTime = new Date(data).getTime() + rtt / 2;
        const localTime = Date.now();
        const offset = serverTime - localTime;
        setNtpOffset(offset);
      } catch (err) {
        console.error("[useAudioDescriptionSync] NTP clock sync failed:", err);
      }
    }

    syncClock();
  }, [enabled, eventId]);

  // 2. Initialize secondary Audio Element for Descriptions
  useEffect(() => {
    if (!enabled || !audioDescriptionUrl) {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current = null;
      }
      setIsSynced(false);
      return;
    }

    const audio = new Audio(audioDescriptionUrl);
    audio.muted = false;
    audio.playsInline = true;
    audioElementRef.current = audio;

    return () => {
      audio.pause();
      audioElementRef.current = null;
    };
  }, [enabled, audioDescriptionUrl]);

  // 3. NTP-based high-precision playback synchronization loop
  useEffect(() => {
    if (!enabled || !videoElement || !audioElementRef.current) return;

    const video = videoElement;
    const audio = audioElementRef.current;

    const handleSync = () => {
      if (video.paused) {
        audio.pause();
      } else {
        audio.play().catch(() => {});
      }

      // Calculate drift using NTP offset adjustments
      const videoCurrentNtp = Date.now() + ntpOffset - video.playbackRate * 1000;
      const targetTime = video.currentTime;
      const drift = Math.abs(audio.currentTime - targetTime);

      // Adjust if drift exceeds 150ms
      if (drift > 0.15) {
        audio.currentTime = targetTime;
        setIsSynced(false);
      } else {
        setIsSynced(true);
      }
    };

    video.addEventListener("timeupdate", handleSync);
    video.addEventListener("play", handleSync);
    video.addEventListener("pause", handleSync);
    video.addEventListener("seeking", handleSync);

    return () => {
      video.removeEventListener("timeupdate", handleSync);
      video.removeEventListener("play", handleSync);
      video.removeEventListener("pause", handleSync);
      video.removeEventListener("seeking", handleSync);
    };
  }, [enabled, videoElement, ntpOffset]);

  // 4. Capture the secondary audio description track for WebRTC
  const getAudioDescriptionTrack = useCallback((): MediaStreamTrack | null => {
    if (audioElementRef.current) {
      try {
        const audio = audioElementRef.current;
        // @ts-expect-error: captureStream is vendor-specific or not defined in DOM types
        const stream = audio.captureStream
          ? audio.captureStream()
          : audio.mozCaptureStream
            ? audio.mozCaptureStream()
            : null;
        if (stream) {
          return stream.getAudioTracks()[0] || null;
        }
      } catch (e) {
        console.error("[useAudioDescriptionSync] Failed to capture audio track:", e);
      }
    }
    return null;
  }, []);

  return {
    isSynced,
    ntpOffset,
    getAudioDescriptionTrack,
  };
}
