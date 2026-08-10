import { useEffect, useState, useRef } from "react";

export type ScrollDirection = "up" | "down";

export interface ScrollState {
  /** Current vertical scroll position in pixels */
  scrollY: number;
  /** Direction of the most recent scroll movement */
  direction: ScrollDirection;
}

/**
 * Tracks the user's vertical scroll direction and current scroll position.
 *
 * - Returns "down" while the user scrolls down (used to hide UI elements).
 * - Returns "up"  the instant any upward movement is detected (instant reveal).
 * - Always returns "up" when scrollY <= 0 (iOS rubber-band / overscroll fix).
 *
 * Uses requestAnimationFrame throttling — no scroll events are processed more
 * than once per animation frame, keeping the listener lightweight.
 *
 * `threshold` (px, default 10) prevents direction flipping on tiny jitter or
 * momentum scrolling — the direction only commits once the delta since the
 * last recorded position exceeds this value.
 */
export function useScrollDirection(threshold = 10): ScrollState {
  const [state, setState] = useState<ScrollState>({
    scrollY: typeof window !== "undefined" ? window.scrollY : 0,
    direction: "up",
  });

  const lastScrollY = useRef(typeof window !== "undefined" ? window.scrollY : 0);
  const ticking = useRef(false);

  useEffect(() => {
    // Guard for SSR — window is not available on the server
    if (typeof window === "undefined") return;

    lastScrollY.current = window.scrollY;

    const updateDirection = () => {
      const currentScrollY = window.scrollY;
      const delta = currentScrollY - lastScrollY.current;

      // iOS rubber-band / overscroll: ignore negative scroll positions
      if (currentScrollY <= 0) {
        setState({ scrollY: 0, direction: "up" });
        lastScrollY.current = currentScrollY;
        ticking.current = false;
        return;
      }

      if (Math.abs(delta) >= threshold) {
        setState({
          scrollY: currentScrollY,
          direction: delta > 0 ? "down" : "up",
        });
        lastScrollY.current = currentScrollY;
      } else {
        // Even if direction hasn't changed, keep scrollY up to date
        setState((prev) => ({ ...prev, scrollY: currentScrollY }));
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

  return state;
}
