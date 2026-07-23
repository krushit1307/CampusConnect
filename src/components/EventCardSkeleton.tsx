import { Skeleton } from "@/components/ui/skeleton";

export function EventCardSkeleton({ index = 0 }: { index?: number }) {
  const delays = ["delay-75", "delay-150", "delay-300", "delay-500"];
  const delayClass = delays[index % delays.length];

  return (
    <article
      className={`neu-border bg-white p-5 animate-pulse ${delayClass}`}
      role="status"
      aria-live="polite"
    >
      <div>
        {/* Date pill */}
        <Skeleton className="h-3 w-24" />

        {/* "Event" label */}
        <Skeleton className="mt-3 h-3 w-14" />

        {/* Title */}
        <Skeleton className="mt-2 h-7 w-4/5" />

        {/* Club name */}
        <Skeleton className="mt-2 h-4 w-32" />

        {/* Description lines */}
        <div className="mt-4 space-y-2">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
        </div>

        {/* Date / Venue / Attendees row */}
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-4 w-20" />
          </div>
          <div>
            <Skeleton className="h-3 w-12" />
            <Skeleton className="mt-2 h-4 w-16" />
          </div>
          <div>
            <Skeleton className="h-3 w-16" />
            <Skeleton className="mt-2 h-4 w-14" />
          </div>
        </div>

        {/* RSVP button */}
        <Skeleton className="mt-5 h-9 w-28" />
      </div>

      <span className="sr-only">Loading event...</span>
    </article>
  );
}
