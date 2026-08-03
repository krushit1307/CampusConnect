import { useEffect, useState, useRef } from "react";

export type ScrollDirection = "up" | "down";

/**
 * Tracks the user's vertical scroll direction.
 *
 * - Scrolling down returns "down" (used to hide UI, e.g. a FAB, so it
 *   doesn't block content while reading a long feed).
 * - Scrolling up returns "up" (used to instantly reveal UI for quick access).
 *
 * `threshold` (px) avoids flip-flopping on tiny scroll jitters/momentum
 * scrolling — the direction only updates once the scroll delta since the
 * last recorded position exceeds this value.
 */
export function useScrollDirection(threshold = 10): ScrollDirection {
  const [direction, setDirection] = useState<ScrollDirection>("up");
  const lastScrollY = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    lastScrollY.current = window.scrollY;

    const updateDirection = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;

      // Ignore overscroll/bounce at the very top of the page
      if (currentScrollY <= 0) {
        setDirection("up");
        lastScrollY.current = currentScrollY;
        ticking.current = false;
        return;
      }

      if (Math.abs(delta) >= threshold) {
        setDirection(delta > 0 ? "down" : "up");
        lastScrollY.current = currentScrollY;
      }

      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(updateDirection);
        ticking.current = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return direction;
}
