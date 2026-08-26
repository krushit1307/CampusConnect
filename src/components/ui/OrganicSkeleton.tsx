import React from "react";
import { cn } from "@/lib/utils";
import { getOrganicLineWidth, getParagraphLineWidths } from "@/lib/deterministicSkeletonUtils";

export interface OrganicSkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Width override or 'organic' for deterministic jagged width */
  width?: string | "organic";
  /** Height of the skeleton bar (default: "h-4") */
  height?: string;
  /** Seed for deterministic width generation */
  seed?: number | string;
  /** Index when rendering inside a list or paragraph */
  index?: number;
  /** Total lines in paragraph for end-line shortening */
  totalLines?: number;
  /** Enables smooth shimmering gradient wave animation */
  shimmer?: boolean;
}

/**
 * Base Organic Skeleton Component (#2328)
 * Renders an accessible, SSR-hydration-safe placeholder element with optional shimmer wave.
 */
export const OrganicSkeleton: React.FC<OrganicSkeletonProps> = ({
  className,
  width = "organic",
  height = "h-4",
  seed,
  index = 0,
  totalLines = 1,
  shimmer = true,
  style,
  ...props
}) => {
  const calculatedWidth =
    width === "organic" ? getOrganicLineWidth(index, totalLines, seed) : width;

  return (
    <div
      aria-hidden="true"
      role="presentation"
      className={cn(
        "relative overflow-hidden rounded-md bg-slate-200/80 dark:bg-slate-800/80 transition-all",
        height,
        shimmer &&
          "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_1.8s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/40 before:to-transparent dark:before:via-white/10",
        !shimmer && "animate-pulse",
        className,
      )}
      style={{
        width: calculatedWidth,
        ...style,
      }}
      {...props}
    />
  );
};

export interface TextSkeletonProps {
  /** Number of text lines to render (default: 3) */
  lines?: number;
  /** Line height spacing (e.g. "h-4", "h-3.5", "h-5") */
  lineHeight?: string;
  /** Gap between lines (e.g. "space-y-2.5") */
  lineGap?: string;
  /** Seed for deterministic jagged widths across lines */
  seed?: number | string;
  /** Additional container classes */
  className?: string;
}

/**
 * TextSkeleton Component
 * Renders jagged, organic text line placeholders that mimic real human paragraph lengths.
 * Guaranteed zero React Hydration Mismatch errors.
 */
export const TextSkeleton: React.FC<TextSkeletonProps> = ({
  lines = 3,
  lineHeight = "h-4",
  lineGap = "space-y-2.5",
  seed,
  className,
}) => {
  const widths = getParagraphLineWidths(lines, seed);

  return (
    <div className={cn("w-full", lineGap, className)} data-testid="text-skeleton-container">
      {widths.map((w, idx) => (
        <OrganicSkeleton
          key={`organic-line-${idx}`}
          width={w}
          height={lineHeight}
          index={idx}
          totalLines={lines}
        />
      ))}
    </div>
  );
};

export interface ParagraphSkeletonProps {
  /** Number of paragraphs (default: 2) */
  paragraphs?: number;
  /** Number of lines per paragraph (default: 3) */
  linesPerParagraph?: number;
  /** Seed for deterministic randomness */
  seed?: number | string;
  className?: string;
}

/**
 * ParagraphSkeleton Component
 * Renders multiple jagged text paragraphs separated by paragraph spacing.
 */
export const ParagraphSkeleton: React.FC<ParagraphSkeletonProps> = ({
  paragraphs = 2,
  linesPerParagraph = 3,
  seed,
  className,
}) => {
  return (
    <div className={cn("space-y-5 w-full", className)}>
      {Array.from({ length: paragraphs }).map((_, pIdx) => (
        <TextSkeleton
          key={`para-${pIdx}`}
          lines={linesPerParagraph}
          seed={seed !== undefined ? `${seed}-p${pIdx}` : pIdx}
        />
      ))}
    </div>
  );
};

export interface OrganicCardSkeletonProps {
  variant?: "post" | "club" | "event" | "profile" | "comment";
  className?: string;
}

