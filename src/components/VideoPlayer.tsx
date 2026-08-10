import React, { useRef, useState, useEffect, useCallback } from "react";
import * as Slider from "@radix-ui/react-slider";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, PictureInPicture2 } from "lucide-react";

interface VideoPlayerProps {
  src: string;
  poster?: string;
  title?: string;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ src, poster, title }) => {
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
      />

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
