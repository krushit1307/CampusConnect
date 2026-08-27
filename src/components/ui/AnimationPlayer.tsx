// src/components/ui/AnimationPlayer.tsx
import React, { Suspense, useState, useEffect } from "react";
import { useDotLottiePlayer } from "../../hooks/useDotLottiePlayer";
import { cn } from "../../lib/utils";
import { Skeleton } from "./skeleton";
import AlertCircle from "lucide-react/dist/esm/icons/alert-circle";

/**
 * Supported animation types in the application.
 * Maps to specific .lottie files in the public/animations directory.
 */
export type AnimationType =
  | "empty-state"
  | "success-confetti"
  | "loading-spinner"
  | "error-generic"
  | "search-empty"
  | "network-offline";

interface AnimationPlayerProps {
  type: AnimationType;
  className?: string;
  width?: string | number;
  height?: string | number;
  loop?: boolean;
  autoplay?: boolean;
  speed?: number;
  onComplete?: () => void;
  altText?: string;
}

/**
 * Resolves the asset path for a given animation type.
 * Vite handles the asset inclusion based on the .lottie extension.
 */
const getAnimationSrc = (type: AnimationType): string => {
  switch (type) {
    case "empty-state":
      return "/animations/empty-state.lottie";
    case "success-confetti":
      return "/animations/success-confetti.lottie";
    case "loading-spinner":
      return "/animations/loading-spinner.lottie";
    case "error-generic":
      return "/animations/error-generic.lottie";
    case "search-empty":
      return "/animations/search-empty.lottie";
    case "network-offline":
      return "/animations/network-offline.lottie";
    default:
      return "/animations/loading-spinner.lottie";
  }
};

/**
 * Universal wrapper for dotLottie animations.
 * Replaces the old react-lottie implementation with the highly
 * compressed @dotlottie/react-player format.
 *
 * Provides built-in loading skeletons and error fallbacks to ensure
 * UI stability even if the asset fails to download.
 */
export const AnimationPlayer: React.FC<AnimationPlayerProps> = ({
  type,
  className,
  width = "100%",
  height = "100%",
  loop = false,
  autoplay = true,
  speed = 1.0,
  onComplete,
  altText = "Animation",
}) => {
  const [src, setSrc] = useState<string>(getAnimationSrc(type));

  useEffect(() => {
    setSrc(getAnimationSrc(type));
  }, [type]);

  const { PlayerComponent, error } = useDotLottiePlayer({
    src,
    loop,
    autoplay,
    speed,
    onComplete,
  });

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center gap-2 text-muted-foreground bg-muted/30 rounded-lg border border-dashed border-muted-foreground/20",
          className,
        )}
        style={{ width, height }}
        role="img"
        aria-label={altText}
      >
        <AlertCircle className="w-8 h-8 text-destructive/60" />
        <span className="text-xs text-center px-4">Animation unavailable</span>
      </div>
    );
  }

  return (
    <Suspense
      fallback={<Skeleton className={cn("rounded-lg", className)} style={{ width, height }} />}
    >
      <div
        className={cn("relative overflow-hidden rounded-lg", className)}
        style={{ width, height }}
        role="img"
        aria-label={altText}
      >
        <PlayerComponent className="w-full h-full" />
      </div>
    </Suspense>
  );
};
