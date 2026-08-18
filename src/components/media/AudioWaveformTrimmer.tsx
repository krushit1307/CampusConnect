import { useCallback, useEffect, useRef, useState } from "react";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Pause from "lucide-react/dist/esm/icons/pause";
import Play from "lucide-react/dist/esm/icons/play";
import Trash2 from "lucide-react/dist/esm/icons/trash-2";
import Upload from "lucide-react/dist/esm/icons/upload";
import AlertTriangle from "lucide-react/dist/esm/icons/alert-triangle";
import { cn } from "@/lib/utils";
import { clamp, formatTime } from "@/lib/audio/waveform";
import { computeWaveformPeaks } from "@/lib/audio/waveformLoader";

export interface AudioTrimSelection {
  file: File;
  trimStartTime: number;
  trimEndTime: number;
  duration: number;
}

export interface AudioWaveformTrimmerProps {
  /** Controlled file. Omit to let the component manage its own file picker. */
  file?: File | null;
  onFileChange?: (file: File | null) => void;
  onTrimChange?: (selection: AudioTrimSelection) => void;
  /** Exposes the internal <audio> element so a parent can wire an analyser. */
  onAudioElementMount?: (element: HTMLAudioElement | null) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  maxDurationSeconds?: number;
  accept?: string;
  className?: string;
  bucketCount?: number;
  minTrimGapSeconds?: number;
  waveformHeight?: number;
}

const IN_REGION_COLOR = "#acc412";
const OUT_OF_REGION_COLOR = "#d8d4c4";
const PLAYHEAD_COLOR = "#0a0a0a";

/**
 * Multi-thumb audio waveform trimmer (#2399).
 *
 * Decodes an uploaded audio file with the Web Audio API (peaks computed in a
 * Web Worker), renders a SoundCloud-style waveform on a canvas, and lets the
 * user drag two thumbs to trim the start/end of the clip. Playback is
 * restricted to the region between the thumbs.
 */
