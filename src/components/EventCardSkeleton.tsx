import { Skeleton } from "@/components/ui/skeleton";

const COLORS = ["bg-lime", "bg-sky", "bg-peach"];
const DELAYS = ["delay-75", "delay-150", "delay-300", "delay-500"];

export function EventCardSkeleton({ index = 0 }: { index?: number }) {
  const bg = COLORS[index % COLORS.length];
  const delay = DELAYS[index % DELAYS.length];

  return (
    <article
      className={`neu-border p-5 relative animate-pulse ${bg} ${delay}`}
      role="status"
      aria-live="polite"
    >
      {/* Top row: date + icons */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-8 shrink-0 rounded-none" />
          <Skeleton className="h-8 w-8 shrink-0 rounded-none" />
        </div>
      </div>

      {/* "Event" label */}
      <Skeleton className="mt-3 h-3 w-14" />

      {/* Title */}
      <Skeleton className="mt-2 h-7 w-4/5" />

      {/* Club name */}
      <Skeleton className="mt-2 h-4 w-32" />

      {/* Description */}
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-2/3" />
      </div>

      {/* Progress bar */}
      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <Skeleton className="h-2 w-20" />
          <Skeleton className="h-2 w-8" />
        </div>
        <Skeleton className="h-4 w-full" />
      </div>

      {/* Date / Venue / Attendees row */}
      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-1 h-4 w-20" />
        </div>
        <div>
          <Skeleton className="h-3 w-12" />
          <Skeleton className="mt-1 h-4 w-16" />
        </div>
        <div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="mt-1 h-4 w-14" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Social share links */}
      <div className="mt-4 flex gap-2">
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>

      <span className="sr-only">Loading event...</span>
    </article>
  );
}
