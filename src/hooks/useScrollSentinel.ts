import { useEffect, useState, type RefObject } from "react";

/**
 * Tracks whether a 1px "sentinel" element (placed at the very top of the
 * page's document flow) has scrolled out of the viewport.
 *
 * This intentionally avoids `window.addEventListener("scroll", ...)`.
 * Scroll listeners fire on every pixel of movement and force a layout
 * read (`scrollY`) on the main thread, which is expensive on mobile GPUs
 * — especially when the result is only used to toggle an expensive
 * `backdrop-filter`. `IntersectionObserver` instead lets the browser
 * compute intersection asynchronously, off the main thread, and only
 * notifies us on the (rare) transition across the boundary.
 *
 * @param sentinelRef ref to a 1px-tall element rendered in normal
 *   document flow at the top of the page (before any `position: fixed`
 *   siblings, which don't take up flow space).
 * @returns `true` once the sentinel has scrolled past the top of the
 *   viewport (i.e. the user is no longer at the very top of the page).
 */
export function useScrollSentinel(sentinelRef: RefObject<Element | null>): boolean {
  const [isPastSentinel, setIsPastSentinel] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        // isIntersecting === true  -> sentinel visible -> user is at the top.
        // isIntersecting === false -> sentinel scrolled away -> user scrolled down.
        setIsPastSentinel(!entry.isIntersecting);
      },
      { threshold: 0 },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  return isPastSentinel;
}
