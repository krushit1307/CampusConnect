import { useEffect, useRef, useState } from "react";
import { useAudioStore } from "@/store/audioStore";
import { createClient } from "@/lib/supabase/client";
import { Play, Pause, SkipBack, SkipForward, X, Volume2 } from "lucide-react";
import ClosedCaption from "lucide-react/dist/esm/icons/closed-caption";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { CaptionsOverlay } from "@/components/audio/CaptionsOverlay";

export function GlobalAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    playbackRate,
    volume,
    play,
    pause,
    setCurrentTime,
    setDuration,
    closePlayer,
    setPlaybackRate,
    setVolume,
  } = useAudioStore();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);

  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const transcriptSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, []);

  // Sync state to audio element
  useEffect(() => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle MediaSession API
  useEffect(() => {
    if ("mediaSession" in navigator && currentTrack) {
      navigator.mediaSession.setActionHandler("play", play);
      navigator.mediaSession.setActionHandler("pause", pause);
      navigator.mediaSession.setActionHandler("seekbackward", () => {
        if (audioRef.current) audioRef.current.currentTime -= 15;
      });
      navigator.mediaSession.setActionHandler("seekforward", () => {
        if (audioRef.current) audioRef.current.currentTime += 15;
      });
    }
  }, [currentTrack, play, pause]);

  // Analytics tracking every 30 seconds
  useEffect(() => {
    if (!currentTrack || !isPlaying || !session) return;

    const interval = setInterval(async () => {
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-audio-listen`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            eventId: currentTrack.eventId,
            listenedSeconds: 30,
            completed: false,
          }),
        });
      } catch (err) {
        console.error("Failed to track audio listen", err);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [currentTrack, isPlaying, session]);

  if (!currentTrack) return null;

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = async () => {
    pause();
    if (session) {
      // Mark as completed
      try {
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-audio-listen`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            eventId: currentTrack.eventId,
            listenedSeconds: 0,
            completed: true,
          }),
        });
      } catch (err) {
        console.error(err);
      }
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const seek = (value: number[]) => {
    if (audioRef.current) {
      audioRef.current.currentTime = value[0];
      setCurrentTime(value[0]);
    }
  };

  const toggleCaptions = () => {
    const nextState = !captionsEnabled;
    setCaptionsEnabled(nextState);

    if (nextState) {
      startTranscriptRelay();
    } else {
      stopTranscriptRelay();
    }
  };

  const startTranscriptRelay = () => {
    if (!audioRef.current || !currentTrack) return;

    try {
      const audioEl = audioRef.current as any;
      const stream = audioEl.captureStream
        ? audioEl.captureStream()
        : audioEl.mozCaptureStream
          ? audioEl.mozCaptureStream()
          : null;

      if (!stream) {
        console.error("Browser does not support captureStream on audio elements.");
        return;
      }

      const userId = session?.user?.id || "anon";
      const wsUrl = `${import.meta.env.VITE_SUPABASE_URL.replace(/^http/, "ws")}/functions/v1/live-transcript-relay?eventId=${currentTrack.eventId}&userId=${userId}`;
      const ws = new WebSocket(wsUrl, ["bearer", import.meta.env.VITE_SUPABASE_ANON_KEY]);
      transcriptSocketRef.current = ws;

      ws.onopen = () => {
        const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
        mediaRecorderRef.current = mr;
        mr.ondataavailable = (e) => {
          if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            ws.send(e.data);
          }
        };
        mr.start(250);
      };
    } catch (e) {
      console.error("Failed to start podcast transcript relay:", e);
    }
  };

  const stopTranscriptRelay = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
    if (transcriptSocketRef.current) {
      transcriptSocketRef.current.close();
      transcriptSocketRef.current = null;
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-md border-t shadow-lg z-50 p-2 sm:p-4 flex flex-col sm:flex-row items-center gap-4 sm:gap-6 animate-in slide-in-from-bottom-2">
      <audio
        ref={audioRef}
        src={currentTrack.url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {/* Track Info */}
      <div className="flex items-center gap-4 w-full sm:w-1/4">
        {currentTrack.clubLogo ? (
          <img
            src={currentTrack.clubLogo}
            alt="Logo"
            className="w-12 h-12 rounded bg-muted object-cover"
          />
        ) : (
          <div className="w-12 h-12 rounded bg-muted flex items-center justify-center">🎵</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{currentTrack.title}</p>
          <p className="text-xs text-muted-foreground truncate">
            {currentTrack.speaker || currentTrack.clubName}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex-1 flex flex-col items-center w-full max-w-2xl gap-2">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime -= 15;
            }}
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          <Button
            variant="default"
            size="icon"
            className="rounded-full w-10 h-10"
            onClick={isPlaying ? pause : play}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-current" />
            ) : (
              <Play className="w-5 h-5 fill-current ml-1" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime += 15;
            }}
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex items-center gap-3 w-full text-xs text-muted-foreground font-medium">
          <span>{formatTime(currentTime)}</span>
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={1}
            onValueChange={seek}
            className="flex-1"
          />
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Right side controls */}
      <div className="hidden sm:flex items-center justify-end gap-4 w-1/4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCaptions}
          className={captionsEnabled ? "bg-black text-white" : "text-muted-foreground"}
          title={captionsEnabled ? "Disable Captions" : "Enable Captions"}
        >
          <ClosedCaption className="w-5 h-5" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs font-semibold w-12"
          onClick={() => {
            const nextRate =
              playbackRate === 1
                ? 1.25
                : playbackRate === 1.25
                  ? 1.5
                  : playbackRate === 1.5
                    ? 2
                    : 1;
            setPlaybackRate(nextRate);
          }}
        >
          {playbackRate}x
        </Button>
        <div className="flex items-center gap-2 w-24">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <Slider value={[volume]} max={1} step={0.01} onValueChange={(val) => setVolume(val[0])} />
        </div>
        <Button variant="ghost" size="icon" onClick={closePlayer}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      {currentTrack && <CaptionsOverlay eventId={currentTrack.eventId} enabled={captionsEnabled} />}
    </div>
  );
}
