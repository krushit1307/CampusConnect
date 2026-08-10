import { Skeleton } from "@/components/ui/skeleton";

/**
 * RouteSkeleton
 *
 * A modern, accessible Tailwind/Radix Skeleton loader fallback
 * used during React.lazy route transitions and code-splitting boundaries.
 */
export function RouteSkeleton() {
  return (
    <div
      role="status"
      aria-label="Loading page content..."
      className="mx-auto w-full max-w-7xl space-y-8 p-4 md:p-8 animate-pulse"
    >
      {/* Top Banner / Header Skeleton */}
      <div className="neu-border bg-white p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48 bg-gray-200" />
          <Skeleton className="h-10 w-28 bg-gray-200" />
        </div>
        <Skeleton className="h-4 w-3/4 bg-gray-200" />
        <Skeleton className="h-4 w-1/2 bg-gray-200" />
      </div>

      {/* Grid Content Skeletons */}
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="neu-border bg-white p-5 space-y-4 shadow-sm">
            <Skeleton className="h-40 w-full rounded bg-gray-200" />
            <Skeleton className="h-6 w-5/6 bg-gray-200" />
            <Skeleton className="h-4 w-full bg-gray-200" />
            <Skeleton className="h-4 w-2/3 bg-gray-200" />
            <div className="flex justify-between pt-2">
              <Skeleton className="h-8 w-20 bg-gray-200" />
              <Skeleton className="h-8 w-24 bg-gray-200" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default RouteSkeleton;
