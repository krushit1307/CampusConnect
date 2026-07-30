import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useAnimationControls, useMotionValue, useTransform } from "framer-motion";
import { Loader2, ArrowDown } from "lucide-react";

interface PullToRefreshMotionProps {
  /** Called when the user releases the pull past the activation threshold. */
  onRefresh: () => Promise<void> | void;
  /** When true the spinner stays pinned at the resting position until the caller flips it back. */
  isRefreshing?: boolean;
  /**
   * Pull distance in pixels required to trigger a refresh. Default 100,
   * matching the threshold called out in issue #1917.
   */
  activationThreshold?: number;
  /** Y position (px) the spinner locks to while refreshing. Default 50. */
  refreshingRestY?: number;
  children: ReactNode;
}

/**
 * PullToRefreshMotion — a Framer-Motion-driven pull-to-refresh gesture
 * (issue #1917).
 *
 * Design notes:
 *   - The whole feed is wrapped in a <motion.div drag="y"> with
 *     dragConstraints={{ top: 0, bottom: 0 }} and a tuned dragElastic so the
 *     pull naturally resists past ~250px. Framer's drag layer already gives
 *     us smooth motion without us hand-rolling requestAnimationFrame.
 *   - The spinner indicator sits in a separate absolutely-positioned
 *     container above the feed. We drive its translateY via useTransform on
 *     the same motion value the wrapper uses, so the indicator follows the
 *     pull 1:1 without any extra React re-renders.
 *   - The spec calls out that the gesture MUST NOT activate when the user
 *     is mid-scroll. We honour that by reading window.scrollY at the moment
 *     drag starts and, if non-zero, immediately snapping the wrapper back
 *     to y=0 so the browser keeps doing its normal scroll. Drag is also
 *     disabled for the rest of the gesture so framer doesn't keep panning.
 *   - Native browser overscroll is suppressed by a `body { overscroll-
 *     behavior-y: none }` rule added alongside this component, matching
 *     step 1 of the issue's Technical Implementation Steps.
 */
export function PullToRefreshMotion({
  onRefresh,
  isRefreshing = false,
  activationThreshold = 100,
  refreshingRestY = 50,
  children,
}: PullToRefreshMotionProps) {
  const y = useMotionValue(0);
  const controls = useAnimationControls();
  const onRefreshRef = useRef(onRefresh);
  const isRefreshingRef = useRef(isRefreshing);
  const dragCancelledRef = useRef(false);

  const [dragEnabled, setDragEnabled] = useState(true);
  const [pastThreshold, setPastThreshold] = useState(false);

  // Keep the latest onRefresh / isRefreshing in a ref so the dragEnd handler
  // (which lives in a memoized callback) always sees the current values.
  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
    // When the parent flips isRefreshing off, retract the spinner.
    if (!isRefreshing) {
      controls.start({ y: 0 }, { type: "spring", stiffness: 300, damping: 30 });
    }
  }, [isRefreshing, controls]);

  // Watch the y motion value so we can flip the "past threshold" indicator.
  // We use the raw value rather than a derived motion value because the
  // threshold label changes the DOM text and we DO want a re-render there.
  useEffect(() => {
    const unsub = y.on("change", (latest) => {
      setPastThreshold(latest > activationThreshold);
    });
    return unsub;
  }, [y, activationThreshold]);

  const handleDragStart = useCallback(() => {
    // Spec edge case: do NOT activate the gesture unless the user is already
    // at the absolute top of the page.
    const isAtTop = window.scrollY <= 0 && document.documentElement.scrollTop <= 0;
    if (!isAtTop) {
      setDragEnabled(false);
      // Stop the in-flight drag motion so any further y changes don't
      // accumulate before the user lifts their finger.
      controls.stop();
      // Snap back so the feed doesn't drift if framer had already moved it.
      controls.start({ y: 0 }, { type: "spring", stiffness: 400, damping: 30 });
      // Mark this gesture as cancelled so onDragEnd short-circuits.
      dragCancelledRef.current = true;
      return;
    }
    setDragEnabled(true);
    dragCancelledRef.current = false;
  }, [controls]);

  const handleDragEnd = useCallback(() => {
    // If the gesture was cancelled because the user wasn't at the top,
    // skip the threshold check entirely.
    if (dragCancelledRef.current) {
      dragCancelledRef.current = false;
      controls.start({ y: 0 }, { type: "spring", stiffness: 300, damping: 30 });
      return;
    }
    const currentY = y.get();

    if (currentY > activationThreshold && !isRefreshingRef.current) {
      // Lock at the resting position, then trigger the refresh.
      controls.start({ y: refreshingRestY }, { type: "spring", stiffness: 300, damping: 25 });
      try {
        const result = onRefreshRef.current();
        if (result instanceof Promise) {
          result.catch((err) => {
            // If the refresh fails, retract the spinner so the user can try again.
            console.error("PullToRefreshMotion: refresh failed", err);
            controls.start({ y: 0 }, { type: "spring", stiffness: 300, damping: 30 });
          });
        }
      } catch (err) {
        console.error("PullToRefreshMotion: refresh threw", err);
        controls.start({ y: 0 }, { type: "spring", stiffness: 300, damping: 30 });
      }
    } else {
      // Released below threshold: retract.
      controls.start({ y: 0 }, { type: "spring", stiffness: 300, damping: 30 });
    }
  }, [y, activationThreshold, refreshingRestY, controls]);

  // Re-enable drag the moment the user is back at the top of the page.
  // This handles the case where drag was disabled mid-gesture because we
  // caught them mid-scroll.
  useEffect(() => {
    if (dragEnabled) return;
    const handleScroll = () => {
      if (window.scrollY <= 0 && document.documentElement.scrollTop <= 0) {
        setDragEnabled(true);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [dragEnabled]);

  // Indicator translateY — same motion value as the wrapper so the spinner
  // mirrors the pull 1:1 without re-rendering React on every frame.
  const indicatorY = useTransform(y, (latest) => latest);

  return (
    <div className="relative w-full overflow-hidden">
      {/* Spinner indicator — sits above the feed, translates down as the
          wrapper is pulled. */}
      <motion.div
        aria-hidden="true"
        data-testid="ptr-indicator"
        className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-center overflow-hidden border-b-2 border-black bg-lime font-mono text-xs font-bold uppercase text-black dark:border-cream"
        style={{
          y: indicatorY,
          height: refreshingRestY,
        }}
      >
        <div className="flex items-center gap-2">
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Refreshing…</span>
            </>
          ) : (
            <>
              <ArrowDown
                className="h-4 w-4 transition-transform duration-200"
                style={{ transform: `rotate(${pastThreshold ? 180 : 0}deg)` }}
              />
              <span>{pastThreshold ? "Release to refresh" : "Pull to refresh"}</span>
            </>
          )}
        </div>
      </motion.div>

      {/* Status region for screen readers. */}
      <div
        role="status"
        aria-live="polite"
        aria-busy={isRefreshing}
        aria-label={
          isRefreshing
            ? "Refreshing content"
            : pastThreshold
              ? "Release to refresh content"
              : "Pull to refresh content"
        }
        className="sr-only"
      />

      {/* The feed itself — the wrapper is what gets dragged. */}
      <motion.div
        data-testid="ptr-wrapper"
        drag={dragEnabled ? "y" : undefined}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.6}
        dragMomentum={false}
        animate={controls}
        style={{ y }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {children}
      </motion.div>

      {/* Helpful debug: surface the refreshing state for E2E tests. */}
      {isRefreshing && <span data-testid="ptr-state" data-state="refreshing" className="sr-only" />}
    </div>
  );
}
