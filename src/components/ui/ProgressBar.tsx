import React, { useEffect, useState } from "react";
import { motion, useAnimation } from "framer-motion";

interface ProgressBarProps {
  durationMs: number;
  isPaused: boolean;
  isActive: boolean;
}

/**
 * ProgressBar Component
 * Animates from 0% to 100% width over the specified duration.
 * Automatically resets and pauses when isPaused is true.
 * Respects user's reduced motion preferences implicitly via Framer Motion.
 */
export const ProgressBar: React.FC<ProgressBarProps> = ({ durationMs, isPaused, isActive }) => {
  const controls = useAnimation();
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    // Check for reduced motion preference on mount
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || !isActive) {
      controls.set({ width: "100%" });
      return;
    }

    if (isPaused) {
      controls.stop();
    } else {
      controls.start({
        width: "100%",
        transition: {
          duration: durationMs / 1000,
          ease: "linear",
        },
      });
    }
  }, [isPaused, isActive, prefersReducedMotion, durationMs, controls]);

  // Reset animation instantly when a new slide is selected
  useEffect(() => {
    if (!isPaused && isActive && !prefersReducedMotion) {
      controls.set({ width: "0%" });
      controls.start({
        width: "100%",
        transition: {
          duration: durationMs / 1000,
          ease: "linear",
        },
      });
    }
  }, [isActive, isPaused, prefersReducedMotion, durationMs, controls]);

  return (
    <div
      className="w-full h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-4"
      role="progressbar"
      aria-valuenow={isPaused ? 0 : 100}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="Slide advancement progress"
    >
      <motion.div
        initial={{ width: "0%" }}
        animate={controls}
        className="h-full bg-primary rounded-full"
        style={{ width: prefersReducedMotion ? "100%" : "0%" }}
      />
    </div>
  );
};
