import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, ArrowDown } from "lucide-react";

interface PullToRefreshProps {
  onRefresh: () => Promise<void> | void;
  isRefreshing: boolean;
  children: React.ReactNode;
}

const ACTIVATION_THRESHOLD = 80;
const MAX_PULL_DISTANCE = 140;
const PULL_RESISTANCE = 0.4;

export function PullToRefresh({ onRefresh, isRefreshing, children }: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startY = useRef(0);
  const startX = useRef(0);
  const activeTouch = useRef(false);
  const pullDistanceRef = useRef(0);
  const isRefreshingRef = useRef(isRefreshing);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    isRefreshingRef.current = isRefreshing;
    if (!isRefreshing && !isDragging) {
      setPullDistance(0);
      pullDistanceRef.current = 0;
    }
  }, [isRefreshing, isDragging]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const updatePullDistance = useCallback((dist: number) => {
    pullDistanceRef.current = dist;
    setPullDistance(dist);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      // Guard against starting a new gesture while refreshing
      if (isRefreshingRef.current) return;

      const isAtTop = window.scrollY === 0 && document.documentElement.scrollTop === 0;
      if (!isAtTop) {
        activeTouch.current = false;
        return;
      }

      activeTouch.current = true;
      startY.current = e.touches[0].clientY;
      startX.current = e.touches[0].clientX;
      setIsDragging(true);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!activeTouch.current) return;

      const currentY = e.touches[0].clientY;
      const currentX = e.touches[0].clientX;
      const diffY = currentY - startY.current;
      const diffX = currentX - startX.current;

      // Avoid triggering if swipe is primarily horizontal (e.g., carousel swipe)
      if (Math.abs(diffX) > Math.abs(diffY)) {
        activeTouch.current = false;
        setIsDragging(false);
        updatePullDistance(0);
        return;
      }

      if (diffY > 0) {
        if (e.cancelable) {
          e.preventDefault();
        }
        const dist = Math.min(diffY * PULL_RESISTANCE, MAX_PULL_DISTANCE);
        updatePullDistance(dist);
      } else {
        // Moving up - cancel gesture and allow normal scrolling
        activeTouch.current = false;
        setIsDragging(false);
        updatePullDistance(0);
      }
    };

    const handleTouchEnd = () => {
      if (!activeTouch.current) return;
      activeTouch.current = false;
      setIsDragging(false);

      const currentPull = pullDistanceRef.current;
      if (currentPull >= ACTIVATION_THRESHOLD && !isRefreshingRef.current) {
        const result = onRefreshRef.current();
        if (result instanceof Promise) {
          result.catch((err) => console.error("Error during pull-to-refresh:", err));
        }
      } else {
        updatePullDistance(0);
      }
    };

    container.addEventListener("touchstart", handleTouchStart, { passive: true });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd, { passive: true });
    container.addEventListener("touchcancel", handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("touchcancel", handleTouchEnd);
    };
  }, [updatePullDistance]);

  const currentHeight = isRefreshing
    ? isDragging
      ? Math.max(60, pullDistance)
      : 60
    : pullDistance;

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Pull indicator */}
      <div
        role="status"
        aria-live="polite"
        aria-busy={isRefreshing}
        aria-label={
          isRefreshing
            ? "Refreshing content"
            : pullDistance >= ACTIVATION_THRESHOLD
              ? "Release to refresh content"
              : "Pull to refresh content"
        }
        className="absolute left-0 right-0 z-30 flex items-center justify-center overflow-hidden border-b-2 border-black bg-lime text-black font-mono text-xs uppercase font-bold dark:border-cream"
        style={{
          top: 0,
          height: `${currentHeight}px`,
          transition: isDragging ? "none" : "height 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      >
        <div className="flex h-14 items-center gap-2">
          {isRefreshing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-black" aria-hidden="true" />
              <span>Refreshing...</span>
            </>
          ) : (
            <>
              <ArrowDown
                className="h-4 w-4 text-black transition-transform duration-200"
                aria-hidden="true"
                style={{
                  transform: `rotate(${pullDistance >= ACTIVATION_THRESHOLD ? 180 : 0}deg)`,
                }}
              />
              <span>
                {pullDistance >= ACTIVATION_THRESHOLD ? "Release to refresh" : "Pull to refresh"}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content wrapper */}
      <div
        style={{
          transform: `translateY(${currentHeight}px)`,
          transition: isDragging ? "none" : "transform 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
