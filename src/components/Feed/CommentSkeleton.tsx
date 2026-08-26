import { Skeleton } from "@/components/ui/skeleton";

interface CommentSkeletonProps {
  /** Visual nesting depth: 0 = root, 1 = first reply, 2 = second reply (max) */
  depth?: number;
  /** Whether to render simulated nested children beneath this comment */
  showChildren?: boolean;
}

/**
 * Single comment skeleton — mirrors the exact shape of a rendered comment node
 * in the feed:  neu-border box  →  author row  →  content lines  →  reply link.
 *
 * Indentation matches the live renderCommentNode logic:
 *   depth 0 → no indent
 *   depth 1 → ml-4
 *   depth 2 → ml-8
 */
export function CommentSkeleton({ depth = 0, showChildren = false }: CommentSkeletonProps) {
  const indentClass = depth === 1 ? "ml-4" : depth >= 2 ? "ml-8" : "";

  return (
    <div className={indentClass}>
      {/* Comment card — same classes as the real comment: neu-border bg-cream p-3 mb-3 */}
      <div className="neu-border bg-cream p-3 mb-3 animate-pulse">
        {/* Header row: author name + timestamp placeholder */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {/* Author name */}
            <Skeleton className="h-3 w-24 rounded-none bg-black/10" />
            {/* Role badge */}
            <Skeleton className="h-4 w-12 rounded-none bg-black/10 delay-75" />
          </div>
          {/* Timestamp */}
          <Skeleton className="h-2.5 w-10 rounded-none bg-black/10 delay-75" />
        </div>

        {/* Comment body — 1-3 lines depending on depth to look natural */}
        <div className="mt-2 space-y-1.5">
          <Skeleton className="h-3 w-full rounded-none bg-black/10 delay-150" />
          {depth === 0 && <Skeleton className="h-3 w-4/5 rounded-none bg-black/10 delay-300" />}
        </div>

        {/* Reply action link */}
        <div className="mt-2">
          <Skeleton className="h-2.5 w-8 rounded-none bg-black/10 delay-500" />
        </div>
      </div>

      {/* Simulated nested children */}
      {showChildren && depth < 2 && (
        <div className="space-y-0">
          <CommentSkeleton depth={depth + 1} showChildren={depth === 0} />
        </div>
      )}
    </div>
  );
}

interface CommentThreadSkeletonProps {
  /**
   * Number of root-level comment skeletons to render.
   * Defaults to 3 to give the thread a realistic initial height.
   */
  count?: number;
}

/**
 * Full comment thread skeleton.
 *
 * Renders `count` root comments, with the first two having simulated
 * child replies so the indented hierarchy is immediately visible and the
 * layout height closely matches a real loaded thread.
 *
 * Usage:
 *   {isLoading && <CommentThreadSkeleton />}
 *   {!isLoading && <CommentThread comments={comments} />}
 */
export function CommentThreadSkeleton({ count = 3 }: CommentThreadSkeletonProps) {
  return (
    <div role="status" aria-live="polite" aria-label="Loading comments">
      {Array.from({ length: count }).map((_, i) => (
        <CommentSkeleton
          key={i}
          depth={0}
          // Give the first two root comments simulated child replies
          showChildren={i < 2}
        />
      ))}
      <span className="sr-only">Loading comments…</span>
    </div>
  );
}