export function AudioWaveformTrimmer({
  file,
  onFileChange,
  onTrimChange,
  onAudioElementMount,
  onPlaybackStateChange,
  maxDurationSeconds = 120,
  accept = "audio/*",
  className,
  bucketCount = 1000,
  minTrimGapSeconds = 0.1,
  waveformHeight = 96,
}: AudioWaveformTrimmerProps) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragThumb, setDragThumb] = useState<"start" | "end" | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileRef = useRef<File | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const lastHandledFile = useRef<File | null | undefined>(undefined);
  const movedWhileDragging = useRef(false);
  const trimRef = useRef({ start: 0, end: 0 });
  const durationRef = useRef(0);

  const notifyPlayback = useCallback(
    (playing: boolean) => {
      setIsPlaying(playing);
      onPlaybackStateChange?.(playing);
    },
    [onPlaybackStateChange],
  );

  const resetAll = useCallback(() => {
    fileRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    setPeaks([]);
    setDuration(0);
    setTrimStart(0);
    setTrimEnd(0);
    setCurrentTime(0);
    setFileName(null);
    setError(null);
    notifyPlayback(false);
    trimRef.current = { start: 0, end: 0 };
    durationRef.current = 0;
  }, [notifyPlayback]);

  const handleFile = useCallback(
    async (selected: File | null) => {
      if (!selected) {
        resetAll();
        onFileChange?.(null);
        return;
      }

      if (!selected.type.startsWith("audio/")) {
        setError("Please select an audio file (MP3, WAV, M4A, OGG, …).");
        return;
      }

      fileRef.current = selected;
      onFileChange?.(selected);
      setFileName(selected.name);
      setError(null);
      setIsLoading(true);
      notifyPlayback(false);

      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      const url = URL.createObjectURL(selected);
      objectUrlRef.current = url;

      try {
        const { peaks: computedPeaks, duration: audioDuration } = await computeWaveformPeaks(
          selected,
          bucketCount,
        );

        setPeaks(computedPeaks);
        setDuration(audioDuration);
        durationRef.current = audioDuration;
        setTrimStart(0);
        setTrimEnd(audioDuration);
        trimRef.current = { start: 0, end: audioDuration };
        setCurrentTime(0);

        if (audioDuration > maxDurationSeconds) {
          setError(
            `This clip is ${formatTime(audioDuration)} long. The recommended maximum for trimming is ${formatTime(maxDurationSeconds)}.`,
          );
        }
      } catch (err) {
        console.error("[AudioWaveformTrimmer] Failed to decode audio:", err);
        setError("Could not read this audio file. Try converting it to MP3 or WAV.");
      } finally {
        setIsLoading(false);
      }
    },
    [bucketCount, maxDurationSeconds, notifyPlayback, onFileChange, resetAll],
  );

  // Controlled mode: react to the `file` prop when provided.
  useEffect(() => {
    if (file === undefined) return;
    if (lastHandledFile.current === file) return;
    lastHandledFile.current = file;
    if (file) {
      void handleFile(file);
    } else {
      resetAll();
    }
  }, [file, handleFile, resetAll]);

  // Cleanup on unmount.
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = null;
      }
      onAudioElementMount?.(null);
    };
  }, [onAudioElementMount]);

  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    canvas.width = Math.max(1, Math.floor(width * dpr));
    canvas.height = Math.max(1, Math.floor(height * dpr));
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const midY = height / 2;
    const barWidth = 2;
    const gap = 1;
    const barCount = peaks.length > 0 ? Math.max(1, Math.floor(width / (barWidth + gap))) : 0;

    for (let i = 0; i < barCount; i++) {
      const peakIndex = Math.min(peaks.length - 1, Math.floor((i / barCount) * peaks.length));
      const amplitude = peaks[peakIndex] ?? 0;
      const barHeight = Math.max(1, amplitude * (height - 6));

      const barStart = (i / Math.max(1, barCount)) * duration;
      const inRegion = barStart >= trimStart && barStart <= trimEnd;
      ctx.fillStyle = inRegion ? IN_REGION_COLOR : OUT_OF_REGION_COLOR;
      ctx.fillRect(i * (barWidth + gap), midY - barHeight / 2, barWidth, barHeight);
    }

    if (duration > 0) {
      const playheadX = (currentTime / duration) * width;
      ctx.fillStyle = PLAYHEAD_COLOR;
      ctx.fillRect(playheadX, 0, 1, height);
    }
  }, [peaks, trimStart, trimEnd, currentTime, duration]);

  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Redraw when the container is resized.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(() => drawWaveform());
    observer.observe(container);
    return () => observer.disconnect();
  }, [drawWaveform]);

  // Notify parent of the current trim selection.
  useEffect(() => {
    if (!fileRef.current || duration <= 0) return;
    onTrimChange?.({
      file: fileRef.current,
      trimStartTime: trimStart,
      trimEndTime: trimEnd,
      duration,
    });
  }, [trimStart, trimEnd, duration, onTrimChange]);

  const timeFromPointer = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return 0;
    const rect = container.getBoundingClientRect();
    const ratio = clamp((clientX - rect.left) / rect.width, 0, 1);
    return ratio * durationRef.current;
  }, []);

  const handleThumbPointerDown =
    (thumb: "start" | "end") => (event: React.PointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      movedWhileDragging.current = false;
      setDragThumb(thumb);
    };

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragThumb) return;
      movedWhileDragging.current = true;
      const time = timeFromPointer(event.clientX);

      if (dragThumb === "start") {
        const nextStart = clamp(time, 0, trimRef.current.end - minTrimGapSeconds);
        setTrimStart(nextStart);
        trimRef.current.start = nextStart;
      } else {
        const nextEnd = clamp(time, trimRef.current.start + minTrimGapSeconds, durationRef.current);
        setTrimEnd(nextEnd);
        trimRef.current.end = nextEnd;
      }
    },
    [dragThumb, minTrimGapSeconds, timeFromPointer],
  );

  const handlePointerUp = useCallback(() => {
    setDragThumb(null);
    movedWhileDragging.current = false;
  }, []);

  useEffect(() => {
    if (!dragThumb) return;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragThumb, handlePointerMove, handlePointerUp]);

  const handleWaveformClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (movedWhileDragging.current || dragThumb) return;
      const audio = audioRef.current;
      const target = clamp(
        timeFromPointer(event.clientX),
        trimRef.current.start,
        trimRef.current.end,
      );
      if (audio) {
        audio.currentTime = target;
      }
      setCurrentTime(target);
    },
    [dragThumb, timeFromPointer],
  );

  const handleThumbKeyDown =
    (thumb: "start" | "end") => (event: React.KeyboardEvent<HTMLDivElement>) => {
      const step = event.shiftKey ? 1 : 0.1;
      if (thumb === "start") {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          const next = clamp(
            trimRef.current.start + step,
            0,
            trimRef.current.end - minTrimGapSeconds,
          );
          setTrimStart(next);
          trimRef.current.start = next;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          const next = clamp(
            trimRef.current.start - step,
            0,
            trimRef.current.end - minTrimGapSeconds,
          );
          setTrimStart(next);
          trimRef.current.start = next;
        } else {
          return;
        }
      } else {
        if (event.key === "ArrowRight" || event.key === "ArrowUp") {
          const next = clamp(
            trimRef.current.end + step,
            trimRef.current.start + minTrimGapSeconds,
            durationRef.current,
          );
          setTrimEnd(next);
          trimRef.current.end = next;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
          const next = clamp(
            trimRef.current.end - step,
            trimRef.current.start + minTrimGapSeconds,
            durationRef.current,
          );
          setTrimEnd(next);
          trimRef.current.end = next;
        } else {
          return;
        }
      }
      event.preventDefault();
    };

  const togglePlayback = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || !objectUrlRef.current) return;

    if (audio.paused) {
      if (audio.currentTime < trimRef.current.start || audio.currentTime > trimRef.current.end) {
        audio.currentTime = trimRef.current.start;
        setCurrentTime(trimRef.current.start);
      }
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);

    if (audio.currentTime >= trimRef.current.end) {
      audio.pause();
      audio.currentTime = trimRef.current.start;
      setCurrentTime(trimRef.current.start);
      notifyPlayback(false);
    }
  }, [notifyPlayback]);

  const handleAudioRef = useCallback(
    (element: HTMLAudioElement | null) => {
      audioRef.current = element;
      onAudioElementMount?.(element);
    },
    [onAudioElementMount],
  );

  const startPct = duration > 0 ? (trimStart / duration) * 100 : 0;
  const endPct = duration > 0 ? (trimEnd / duration) * 100 : 100;
  const playheadPct = duration > 0 ? clamp((currentTime / duration) * 100, 0, 100) : 0;

  return (
    <div className={cn("rounded-xl border-2 border-black bg-cream p-3", className)}>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={(event) => {
          void handleFile(event.target.files?.[0] ?? null);
          event.target.value = "";
        }}
        className="hidden"
        data-testid="audio-waveform-file-input"
      />

      {!fileName && !isLoading ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="neu-border neu-press flex w-full items-center justify-center gap-2 border-2 border-black bg-black px-4 py-3 font-mono text-xs font-bold uppercase text-cream"
          data-testid="audio-waveform-picker"
        >
          <Upload className="h-4 w-4" />
          Upload audio to preview &amp; trim
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          {/* File header */}
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[11px] font-bold uppercase text-black">
              {fileName}
            </span>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="border-2 border-black px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-black hover:bg-lime"
              >
                Change
              </button>
              <button
                type="button"
                aria-label="Remove audio"
                onClick={() => {
                  resetAll();
                  onFileChange?.(null);
                }}
                className="border-2 border-black p-1 text-black hover:bg-peach"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Waveform + thumbs */}
          <div
            ref={containerRef}
            data-testid="audio-waveform"
            className="relative w-full cursor-pointer overflow-hidden rounded-lg border-2 border-black bg-white"
            style={{ height: waveformHeight }}
            onClick={handleWaveformClick}
          >
            <canvas ref={canvasRef} className="absolute inset-0" />

            {isLoading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-cream/80">
                <Loader2 className="h-5 w-5 animate-spin text-black" />
                <span className="ml-2 font-mono text-[11px] font-bold uppercase text-black">
                  Analyzing audio…
                </span>
              </div>
            )}

            {!isLoading && duration > 0 && (
              <>
                {/* Playhead */}
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-black"
                  style={{ left: `${playheadPct}%` }}
                  data-testid="audio-waveform-playhead"
                />

                {/* Start trim thumb */}
                <div
                  role="slider"
                  aria-label="Start trim"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(0, Math.round(trimEnd * 10) / 10)}
                  aria-valuenow={Math.round(trimStart * 10) / 10}
                  aria-valuetext={`${formatTime(trimStart)}`}
                  tabIndex={0}
                  onPointerDown={handleThumbPointerDown("start")}
                  onKeyDown={handleThumbKeyDown("start")}
                  data-testid="trim-start-thumb"
                  className="absolute top-0 bottom-0 z-20 w-3 cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-black"
                  style={{ left: `calc(${startPct}% - 6px)` }}
                >
                  <div className="h-full w-1 border-x-2 border-black bg-lime" />
                </div>

                {/* End trim thumb */}
                <div
                  role="slider"
                  aria-label="End trim"
                  aria-valuemin={Math.round(trimStart * 10) / 10}
                  aria-valuemax={Math.round(duration * 10) / 10}
                  aria-valuenow={Math.round(trimEnd * 10) / 10}
                  aria-valuetext={`${formatTime(trimEnd)}`}
                  tabIndex={0}
                  onPointerDown={handleThumbPointerDown("end")}
                  onKeyDown={handleThumbKeyDown("end")}
                  data-testid="trim-end-thumb"
                  className="absolute top-0 bottom-0 z-20 w-3 cursor-ew-resize touch-none outline-none focus-visible:ring-2 focus-visible:ring-black"
                  style={{ left: `calc(${endPct}% - 6px)` }}
                >
                  <div className="h-full w-1 border-x-2 border-black bg-lime" />
                </div>
              </>
            )}
          </div>

          {/* Time labels */}
          {!isLoading && duration > 0 && (
            <div className="flex items-center justify-between font-mono text-[10px] font-bold uppercase text-black">
              <span data-testid="trim-range-label">
                Trim {formatTime(trimStart)} – {formatTime(trimEnd)}
              </span>
              <span>Duration {formatTime(duration)}</span>
            </div>
          )}

          {/* Transport */}
          {!isLoading && duration > 0 && (
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={togglePlayback}
                data-testid="waveform-play-button"
                className="neu-border neu-press flex items-center gap-1.5 border-2 border-black bg-lime px-3 py-1.5 font-mono text-xs font-bold uppercase text-black"
              >
                {isPlaying ? (
                  <>
                    <Pause className="h-3.5 w-3.5" /> Pause
                  </>
                ) : (
                  <>
                    <Play className="h-3.5 w-3.5" /> Play region
                  </>
                )}
              </button>
              <span className="font-mono text-[11px] font-bold text-black">
                {formatTime(currentTime)}
              </span>
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          className="mt-2 flex items-start gap-2 rounded-lg border-2 border-peach bg-peach/10 p-2 font-mono text-[11px] font-bold text-black"
          role="alert"
          data-testid="audio-waveform-error"
        >
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <audio
        ref={handleAudioRef}
        src={objectUrlRef.current ?? undefined}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => notifyPlayback(false)}
        onPlay={() => notifyPlayback(true)}
        onPause={() => notifyPlayback(false)}
        className="hidden"
        data-testid="audio-waveform-audio"
      />
    </div>
  );
}
