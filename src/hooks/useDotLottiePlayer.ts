import React, { useState, useEffect, useRef, useCallback } from "react";
import { DotLottiePlayer } from "@dotlottie/react-player";

/**
 * Configuration options for the DotLottie player hook
 */
interface UseDotLottiePlayerOptions {
  src: string;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  onPlay?: () => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Return type for the useDotLottiePlayer hook
 */
interface UseDotLottiePlayerReturn {
  PlayerComponent: React.ComponentType<Record<string, unknown>>;
  isPlaying: boolean;
  isPaused: boolean;
  play: () => void;
  pause: () => void;
  stop: () => void;
  setSpeed: (speed: number) => void;
  error: Error | null;
}

/**
 * Custom hook to manage dotLottie animation instances.
 * Wraps the @dotlottie/react-player to provide programmatic control
 * over playback state, speed, and event listeners.
 *
 * @param options - Configuration for the animation
 * @returns Player component and control methods
 */
export const useDotLottiePlayer = ({
  src,
  loop = false,
  autoplay = true,
  speed = 1.0,
  onPlay,
  onComplete,
  onError,
}: UseDotLottiePlayerOptions): UseDotLottiePlayerReturn => {
  const [isPlaying, setIsPlaying] = useState<boolean>(autoplay);
  const [isPaused, setIsPaused] = useState<boolean>(false);
  const [currentSpeed, setCurrentSpeed] = useState<number>(speed);
  const [error, setError] = useState<Error | null>(null);

  const playerRef = useRef<any>(null);

  const play = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.play();
      setIsPlaying(true);
      setIsPaused(false);
      onPlay?.();
    }
  }, [onPlay]);

  const pause = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.pause();
      setIsPlaying(false);
      setIsPaused(true);
    }
  }, []);

  const stop = useCallback(() => {
    if (playerRef.current) {
      playerRef.current.stop();
      setIsPlaying(false);
      setIsPaused(false);
    }
  }, []);

  const setSpeed = useCallback((newSpeed: number) => {
    setCurrentSpeed(newSpeed);
    if (playerRef.current) {
      playerRef.current.setSpeed(newSpeed);
    }
  }, []);

  const handleComplete = useCallback(() => {
    setIsPlaying(false);
    setIsPaused(false);
    onComplete?.();
  }, [onComplete]);

  const handleError = useCallback(
    (err: Error) => {
      console.error("[dotLottie] Animation failed to load or play:", err);
      setError(err);
      onError?.(err);
    },
    [onError],
  );

  useEffect(() => {
    if (playerRef.current && autoplay && !isPlaying) {
      play();
    }
  }, [src, autoplay]);

  const PlayerComponent = useCallback(
    (props: Record<string, unknown>) =>
      React.createElement(DotLottiePlayer, {
        ref: playerRef,
        src,
        loop,
        autoplay,
        speed: currentSpeed,
        onLoadError: handleError,
        onComplete: handleComplete,
        background: "transparent",
        ...props,
      }),
    [src, loop, autoplay, currentSpeed, handleError, handleComplete],
  );

  return {
    PlayerComponent,
    isPlaying,
    isPaused,
    play,
    pause,
    stop,
    setSpeed,
    error,
  };
};
