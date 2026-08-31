import React, { useRef, useState, useEffect, useCallback } from "react";
import * as Slider from "@radix-ui/react-slider";
import Play from "lucide-react/dist/esm/icons/play";
import Pause from "lucide-react/dist/esm/icons/pause";
import Volume2 from "lucide-react/dist/esm/icons/volume-2";
import VolumeX from "lucide-react/dist/esm/icons/volume-x";
import Maximize from "lucide-react/dist/esm/icons/maximize";
import Minimize from "lucide-react/dist/esm/icons/minimize";
import PictureInPicture2 from "lucide-react/dist/esm/icons/picture-in-picture-2";
import Languages from "lucide-react/dist/esm/icons/languages";
import BookOpen from "lucide-react/dist/esm/icons/book-open";

export interface SubtitleTrack {
  src: string;
  srclang: string;
  label: string;
  default?: boolean;
}

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
  subtitleTracks?: SubtitleTrack[];
}

// Strip any VTT markup tags (<i>, <b>, <c>, <v>, etc.) that may already be
// present in cue text before we run our own bold-fixation transform on it.
// Only strips WebVTT's own markup tags (voice, class, ruby, italics, bold,
// underline, and their timestamp/annotation variants) — not arbitrary
// angle-bracket text a caption might legitimately contain, e.g. "x < y > z".
const stripVttTags = (text: string): string =>
  text.replace(/<\/?(?:c|i|b|u|ruby|rt|v|lang)(?:[.\w-]*)?(?:\s[^>]*)?>/gi, "");

// Applies a "Bionic Reading" style bold-fixation to a single word: the first
// portion of the word's letters are bolded so the eye can anchor on them and
// let the brain complete the rest, which helps some dyslexic readers keep
// pace with fast-moving text. Leading/trailing punctuation is preserved
// outside the bold span so things like quotes and commas render normally.
const bionicWord = (word: string): string => {
  // \p{L} (letters) and \p{N} (numbers) cover non-ASCII scripts (Cyrillic,
  // Arabic, CJK, accented Latin, etc.), not just [a-zA-Z0-9].
  const match = word.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}]+)([^\p{L}\p{N}]*)$/u);
  if (!match) return word;
  const [, prefix, core, suffix] = match;
  // Use Unicode-aware grapheme count so combining accents don't distort the
  // bold cut point.
  const coreChars = Array.from(core);
  if (coreChars.length <= 1) return `${prefix}${core}${suffix}`;

  const boldLength = Math.max(1, Math.ceil(coreChars.length * 0.45));
  const boldPart = coreChars.slice(0, boldLength).join("");
  const restPart = coreChars.slice(boldLength).join("");
  return `${prefix}<strong>${boldPart}</strong>${restPart}${suffix}`;
};

