import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export interface ProfileCompletenessData {
  hasAvatar: boolean;
  hasBio: boolean;
  hasMajor: boolean;
  hasInterests: boolean;
}

export interface ProgressRingProps {
  /** Size of the SVG element in pixels (width and height) */
  size?: number;
  /** Stroke width of the ring track and fill */
  strokeWidth?: number;
  /** Current percentage (0 to 100). If omitted, calculated from profileData. */
  percentage?: number;
  /** User profile completion criteria */
  profileData?: ProfileCompletenessData;
  /** Child avatar component to wrap inside the progress ring */
  children?: React.ReactNode;
  /** Additional container className */
  className?: string;
  /** Custom stroke color class for completed ring fill */
  strokeColorClass?: string;
  /** Show step breakdown indicators or percentage label */
  showBadge?: boolean;
}

/**
 * Calculates completion percentage based on 4 key profile metrics:
 * Avatar (25%), Bio (25%), Major (25%), Interests (25%).
 */
export function calculateProfileCompleteness(data?: ProfileCompletenessData): number {
  if (!data) return 0;
  let score = 0;
  if (data.hasAvatar) score += 25;
  if (data.hasBio) score += 25;
  if (data.hasMajor) score += 25;
  if (data.hasInterests) score += 25;
  return score;
}

/**
 * Onboarding Progress Ring SVG animation component (#1971).
 * Wraps around user avatars and smoothly animates stroke-dashoffset on load/update.
 */
export const ProgressRing: React.FC<ProgressRingProps> = ({
  size = 120,
  strokeWidth = 6,
  percentage,
  profileData,
  children,
  className = "",
  strokeColorClass = "stroke-emerald-500 dark:stroke-emerald-400",
  showBadge = true,
}) => {
  const targetPercentage =
    percentage !== undefined ? percentage : calculateProfileCompleteness(profileData);

  const [animatedPercent, setAnimatedPercent] = useState(0);

  // Trigger smooth CSS animation from 0 to target on mount / update
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercent(Math.min(100, Math.max(0, targetPercentage)));
    }, 50);
    return () => clearTimeout(timer);
  }, [targetPercentage]);

  const center = size / 2;
  const radius = center - strokeWidth;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedPercent / 100) * circumference;

  return (
    <div
      className={cn("relative inline-flex items-center justify-center shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {/* Animated SVG Progress Ring */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 h-full w-full -rotate-90 pointer-events-none"
        aria-hidden="true"
      >
        {/* Background Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-neutral-200 dark:stroke-neutral-800"
        />
        {/* Animated Progress Fill */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={cn(
            "transition-[stroke-dashoffset] duration-[1500ms] ease-in-out",
            strokeColorClass,
          )}
        />
      </svg>

      {/* Embedded Child Avatar Container */}
      <div
        className="overflow-hidden rounded-full flex items-center justify-center"
        style={{
          width: size - strokeWidth * 3,
          height: size - strokeWidth * 3,
        }}
      >
        {children}
      </div>

      {/* Percentage Badge */}
      {showBadge && (
        <span
          className={cn(
            "absolute -bottom-1 right-0 rounded-full border-2 border-black px-1.5 py-0.5 font-mono text-[10px] font-bold text-black dark:border-cream dark:text-black",
            animatedPercent === 100 ? "bg-lime" : "bg-amber-300",
          )}
        >
          {animatedPercent}%
        </span>
      )}
    </div>
  );
};
