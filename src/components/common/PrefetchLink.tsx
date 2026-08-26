import React, { useRef, useEffect, useCallback } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { useQueryClient, type QueryKey, type QueryFunction } from "@tanstack/react-query";

interface NetworkInformation extends EventTarget {
  readonly saveData?: boolean;
  readonly effectiveType?: "slow-2g" | "2g" | "3g" | "4g";
}

export interface PrefetchQueryConfig<T = unknown> {
  queryKey: QueryKey;
  queryFn: QueryFunction<T>;
  staleTime?: number;
}

export interface PrefetchLinkProps extends LinkProps {
  queryKey?: QueryKey;
  queryFn?: QueryFunction<unknown>;
  staleTime?: number;
  queries?: PrefetchQueryConfig[];
  debounceMs?: number;
  prefetchOnViewport?: boolean;
  children: React.ReactNode;
}

/**
 * Checks if user is on a data-saving or constrained connection.
 */
export function isSaveDataOrSlowNetwork(): boolean {
  if (typeof navigator === "undefined") return false;
  const nav = navigator as Navigator & { connection?: NetworkInformation };
  if (nav.connection?.saveData) return true;
  if (nav.connection?.effectiveType === "slow-2g" || nav.connection?.effectiveType === "2g") {
    return true;
  }
  return false;
}

/**
 * PrefetchLink: Wrapper around React Router Link that dynamically prefetches
 * query data on hover intent (50ms debounce) or mobile viewport entry.
 */
export function PrefetchLink({
  to,
  queryKey,
  queryFn,
  staleTime = 60 * 1000, // 1 minute default stale time for prefetched cache
  queries,
  debounceMs = 50,
  prefetchOnViewport = true,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  children,
  ...restProps
}: PrefetchLinkProps) {
  const queryClient = useQueryClient();
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const elementRef = useRef<HTMLAnchorElement | null>(null);
  const prefetchedRef = useRef(false);

  const executePrefetch = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;

    // Single query config
    if (queryKey && queryFn) {
      queryClient.prefetchQuery({
        queryKey,
        queryFn,
        staleTime,
      });
    }

    // Multiple queries config
    if (queries && queries.length > 0) {
      for (const q of queries) {
        queryClient.prefetchQuery({
          queryKey: q.queryKey,
          queryFn: q.queryFn,
          staleTime: q.staleTime ?? staleTime,
        });
      }
    }
  }, [queryClient, queryKey, queryFn, queries, staleTime]);

  const handleMouseEnter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onMouseEnter) onMouseEnter(e);

    if (debounceTimerRefActive()) {
      clearTimeout(hoverTimerRef.current!);
    }

    hoverTimerRef.current = setTimeout(() => {
      executePrefetch();
    }, debounceMs);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onMouseLeave) onMouseLeave(e);
    if (debounceTimerRefActive()) {
      clearTimeout(hoverTimerRef.current!);
      hoverTimerRef.current = null;
    }
  };

  const handleFocus = (e: React.FocusEvent<HTMLAnchorElement>) => {
    if (onFocus) onFocus(e);
    executePrefetch();
  };

  const debounceTimerRefActive = () => hoverTimerRef.current !== null;

  // Viewport intersection observer for mobile devices without hover capability
  useEffect(() => {
    if (!prefetchOnViewport || typeof IntersectionObserver === "undefined") return;
    if (isSaveDataOrSlowNetwork()) return; // strictly respect data plan

    const isTouchOrMobile =
      typeof window !== "undefined" &&
      (window.matchMedia?.("(hover: none)").matches ||
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0);

    if (!isTouchOrMobile) return;

    const el = elementRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            executePrefetch();
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "100px" },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [prefetchOnViewport, executePrefetch]);

  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  return (
    <Link
      ref={elementRef}
      to={to}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onFocus={handleFocus}
      {...restProps}
    >
      {children}
    </Link>
  );
}
