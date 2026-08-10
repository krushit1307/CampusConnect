import { useEffect, useRef, useState, useCallback } from "react";

export type ScrollDirection = "up" | "down" | "idle";

export interface ScrollVelocityState {
  /** Current scroll direction: "up", "down", or "idle" when the user hasn't scrolled. */
  direction: ScrollDirection;
  /** Absolute scroll velocity in pixels per second (always >= 0). */
  velocity: number;
  /** Current vertical scroll position, clamped at 0 to avoid iOS rubber-banding negatives. */
  scrollY: number;
  /** Fraction of the total document scrolled (0–1), used for progress indicators. */
  scrollProgress: number;
  /** Whether the "Back to Top" button should be visible based on scroll intent logic. */
  shouldShowBackToTop: boolean;
}

export interface UseScrollVelocityOptions {
  /**
   * Minimum scroll delta (px) before a direction change is registered.
   * Prevents flip-flopping on small jitters and momentum bounce.
   * @default 10
   */
  threshold?: number;
  /**
   * Minimum vertical scroll position (px) before the Back to Top button can appear.
   * The user must have scrolled past this point AND be scrolling upwards.
   * @default 1000
   */
  visibilityDepth?: number;
  /**
   * Throttle interval (ms) between scroll calculations.
   * Lower values = more responsive but more work per frame.
   * Uses requestAnimationFrame internally so this is a minimum interval.
   * @default 50
   */
  throttleMs?: number;
}

/**
 * Tracks scroll direction, velocity, and "back to top" intent.
 *
 * The button only appears when:
 * 1. The user has scrolled past `visibilityDepth` pixels.
 * 2. The user is actively scrolling **upward** (flicking thumb up).
 *
 * It hides immediately when the user scrolls **downward**.
 *
 * Edge cases handled:
 * - iOS Safari rubber-banding: scrollY is clamped at 0 to prevent
 *   negative values from falsely triggering "up" logic.
 * - Scroll jitter: a `threshold` prevents direction changes on tiny deltas.
 * - Performance: uses rAF + throttle so velocity math never degrades scroll FPS.
 */
export function useScrollVelocity(options: UseScrollVelocityOptions = {}): ScrollVelocityState {
  const { threshold = 10, visibilityDepth = 1000, throttleMs = 50 } = options;

  const [state, setState] = useState<ScrollVelocityState>({
    direction: "idle",
    velocity: 0,
    scrollY: 0,
    scrollProgress: 0,
    shouldShowBackToTop: false,
  });

  const prevScrollY = useRef(0);
  const prevTime = useRef(performance.now());
  const ticking = useRef(false);
  const lastUpdateTime = useRef(0);

  // Decay timer: when the user stops scrolling, velocity should settle to 0
  // and direction should return to "idle" after a short period.
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const compute = useCallback(() => {
    const now = performance.now();

    // Throttle guard: skip if called too soon after last update
    if (now - lastUpdateTime.current < throttleMs) {
      ticking.current = false;
      return;
    }

    // Clamp scrollY at 0 to handle iOS Safari rubber-banding (#1779)
    const currentScrollY = Math.max(0, window.scrollY);
    const delta = currentScrollY - prevScrollY.current;
    const elapsed = (now - prevTime.current) / 1000; // seconds

    // Calculate velocity (px/s). Guard against division by zero / tiny intervals.
    const velocity = elapsed > 0.001 ? Math.abs(delta) / elapsed : 0;

    // Scroll progress (0–1)
    const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
    const scrollProgress =
      scrollableHeight > 0 ? Math.min(1, Math.max(0, currentScrollY / scrollableHeight)) : 0;

    // Direction, only updated when delta exceeds threshold to prevent jitter
    let direction: ScrollDirection = state.direction === "idle" ? "idle" : state.direction;
    if (Math.abs(delta) >= threshold) {
      direction = delta > 0 ? "down" : "up";
    }

    // When user is at the very top, force direction to "up" (natural state)
    if (currentScrollY <= 0) {
      direction = "up";
    }

    // Back to Top visibility logic:
    // Show when: scrolled past depth AND direction is UP
    // Hide when: direction is DOWN (immediately)
    let shouldShowBackToTop = state.shouldShowBackToTop;
    if (direction === "up" && currentScrollY > visibilityDepth) {
      shouldShowBackToTop = true;
    } else if (direction === "down") {
      shouldShowBackToTop = false;
    }
    // Hide when near the top — button is unnecessary
    if (currentScrollY <= 50) {
      shouldShowBackToTop = false;
    }

    prevScrollY.current = currentScrollY;
    prevTime.current = now;
    lastUpdateTime.current = now;
    ticking.current = false;

    setState({
      direction,
      velocity: Math.round(velocity),
      scrollY: currentScrollY,
      scrollProgress,
      shouldShowBackToTop,
    });

    // Reset idle timer on every scroll event
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        direction: "idle",
        velocity: 0,
      }));
    }, 300);
  }, [threshold, visibilityDepth, throttleMs, state.direction, state.shouldShowBackToTop]);

  useEffect(() => {
    prevScrollY.current = Math.max(0, window.scrollY);
    prevTime.current = performance.now();

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(compute);
        ticking.current = true;
      }
    };

    const onResize = () => {
      // Recalculate scroll progress on viewport resize
      const scrollableHeight = document.documentElement.scrollHeight - window.innerHeight;
      const currentScrollY = Math.max(0, window.scrollY);
      const scrollProgress =
        scrollableHeight > 0 ? Math.min(1, Math.max(0, currentScrollY / scrollableHeight)) : 0;
      setState((prev) => ({ ...prev, scrollY: currentScrollY, scrollProgress }));
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [compute]);

  return state;
}
