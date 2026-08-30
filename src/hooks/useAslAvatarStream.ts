import { useEffect, useState, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { AslAvatarService } from "@/services/aslAvatarService";

export interface UseAslAvatarStreamOptions {
  eventId: string | null;
  enabled: boolean;
}

export function useAslAvatarStream(options: UseAslAvatarStreamOptions) {
  const { eventId, enabled } = options;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [status, setStatus] = useState<"idle" | "generating" | "playing" | "error">("idle");

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const textQueueRef = useRef<string[]>([]);
  const isProcessingRef = useRef(false);

  // Initialize hidden video element for WebRTC track capturing
  useEffect(() => {
    if (typeof document === "undefined") return;

    let video = document.getElementById("asl-avatar-hidden-player") as HTMLVideoElement;
    if (!video) {
      video = document.createElement("video");
      video.id = "asl-avatar-hidden-player";
      video.style.display = "none";
      video.muted = true;
      video.playsInline = true;
      video.crossOrigin = "anonymous";
      document.body.appendChild(video);
    }
    videoElementRef.current = video;

    return () => {
      // Keep it or clean it up if needed
    };
  }, []);

  const processNextInQueue = useCallback(async () => {
    if (isProcessingRef.current || textQueueRef.current.length === 0) return;
    isProcessingRef.current = true;

    const nextText = textQueueRef.current.shift()!;
    setCurrentText(nextText);
    setStatus("generating");

    const result = await AslAvatarService.generateAslAvatar(nextText);

    if (result.success && videoElementRef.current) {
      setStatus("playing");
      setIsPlaying(true);
      videoElementRef.current.src = result.videoUrl;

      try {
        await videoElementRef.current.play();
        // Wait for video duration or play duration
        await new Promise<void>((resolve) => {
          const video = videoElementRef.current!;
          const onEnded = () => {
            video.removeEventListener("ended", onEnded);
            resolve();
          };
          video.addEventListener("ended", onEnded);
          // Safety timeout
          setTimeout(onEnded, result.durationMs + 1000);
        });
      } catch (err) {
        console.error("[useAslAvatarStream] Playback error:", err);
      }
    } else {
      setStatus("error");
    }

    setIsPlaying(false);
    isProcessingRef.current = false;
    setStatus("idle");
    // Recurse
    processNextInQueue();
  }, []);

  // Listen to the realtime transcript events
  useEffect(() => {
    if (!enabled || !eventId) return;

    const supabase = createClient();
    const channel = supabase
      .channel(`event-captions:${eventId}`)
      .on("broadcast", { event: "transcript" }, (payload: any) => {
        if (payload.payload?.is_final) {
          const text = payload.payload.channel?.alternatives?.[0]?.transcript;
          if (text && text.trim().length > 0) {
            textQueueRef.current.push(text);
            processNextInQueue();
          }
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId, enabled, processNextInQueue]);

  // Extract the video track to pipe into WebRTC
  const getAslVideoTrack = useCallback((): MediaStreamTrack | null => {
    if (videoElementRef.current) {
      try {
        const video = videoElementRef.current;
        // @ts-expect-error: captureStream and mozCaptureStream are vendor-specific or not defined in DOM types
        const stream = video.captureStream
          ? video.captureStream()
          : video.mozCaptureStream
            ? video.mozCaptureStream()
            : null;
        if (stream) {
          return stream.getVideoTracks()[0] || null;
        }
      } catch (e) {
        console.error("[useAslAvatarStream] Failed to capture video track:", e);
      }
    }
    return null;
  }, []);

  return {
    isPlaying,
    currentText,
    status,
    getAslVideoTrack,
    queueLength: textQueueRef.current.length,
  };
}
