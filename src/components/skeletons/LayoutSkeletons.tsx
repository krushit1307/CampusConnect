import React from "react";
import { useLocation } from "react-router-dom";
import { useSkeletonDelay } from "@/hooks/useSkeletonDelay";
import { cn } from "@/lib/utils";

/**
 * Base Skeleton block primitive for layout placeholders.
 */
export const SkeletonBlock: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted/80 dark:bg-gray-800", className)}
      {...props}
    />
  );
};

/**
 * Feed Layout Skeleton (#1736)
 * Tailored skeleton placeholder for Feed / Social Stream layout.
 */
export const FeedSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      data-testid="feed-skeleton"
      role="status"
      aria-label="Loading feed page..."
      className={cn("max-w-4xl mx-auto space-y-6 p-4 md:p-6 font-mono", className)}
    >
      {/* Create Post Box Placeholder */}
      <div className="neu-border bg-white p-4 rounded-xl space-y-3 shadow-sm">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
          <SkeletonBlock className="h-10 flex-1 rounded-lg bg-muted/70 animate-pulse" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <div className="flex gap-2">
            <SkeletonBlock className="h-7 w-20 rounded bg-muted/60 animate-pulse" />
            <SkeletonBlock className="h-7 w-20 rounded bg-muted/60 animate-pulse" />
          </div>
          <SkeletonBlock className="h-8 w-24 rounded-lg bg-primary/20 animate-pulse" />
        </div>
      </div>

      {/* Stream of Feed Posts */}
      {[1, 2, 3].map((item) => (
        <div
          key={`feed-item-skel-${item}`}
          className="neu-border bg-white p-5 rounded-xl space-y-4 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <SkeletonBlock className="w-11 h-11 rounded-full bg-muted animate-pulse" />
              <div className="space-y-1.5">
                <SkeletonBlock className="h-4 w-36 bg-muted/80 animate-pulse" />
                <SkeletonBlock className="h-3 w-24 bg-muted/60 animate-pulse" />
              </div>
            </div>
            <SkeletonBlock className="h-6 w-16 rounded bg-muted/50 animate-pulse" />
          </div>
          <div className="space-y-2">
            <SkeletonBlock className="h-4 w-full bg-muted/70 animate-pulse" />
            <SkeletonBlock className="h-4 w-5/6 bg-muted/70 animate-pulse" />
            <SkeletonBlock className="h-4 w-2/3 bg-muted/70 animate-pulse" />
          </div>
          <SkeletonBlock className="h-56 w-full rounded-lg bg-muted/60 animate-pulse" />
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <SkeletonBlock className="h-8 w-20 rounded bg-muted/50 animate-pulse" />
            <SkeletonBlock className="h-8 w-20 rounded bg-muted/50 animate-pulse" />
            <SkeletonBlock className="h-8 w-20 rounded bg-muted/50 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * Directory Layout Skeleton (#1736)
 * Tailored skeleton placeholder for Clubs & Events Directory grid pages.
 */
export const DirectorySkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      data-testid="directory-skeleton"
      role="status"
      aria-label="Loading directory page..."
      className={cn("max-w-7xl mx-auto space-y-8 p-4 md:p-8 font-mono", className)}
    >
      {/* Search Header & Filter Pills */}
      <div className="neu-border bg-white p-6 rounded-xl space-y-4 shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
          <SkeletonBlock className="h-10 w-full md:w-80 rounded-lg bg-muted animate-pulse" />
          <div className="flex gap-2 w-full md:w-auto">
            <SkeletonBlock className="h-9 w-24 rounded-lg bg-muted/70 animate-pulse" />
            <SkeletonBlock className="h-9 w-24 rounded-lg bg-muted/70 animate-pulse" />
            <SkeletonBlock className="h-9 w-24 rounded-lg bg-muted/70 animate-pulse" />
          </div>
        </div>
      </div>

      {/* 3-Column Responsive Grid Skeletons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={`dir-card-skel-${i}`}
            className="neu-border bg-white rounded-xl overflow-hidden space-y-4 shadow-sm p-4"
          >
            <SkeletonBlock className="h-44 w-full rounded-lg bg-muted/80 animate-pulse" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-24 rounded bg-primary/20 animate-pulse" />
              <SkeletonBlock className="h-6 w-3/4 rounded bg-muted/90 animate-pulse" />
              <SkeletonBlock className="h-4 w-full rounded bg-muted/60 animate-pulse" />
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-100">
              <SkeletonBlock className="h-6 w-28 rounded bg-muted/50 animate-pulse" />
              <SkeletonBlock className="h-9 w-24 rounded-lg bg-black/80 animate-pulse" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Detail View Layout Skeleton (#1736)
 * Tailored skeleton placeholder for Event Detail, Club Detail, and Profile View pages.
 */
export const DetailSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div
      data-testid="detail-skeleton"
      role="status"
      aria-label="Loading detail page..."
      className={cn("max-w-6xl mx-auto space-y-8 p-4 md:p-8 font-mono", className)}
    >
      {/* Large Hero Banner Image */}
      <SkeletonBlock className="h-72 w-full rounded-2xl bg-muted/90 animate-pulse neu-border" />

      {/* Header Info Row */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-6 w-28 rounded bg-primary/20 animate-pulse" />
          <SkeletonBlock className="h-6 w-20 rounded bg-muted/60 animate-pulse" />
        </div>
        <SkeletonBlock className="h-10 w-3/4 rounded-lg bg-muted/90 animate-pulse" />
        <div className="flex items-center gap-4">
          <SkeletonBlock className="w-10 h-10 rounded-full bg-muted animate-pulse" />
          <SkeletonBlock className="h-5 w-44 rounded bg-muted/70 animate-pulse" />
        </div>
      </div>

      {/* 2-Column Content & Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex gap-4 border-b border-gray-200 pb-3">
            <SkeletonBlock className="h-8 w-24 rounded bg-muted/80 animate-pulse" />
            <SkeletonBlock className="h-8 w-24 rounded bg-muted/60 animate-pulse" />
            <SkeletonBlock className="h-8 w-24 rounded bg-muted/60 animate-pulse" />
          </div>
          <div className="space-y-3">
            <SkeletonBlock className="h-4 w-full bg-muted/70 animate-pulse" />
            <SkeletonBlock className="h-4 w-11/12 bg-muted/70 animate-pulse" />
            <SkeletonBlock className="h-4 w-4/5 bg-muted/70 animate-pulse" />
            <SkeletonBlock className="h-4 w-full bg-muted/70 animate-pulse" />
          </div>
          <SkeletonBlock className="h-48 w-full rounded-xl bg-muted/60 animate-pulse" />
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="neu-border bg-white p-6 rounded-xl space-y-5 shadow-sm">
            <SkeletonBlock className="h-7 w-36 bg-muted/80 animate-pulse" />
            <SkeletonBlock className="h-12 w-full rounded-lg bg-lime/30 animate-pulse" />
            <div className="space-y-2">
              <SkeletonBlock className="h-4 w-full bg-muted/60 animate-pulse" />
              <SkeletonBlock className="h-4 w-3/4 bg-muted/60 animate-pulse" />
            </div>
            <SkeletonBlock className="h-36 w-full rounded-lg bg-muted/50 animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
};

export interface PageSkeletonLoaderProps {
  forcedLayout?: "feed" | "directory" | "detail";
  delayMs?: number;
  className?: string;
}

/**
 * Dynamic PageSkeletonLoader Component (#1736)
 * Detects current route layout (Feed, Directory, or Detail view) and renders the matching skeleton,
 * with a 200ms delay to prevent skeleton flickering on ultra-fast networks.
 */
export const PageSkeletonLoader: React.FC<PageSkeletonLoaderProps> = ({
  forcedLayout,
  delayMs = 200,
  className,
}) => {
  const location = useLocation();
  const showSkeleton = useSkeletonDelay(true, delayMs);

  if (!showSkeleton) {
    return null;
  }

  const pathname = location.pathname.toLowerCase();

  // Determine layout type based on route matching
  let layoutType: "feed" | "directory" | "detail" = forcedLayout || "directory";

  if (!forcedLayout) {
    if (pathname.includes("/feed") || pathname === "/") {
      layoutType = "feed";
    } else if (
      pathname.match(/\/events\/[^/]+/) ||
      pathname.match(/\/clubs\/[^/]+/) ||
      pathname.match(/\/profile\/[^/]+/) ||
      pathname.includes("/verify")
    ) {
      layoutType = "detail";
    } else {
      layoutType = "directory";
    }
  }

  if (layoutType === "feed") {
    return <FeedSkeleton className={className} />;
  }
  if (layoutType === "detail") {
    return <DetailSkeleton className={className} />;
  }
  return <DirectorySkeleton className={className} />;
};
