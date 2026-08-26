import { useEffect, useRef, useState } from "react";

/**
 * Tracks the window's vertical scroll position.
 *
 * Reads are throttled to one per animation frame (via requestAnimationFrame)
 * so components that derive style/layout decisions from scroll position
 * (e.g. a shrinking sticky header) don't trigger a re-render on every raw
 * `scroll` event, which can fire dozens of times per frame on some devices.
 *
 * Returns 0 during SSR / before mount, then the live `window.scrollY`.
 */
export function useScroll(): number {
  const [scrollY, setScrollY] = useState<number>(() =>
    typeof window !== "undefined" ? window.scrollY : 0,
  );
  const ticking = useRef(false);

  useEffect(() => {
    // Sync once on mount in case the page loaded already scrolled
    // (e.g. back/forward navigation restoring scroll position).
    setScrollY(window.scrollY);

    const update = () => {
      setScrollY(window.scrollY);
      ticking.current = false;
    };

    const onScroll = () => {
      if (!ticking.current) {
        window.requestAnimationFrame(update);
        ticking.current = true;
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return scrollY;
}
