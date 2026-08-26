import { useEffect, useCallback } from "react";
import confetti from "canvas-confetti";

export const useConfetti = () => {
  // CRUCIAL: Check OS settings for reduced motion to prevent vestibular issues
  const prefersReducedMotion = useCallback(() => {
    // Failsafe in case window is undefined (e.g., during SSR)
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  // Standard burst for generic success states
  const triggerStandardBurst = useCallback(() => {
    if (prefersReducedMotion()) return;

    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      zIndex: 9999, // High z-index to overlay modals
      disableForReducedMotion: true, // Built-in fallback
    });
  }, [prefersReducedMotion]);

  // Specialized school colors burst
  const triggerSchoolColorsBurst = useCallback(() => {
    if (prefersReducedMotion()) return;

    confetti({
      particleCount: 150,
      spread: 90,
      origin: { y: 0.6 },
      // Using VJTI Blue and Gold - adjust the exact hex codes if the UI needs a different shade
      colors: ["#003366", "#FFBB00"],
      zIndex: 9999,
      disableForReducedMotion: true,
    });
  }, [prefersReducedMotion]);

  // EDGE CASE: Prevent memory leaks by destroying the canvas when the component unmounts
  useEffect(() => {
    return () => {
      confetti.reset();
    };
  }, []);

  return { triggerStandardBurst, triggerSchoolColorsBurst };
};
