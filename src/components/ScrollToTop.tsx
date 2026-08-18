import ArrowUp from "lucide-react/dist/esm/icons/arrow-up";
import ChevronsUp from "lucide-react/dist/esm/icons/chevrons-up";
import { useCallback } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useScrollVelocity } from "@/hooks/useScrollVelocity";

// Circle geometry for the scroll-progress ring (#274)
const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/**
 * Dynamic Back-to-Top button that tracks scroll velocity and direction.
 *
 * Behaviour (per #1779):
 * - Hidden while the user scrolls **downward** — avoids obscuring content.
 * - Appears only when the user flicks **upward** past 1000px depth,
 *   signalling intent to navigate back.
 * - Hides instantly on any downward scroll.
 * - iOS Safari rubber-banding is handled — negative scrollY is clamped at 0
 *   so the button never flashes at the top of the page.
 * - Uses requestAnimationFrame + throttle so scroll perf is never degraded.
 */
export function ScrollToTop() {
  const {
    shouldShowBackToTop: isVisible,
    scrollProgress,
    velocity,
    direction,
  } = useScrollVelocity({
    threshold: 10,
    visibilityDepth: 1000,
    throttleMs: 50,
  });

  const scrollToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const ringOffset = RING_CIRCUMFERENCE * (1 - scrollProgress);

  // Use double-chevron icon when user is scrolling up fast (> 1200 px/s)
  const isFastScroll = direction === "up" && velocity > 1200;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "fixed bottom-6 right-6 z-50 h-14 w-14 transition-all duration-300",
            isVisible
              ? "opacity-100 translate-y-0 scale-100 pointer-events-auto"
              : "opacity-0 translate-y-4 scale-75 pointer-events-none",
          )}
        >
          {/* Scroll-progress ring: track + fill, kept behind the button and non-interactive (#274) */}
          <svg
            className="pointer-events-none absolute inset-0 h-full w-full -rotate-90"
            viewBox="0 0 56 56"
            aria-hidden="true"
          >
            <circle
              cx="28"
              cy="28"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2"
              className="stroke-black/15 dark:stroke-white/15"
            />
            <circle
              cx="28"
              cy="28"
              r={RING_RADIUS}
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={RING_CIRCUMFERENCE}
              strokeDashoffset={ringOffset}
              className="stroke-black transition-[stroke-dashoffset] duration-150 ease-out dark:stroke-white"
            />
          </svg>
          <button
            type="button"
            onClick={scrollToTop}
            aria-label="Back to top"
            className={cn(
              "neu-border neu-press absolute inset-0 m-auto flex h-12 w-12 items-center justify-center rounded-full transition-colors",
              "bg-cream text-black hover:bg-black hover:text-white",
              "dark:bg-black dark:text-white dark:hover:bg-white dark:hover:text-black",
              isFastScroll && "animate-pulse",
            )}
          >
            {isFastScroll ? <ChevronsUp className="h-5 w-5" /> : <ArrowUp className="h-5 w-5" />}
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent>Back to top</TooltipContent>
    </Tooltip>
  );
}