/**
 * OrganicCardSkeleton Component
 * Pre-configured organic skeletons for common UI cards across CampusConnect.
 */
export const OrganicCardSkeleton: React.FC<OrganicCardSkeletonProps> = ({
  variant = "post",
  className,
}) => {
  switch (variant) {
    case "post":
      return (
        <article className={cn("neu-border bg-white p-6 rounded-none space-y-4", className)}>
          {/* Post Header */}
          <div className="flex items-center gap-3 border-b-2 border-black pb-3">
            <OrganicSkeleton width="48px" height="h-12" className="rounded-full flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <OrganicSkeleton width="60%" height="h-4" seed="author-name" />
              <OrganicSkeleton width="35%" height="h-3" seed="author-meta" />
            </div>
          </div>

          {/* Jagged Body Content */}
          <TextSkeleton lines={4} seed="post-body-content" />

          {/* Media / Image Placeholder */}
          <OrganicSkeleton width="100%" height="h-48" className="rounded-lg my-3" />

          {/* Post Action Buttons */}
          <div className="flex items-center gap-3 pt-2">
            <OrganicSkeleton width="80px" height="h-8" className="rounded-md" />
            <OrganicSkeleton width="80px" height="h-8" className="rounded-md" />
            <OrganicSkeleton width="80px" height="h-8" className="rounded-md" />
          </div>
        </article>
      );

    case "comment":
      return (
        <div
          className={cn("flex gap-3 p-4 bg-slate-50 border border-slate-200 rounded-xl", className)}
        >
          <OrganicSkeleton width="36px" height="h-9" className="rounded-full flex-shrink-0" />
          <div className="space-y-2 flex-1">
            <div className="flex justify-between items-center">
              <OrganicSkeleton width="120px" height="h-3.5" seed="commenter" />
              <OrganicSkeleton width="60px" height="h-3" seed="comment-time" />
            </div>
            <TextSkeleton lines={2} lineHeight="h-3.5" seed="comment-text" />
          </div>
        </div>
      );

    case "club":
      return (
        <div className={cn("neu-border bg-white p-6 space-y-4", className)}>
          <div className="flex items-center gap-4">
            <OrganicSkeleton width="64px" height="h-16" className="rounded-xl flex-shrink-0" />
            <div className="space-y-2 flex-1">
              <OrganicSkeleton width="75%" height="h-5" seed="club-title" />
              <OrganicSkeleton width="45%" height="h-3.5" seed="club-category" />
            </div>
          </div>
          <TextSkeleton lines={3} seed="club-desc" />
          <div className="flex justify-between items-center pt-2">
            <OrganicSkeleton width="100px" height="h-6" className="rounded-full" />
            <OrganicSkeleton width="90px" height="h-8" className="rounded-lg" />
          </div>
        </div>
      );

    case "event":
      return (
        <div className={cn("neu-border bg-white overflow-hidden space-y-4 p-5", className)}>
          <OrganicSkeleton width="100%" height="h-40" className="rounded-lg" />
          <div className="space-y-2">
            <OrganicSkeleton width="40%" height="h-3.5" seed="event-badge" />
            <OrganicSkeleton width="85%" height="h-6" seed="event-title" />
          </div>
          <TextSkeleton lines={2} seed="event-desc" />
          <div className="flex items-center justify-between border-t pt-3">
            <OrganicSkeleton width="110px" height="h-4" seed="event-date" />
            <OrganicSkeleton width="80px" height="h-9" className="rounded-md" />
          </div>
        </div>
      );

    case "profile":
    default:
      return (
        <div className={cn("neu-border bg-white p-6 space-y-6", className)}>
          <div className="flex items-center gap-5">
            <OrganicSkeleton
              width="80px"
              height="h-20"
              className="rounded-full border-2 border-black"
            />
            <div className="space-y-2.5 flex-1">
              <OrganicSkeleton width="55%" height="h-6" seed="prof-name" />
              <OrganicSkeleton width="35%" height="h-4" seed="prof-handle" />
            </div>
          </div>
          <TextSkeleton lines={3} seed="prof-bio" />
        </div>
      );
  }
};
