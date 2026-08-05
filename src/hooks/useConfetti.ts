import { useCallback, useEffect, useState } from "react";
import {
  BRAND_CONFETTI_COLORS,
  checkPrefersReducedMotion,
  ConfettiOptions,
  fireConfetti,
} from "../lib/confettiEngine";

export interface UseConfettiReturn {
  /**
   * Fires realistic dual-cannon bursts from screen edges (Left at 0ms, Right at 200ms)
   */
  fireCannon: (options?: Partial<ConfettiOptions>) => void;

  /**
   * Fires a massive celebratory center burst
   */
  fireCelebration: (options?: Partial<ConfettiOptions>) => void;

  /**
   * Fires sequential multi-burst fireworks (3 bursts)
   */
  fireFireworks: (options?: Partial<ConfettiOptions>) => void;

  /**
   * Fires star-shaped confetti burst
   */
  fireStars: (options?: Partial<ConfettiOptions>) => void;

  /**
   * Fires custom confetti with explicit parameters
   */
  fireCustom: (options: ConfettiOptions) => void;

  /**
   * True if system setting prefers reduced motion
   */
  isReducedMotion: boolean;

  /**
   * Toggles local override for reduced motion accessibility mode testing
   */
  reducedMotionOverride: boolean;
  setReducedMotionOverride: (value: boolean) => void;
}

export function useConfetti(): UseConfettiReturn {
  const [isReducedMotion, setIsReducedMotion] = useState<boolean>(false);
  const [reducedMotionOverride, setReducedMotionOverride] = useState<boolean>(false);

  useEffect(() => {
    setIsReducedMotion(checkPrefersReducedMotion());

    if (typeof window !== "undefined" && window.matchMedia) {
      const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
      const handleChange = (e: MediaQueryListEvent) => {
        setIsReducedMotion(e.matches);
      };

      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener("change", handleChange);
      }

      return () => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener("change", handleChange);
        }
      };
    }
  }, []);

  const shouldSuppress = isReducedMotion || reducedMotionOverride;

  /**
   * Dual Cannon Realistic Look:
   * Burst #1: Left edge of screen (origin x: 0.1, y: 0.7, angle: 60°)
   * Burst #2: Right edge of screen (origin x: 0.9, y: 0.7, angle: 120°, 200ms delay)
   */
  const fireCannon = useCallback(
    (customOptions?: Partial<ConfettiOptions>) => {
      if (shouldSuppress) return;

      const baseOptions: ConfettiOptions = {
        colors: BRAND_CONFETTI_COLORS,
        disableForReducedMotion: true,
        ...customOptions,
      };

      // Left Cannon Burst (Angle 60°, angled towards top-right)
      fireConfetti({
        ...baseOptions,
        particleCount: customOptions?.particleCount || 80,
        angle: 60,
        spread: 55,
        startVelocity: 55,
        origin: { x: 0.1, y: 0.7 },
      });

      // Right Cannon Burst (Angle 120°, angled towards top-left, 200ms delay)
      setTimeout(() => {
        if (shouldSuppress) return;
        fireConfetti({
          ...baseOptions,
          particleCount: customOptions?.particleCount || 80,
          angle: 120,
          spread: 55,
          startVelocity: 55,
          origin: { x: 0.9, y: 0.7 },
        });
      }, 200);
    },
    [shouldSuppress],
  );

  const fireCelebration = useCallback(
    (customOptions?: Partial<ConfettiOptions>) => {
      if (shouldSuppress) return;

      fireConfetti({
        particleCount: 150,
        spread: 100,
        startVelocity: 45,
        origin: { x: 0.5, y: 0.6 },
        colors: BRAND_CONFETTI_COLORS,
        shapes: ["square", "circle", "star", "ribbon"],
        ...customOptions,
      });
    },
    [shouldSuppress],
  );

  const fireFireworks = useCallback(
    (customOptions?: Partial<ConfettiOptions>) => {
      if (shouldSuppress) return;

      const count = 3;
      for (let i = 0; i < count; i++) {
        setTimeout(() => {
          if (shouldSuppress) return;
          fireConfetti({
            particleCount: 70,
            angle: 90,
            spread: 360,
            startVelocity: 35,
            decay: 0.92,
            gravity: 0.8,
            origin: {
              x: 0.2 + i * 0.3,
              y: 0.3 + (i % 2) * 0.2,
            },
            colors: BRAND_CONFETTI_COLORS,
            shapes: ["circle", "star"],
            ...customOptions,
          });
        }, i * 300);
      }
    },
    [shouldSuppress],
  );

  const fireStars = useCallback(
    (customOptions?: Partial<ConfettiOptions>) => {
      if (shouldSuppress) return;

      fireConfetti({
        particleCount: 90,
        spread: 80,
        startVelocity: 50,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#ffbe26", "#ff5e7e", "#a25afd", "#26ccff"],
        shapes: ["star"],
        scalar: 1.2,
        ...customOptions,
      });
    },
    [shouldSuppress],
  );

  const fireCustom = useCallback(
    (options: ConfettiOptions) => {
      if (shouldSuppress) return;
      fireConfetti(options);
    },
    [shouldSuppress],
  );

  return {
    fireCannon,
    fireCelebration,
    fireFireworks,
    fireStars,
    fireCustom,
    isReducedMotion,
    reducedMotionOverride,
    setReducedMotionOverride,
  };
}
