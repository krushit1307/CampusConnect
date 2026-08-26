// src/components/ui/LoadingSpinner.tsx
import React from "react";
import { AnimationPlayer } from "./AnimationPlayer";
import { cn } from "../../lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg" | "xl";
  text?: string;
  overlay?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-12 h-12",
  md: "w-24 h-24",
  lg: "w-40 h-40",
  xl: "w-64 h-64",
};

/**
 * High-performance loading spinner using dotLottie.
 * Replaces the heavy JSON-based Lottie web implementation.
 */
export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = "md",
  text,
  overlay = false,
  className,
}) => {
  const SpinnerContent = (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4",
        overlay && "absolute inset-0 bg-background/80 backdrop-blur-sm z-50",
        className,
      )}
    >
      <div className={sizeClasses[size]}>
        <AnimationPlayer type="loading-spinner" loop={true} autoplay={true} altText="Loading" />
      </div>
      {text && <p className="text-sm font-medium text-muted-foreground animate-pulse">{text}</p>}
    </div>
  );

  if (overlay) {
    return SpinnerContent;
  }

  return <div className="w-full h-full flex items-center justify-center">{SpinnerContent}</div>;
};