// Transforms a full line of subtitle text into bionic-reading-formatted HTML.
const bionicText = (text: string): string =>
  stripVttTags(text)
    .split(" ")
    .map((word) => (word ? bionicWord(word) : word))
    .join(" ");

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  src,
  poster,
  title,
  subtitleTracks = [],
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // State management
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isPictureInPicture, setIsPictureInPicture] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(true);
  const [selectedTrack, setSelectedTrack] = useState<string>("off");
  const [showCcMenu, setShowCcMenu] = useState<boolean>(false);
  const [bionicReadingEnabled, setBionicReadingEnabled] = useState<boolean>(false);
  const [activeCueText, setActiveCueText] = useState<string>("");

  const isPictureInPictureSupported =
    typeof document !== "undefined" &&
    "pictureInPictureEnabled" in document &&
    document.pictureInPictureEnabled;

  // Toggle Play / Pause
  const togglePlay = useCallback(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
  }, [isPlaying]);

  // Toggle Mute
  const toggleMute = () => {
    if (!videoRef.current) return;
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    videoRef.current.muted = newMuteState;
  };

  // Volume Change
  const handleVolumeChange = (value: number[]) => {
    if (!videoRef.current) return;
    const newVolume = value[0];
    setVolume(newVolume);
    videoRef.current.volume = newVolume;
    if (newVolume === 0) {
      setIsMuted(true);
      videoRef.current.muted = true;
    } else if (isMuted) {
      setIsMuted(false);
      videoRef.current.muted = false;
    }
  };

  // Timeline Scrubber Seeking
  const handleSeek = (value: number[]) => {
    if (!videoRef.current) return;
    const newTime = value[0];
    videoRef.current.currentTime = newTime;
    setProgress(newTime);
  };

  // Skip Forward/Backward (5s) for Keyboard Shortcuts
  const handleSeekBy = useCallback(
    (seconds: number) => {
      if (!videoRef.current) return;
      const newTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration);
      videoRef.current.currentTime = newTime;
      setProgress(newTime);
    },
    [duration],
  );

  // Fullscreen Toggle using standard Fullscreen API
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current
        .requestFullscreen()
        .then(() => setIsFullscreen(true))
        .catch(console.error);
    } else {
      document
        .exitFullscreen()
        .then(() => setIsFullscreen(false))
        .catch(console.error);
    }
  };

  // Picture-in-Picture Toggle using native browser API
  const togglePictureInPicture = useCallback(async () => {
    if (!videoRef.current || !isPictureInPictureSupported) return;

    try {
      if (document.pictureInPictureElement === videoRef.current) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (error) {
      console.error("Picture-in-Picture failed:", error);
    }
  }, [isPictureInPictureSupported]);

  // Time Formatter Utility
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
  };

  // Keyboard Navigation: Space (Play/Pause), Left/Right Arrows (Seeking)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.code === "ArrowLeft") {
        e.preventDefault();
        handleSeekBy(-5);
      } else if (e.code === "ArrowRight") {
        e.preventDefault();
        handleSeekBy(5);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, handleSeekBy]);

  // Keep isFullscreen state in sync with the browser. Users can exit fullscreen
  // via the physical ESC key, which bypasses the React onClick logic entirely.
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  // Keep isPictureInPicture state in sync with the native PiP window.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPictureInPicture = () => setIsPictureInPicture(true);
    const handleLeavePictureInPicture = () => setIsPictureInPicture(false);

    video.addEventListener("enterpictureinpicture", handleEnterPictureInPicture);
    video.addEventListener("leavepictureinpicture", handleLeavePictureInPicture);
    return () => {
      video.removeEventListener("enterpictureinpicture", handleEnterPictureInPicture);
      video.removeEventListener("leavepictureinpicture", handleLeavePictureInPicture);
    };
  }, []);

  // Bionic Reading subtitle sync: when enabled, take the active track out of
  // native "showing" mode (browser-rendered captions can't contain custom
  // markup) and instead listen for cuechange to render our own bold-fixated
  // overlay. When disabled, hand rendering back to the native track.
  useEffect(() => {
    const video = videoRef.current;
    if (!video || selectedTrack === "off") {
      setActiveCueText("");
      return;
    }

    let activeTrack: TextTrack | null = null;
    for (let i = 0; i < video.textTracks.length; i++) {
      if (video.textTracks[i].language === selectedTrack) {
        activeTrack = video.textTracks[i];
        break;
      }
    }
    if (!activeTrack) {
      setActiveCueText("");
      return;
    }

    if (!bionicReadingEnabled) {
      activeTrack.mode = "showing";
      setActiveCueText("");
      return;
    }

    // Hide native rendering; we'll draw the cues ourselves.
    activeTrack.mode = "hidden";

    const handleCueChange = () => {
      const activeCues = activeTrack!.activeCues;
      if (activeCues && activeCues.length > 0) {
        const cueTexts = Array.from(activeCues)
          .map((cue) => (cue as VTTCue).text ?? "")
          .join("\n");
        setActiveCueText(cueTexts);
      } else {
        setActiveCueText("");
      }
    };

    activeTrack.addEventListener("cuechange", handleCueChange);
    handleCueChange();

    return () => {
      activeTrack?.removeEventListener("cuechange", handleCueChange);
    };
  }, [selectedTrack, bionicReadingEnabled]);

  return (
    <div
      ref={containerRef}
      className="relative group w-full max-w-4xl mx-auto rounded-xl overflow-hidden bg-black shadow-2xl select-none"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Title Overlay */}
      {title && (
        <div
          className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
            showControls || !isPlaying ? "opacity-100" : "opacity-0"
          }`}
        >
          <h2 className="text-sm font-semibold text-white truncate">{title}</h2>
        </div>
      )}

      {/* Video Element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls={false}
        playsInline
        className="w-full h-auto cursor-pointer object-cover"
        onClick={togglePlay}
        onTimeUpdate={() => videoRef.current && setProgress(videoRef.current.currentTime)}
        onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
      >
        {subtitleTracks.map((track) => (
          <track
            key={track.srclang}
            src={track.src}
            kind="subtitles"
            srcLang={track.srclang}
            label={track.label}
            default={track.default}
          />
        ))}
      </video>

      {/* Center Play Overlay */}
      <div
        data-testid="video-center-play-overlay"
        className={`absolute inset-0 z-10 flex items-center justify-center transition-opacity duration-300 ${
          isPlaying ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
      >
        <button
          type="button"
          onClick={togglePlay}
          aria-label="Play video"
          className="group/center-play rounded-full bg-black/50 p-4 sm:p-6 backdrop-blur-sm transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/70"
        >
          <Play className="w-12 h-12 sm:w-16 sm:h-16 text-white fill-current drop-shadow-lg" />
        </button>
      </div>

      {/* Bionic Reading Subtitle Overlay (replaces native captions when enabled) */}
      {bionicReadingEnabled && activeCueText && (
        <div
          className="absolute bottom-20 left-0 right-0 flex justify-center px-4 z-20 pointer-events-none"
          aria-live="polite"
        >
          <div
            className="bg-black/80 text-white text-lg sm:text-xl leading-relaxed px-4 py-2 rounded-md max-w-2xl text-center"
            // Content is our own <strong>-wrapped output derived from the site's
            // own VTT subtitle files (stripVttTags removes any pre-existing markup
            // first), not arbitrary user input.
            dangerouslySetInnerHTML={{
              __html: activeCueText
                .split("\n")
                .map((line) => bionicText(line))
                .join("<br />"),
            }}
          />
        </div>
      )}

      {/* Control Overlay Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex flex-col gap-2 z-10 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Radix UI Timeline Scrubber */}
        <div className="w-full flex items-center">
          <Slider.Root
            aria-label="Video timeline scrubber"
            className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
            value={[progress]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
          >
            <Slider.Track className="bg-white/30 relative grow rounded-full h-1 overflow-hidden">
              <Slider.Range className="absolute bg-indigo-500 rounded-full h-full" />
            </Slider.Track>
            <Slider.Thumb
              className="block w-3.5 h-3.5 bg-white rounded-full hover:scale-125 focus:outline-none focus:ring-2 focus:ring-indigo-400 transition-transform"
              aria-label="Current video position"
            />
          </Slider.Root>
        </div>

        {/* Bottom Control Buttons */}
        <div className="flex items-center justify-between text-white text-sm pt-1">
          <div className="flex items-center gap-4">
            {/* Play/Pause Button */}
            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? "Pause video" : "Play video"}
              className="p-1 hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" />
              ) : (
                <Play className="w-6 h-6 fill-current" />
              )}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                className="p-1 hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>

              <Slider.Root
                aria-label="Volume level slider"
                className="relative flex items-center select-none touch-none w-20 h-5 cursor-pointer"
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.05}
                onValueChange={handleVolumeChange}
              >
                <Slider.Track className="bg-white/30 relative grow rounded-full h-1 overflow-hidden">
                  <Slider.Range className="absolute bg-white rounded-full h-full" />
                </Slider.Track>
                <Slider.Thumb
                  className="block w-2.5 h-2.5 bg-white rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  aria-label="Volume slider position"
                />
              </Slider.Root>
            </div>

            {/* Timestamp Display */}
            <div className="text-xs text-gray-300 font-mono tracking-wider">
              {formatTime(progress)} / {formatTime(duration)}
            </div>
          </div>

          {/* Subtitles / CC Multi-Language Selector */}
          {subtitleTracks.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCcMenu(!showCcMenu)}
                aria-label="Subtitles and Closed Captions selector"
                title="Subtitles / CC"
                className={`p-1 transition-colors rounded focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
                  selectedTrack !== "off"
                    ? "text-indigo-400 font-bold"
                    : "hover:text-indigo-400 text-white"
                }`}
              >
                <Languages className="w-5 h-5" />
              </button>

              {showCcMenu && (
                <div className="absolute bottom-8 right-0 bg-black/90 border border-zinc-700 rounded-lg p-2 min-w-[160px] shadow-xl z-30 flex flex-col gap-1 text-xs">
                  <div className="font-semibold text-gray-400 border-b border-zinc-700 pb-1 mb-1 px-2">
                    Subtitles / CC
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedTrack("off");
                      setShowCcMenu(false);
                      setBionicReadingEnabled(false);
                      if (videoRef.current) {
                        for (let i = 0; i < videoRef.current.textTracks.length; i++) {
                          videoRef.current.textTracks[i].mode = "disabled";
                        }
                      }
                    }}
                    className={`text-left px-2 py-1 rounded hover:bg-zinc-800 transition-colors ${
                      selectedTrack === "off"
                        ? "bg-indigo-600 text-white font-bold"
                        : "text-gray-200"
                    }`}
                  >
                    Off
                  </button>
                  {subtitleTracks.map((track) => (
                    <button
                      key={track.srclang}
                      type="button"
                      onClick={() => {
                        setSelectedTrack(track.srclang);
                        setShowCcMenu(false);
                        if (videoRef.current) {
                          for (let i = 0; i < videoRef.current.textTracks.length; i++) {
                            if (videoRef.current.textTracks[i].language === track.srclang) {
                              videoRef.current.textTracks[i].mode = "showing";
                            } else {
                              videoRef.current.textTracks[i].mode = "disabled";
                            }
                          }
                        }
                      }}
                      className={`text-left px-2 py-1 rounded hover:bg-zinc-800 transition-colors ${
                        selectedTrack === track.srclang
                          ? "bg-indigo-600 text-white font-bold"
                          : "text-gray-200"
                      }`}
                    >
                      {track.label} ({track.srclang.toUpperCase()})
                    </button>
                  ))}
                  <div className="border-t border-zinc-700 mt-1 pt-2 px-2">
                    <label
                      className={`flex items-center gap-2 py-1 select-none ${
                        selectedTrack === "off"
                          ? "text-gray-500 cursor-not-allowed"
                          : "text-gray-200 cursor-pointer"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={bionicReadingEnabled}
                        disabled={selectedTrack === "off"}
                        onChange={(e) => setBionicReadingEnabled(e.target.checked)}
                        className="accent-indigo-500"
                        aria-label="Enable Dyslexia-Optimized Subtitles"
                      />
                      <BookOpen className="w-3.5 h-3.5 shrink-0" />
                      Dyslexia-Optimized Subtitles
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Picture-in-Picture Button */}
          {isPictureInPictureSupported && (
            <button
              type="button"
              onClick={togglePictureInPicture}
              aria-label={
                isPictureInPicture ? "Exit picture in picture" : "Enter picture in picture"
              }
              title="Picture in Picture"
              className="p-1 hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
            >
              <PictureInPicture2
                className={`w-5 h-5 ${isPictureInPicture ? "text-indigo-400" : ""}`}
              />
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            className="p-1 hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
          >
            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default VideoPlayer;
