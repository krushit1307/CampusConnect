import React, { useRef, useState, useEffect, useCallback } from 'react';
import * as Slider from '@radix-ui/react-slider';
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from 'lucide-react';

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
  const [showControls, setShowControls] = useState<boolean>(true);

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
  const handleSeekBy = useCallback((seconds: number) => {
    if (!videoRef.current) return;
    const newTime = Math.min(Math.max(videoRef.current.currentTime + seconds, 0), duration);
    videoRef.current.currentTime = newTime;
    setProgress(newTime);
  }, [duration]);

  // Fullscreen Toggle using standard Fullscreen API
  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(console.error);
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(console.error);
    }
  };

  // Time Formatter Utility
  const formatTime = (timeInSeconds: number) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  // Keyboard Navigation: Space (Play/Pause), Left/Right Arrows (Seeking)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        handleSeekBy(-5);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        handleSeekBy(5);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [togglePlay, handleSeekBy]);

  return (
    <div
      ref={containerRef}
      className="relative group w-full max-w-4xl mx-auto rounded-xl overflow-hidden bg-black shadow-2xl select-none"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* Title Overlay */}
      {title && (
        <div className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/70 to-transparent z-10 pointer-events-none transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}>
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

      {/* Control Overlay Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-opacity duration-300 flex flex-col gap-2 z-10 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
              {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 fill-current" />}
            </button>

            {/* Volume Control */}
            <div className="flex items-center gap-2 group/volume">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={isMuted ? "Unmute audio" : "Mute audio"}
                className="p-1 hover:text-indigo-400 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-400 rounded"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
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
