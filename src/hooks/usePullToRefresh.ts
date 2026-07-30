import { useState, useRef, useEffect, useCallback } from "react";

interface UsePullToRefreshOptions {
  onRefresh: () => Promise<unknown>;
  pullThreshold?: number; // Distance in px needed to trigger refresh
  maxPullDistance?: number; // Resistance cap in px
}

export function usePullToRefresh<T extends HTMLElement>({
  onRefresh,
  pullThreshold = 80,
  maxPullDistance = 120,
}: UsePullToRefreshOptions) {
  const containerRef = useRef<T | null>(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);

  const handleTouchStart = useCallback((e: TouchEvent) => {
    const el = containerRef.current;
    if (!el) return;

    // Only initiate pull when scrolled at top
    const scrollTop = el.scrollTop || window.scrollY || document.documentElement.scrollTop;
    if (scrollTop === 0) {
      startYRef.current = e.touches[0].clientY;
      isDraggingRef.current = true;
    }
  }, []);

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDraggingRef.current || isRefreshing) return;

      const currentY = e.touches[0].clientY;
      const deltaY = currentY - startYRef.current;

      if (deltaY > 0) {
        // Apply resistance curve
        const dampenedDelta = Math.min(deltaY * 0.5, maxPullDistance);
        setPullDistance(dampenedDelta);

        if (e.cancelable && dampenedDelta > 5) {
          e.preventDefault();
        }
      } else {
        setPullDistance(0);
      }
    },
    [isRefreshing, maxPullDistance],
  );

  const handleTouchEnd = useCallback(async () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(pullThreshold);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [pullDistance, pullThreshold, isRefreshing, onRefresh]);

  useEffect(() => {
    const el = containerRef.current || window;

    el.addEventListener("touchstart", handleTouchStart as EventListener, { passive: true });
    el.addEventListener("touchmove", handleTouchMove as EventListener, { passive: false });
    el.addEventListener("touchend", handleTouchEnd as EventListener);

    return () => {
      el.removeEventListener("touchstart", handleTouchStart as EventListener);
      el.removeEventListener("touchmove", handleTouchMove as EventListener);
      el.removeEventListener("touchend", handleTouchEnd as EventListener);
    };
  }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

  return {
    containerRef,
    pullDistance,
    isRefreshing,
    isThresholdMet: pullDistance >= pullThreshold,
  };
}
