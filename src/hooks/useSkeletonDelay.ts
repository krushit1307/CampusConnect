import { useState, useEffect } from "react";

export interface UseSkeletonDelayOptions {
  delayMs?: number;
  isLoading?: boolean;
}

/**
 * Custom hook to delay rendering skeleton loaders by a small window (default 200ms).
 * Prevents distracting skeleton flashes when network responses arrive rapidly (<200ms).
 */
export function useSkeletonDelay(isLoading: boolean = true, delayMs: number = 200): boolean {
  const [showSkeleton, setShowSkeleton] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setShowSkeleton(false);
      return;
    }

    const timer = setTimeout(() => {
      setShowSkeleton(true);
    }, delayMs);

    return () => {
      clearTimeout(timer);
    };
  }, [isLoading, delayMs]);

  return showSkeleton;
}
