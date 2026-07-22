import { SiteShell } from "@/components/site/SiteShell";
import { Skeleton } from "@/components/ui/skeleton";

export function SkeletonEventDetails() {
  return (
    <SiteShell>
      {/* Banner / Hero section skeleton */}
      <section
        className="border-b-2 border-black bg-peach/30 px-4 py-8 md:px-6 md:py-12"
        role="status"
        aria-live="polite"
      >
        <div className="mx-auto max-w-4xl">
          {/* Banner placeholder */}
          <Skeleton className="neu-border h-48 w-full md:h-80 bg-black/10" />
        </div>
      </section>

      {/* Main content skeleton */}
      <section className="bg-cream px-4 py-12 md:px-6">
        <div className="mx-auto max-w-4xl neu-border bg-white p-6 md:p-8">
          <div className="animate-pulse">
            {/* Category / Eyebrow */}
            <Skeleton className="h-4 w-20 bg-black/10" />

            {/* Title */}
            <Skeleton className="mt-4 h-10 w-3/4 md:h-12 bg-black/10" />

            {/* Organizer / Club */}
            <Skeleton className="mt-3 h-5 w-40 bg-black/10" />

            {/* Meta Grid (Date, Venue, Attendees) */}
            <div className="mt-8 grid gap-6 border-y-2 border-black/10 py-6 sm:grid-cols-3">
              <div className="space-y-2 text-black">
                <Skeleton className="h-3 w-24 bg-black/10" />
                <Skeleton className="h-5 w-32 bg-black/10" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16 bg-black/10" />
                <Skeleton className="h-5 w-28 bg-black/10" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20 bg-black/10" />
                <Skeleton className="h-5 w-24 bg-black/10" />
              </div>
            </div>

            {/* RSVP / Action buttons */}
            <div className="mt-8 flex flex-wrap gap-4 border-b-2 border-black/10 pb-8">
              <Skeleton className="h-10 w-36 bg-black/10" />
              <Skeleton className="h-10 w-28 bg-black/10" />
            </div>

            {/* Description section */}
            <div className="mt-8 space-y-4">
              <Skeleton className="h-4 w-28 bg-black/10" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-full bg-black/10" />
                <Skeleton className="h-3 w-full bg-black/10" />
                <Skeleton className="h-3 w-5/6 bg-black/10" />
                <Skeleton className="h-3 w-full bg-black/10" />
                <Skeleton className="h-3 w-3/4 bg-black/10" />
              </div>
            </div>

            {/* Share / Social section */}
            <div className="mt-10 pt-6 border-t-2 border-black/10">
              <Skeleton className="h-4 w-32 bg-black/10" />
              <div className="mt-4 flex gap-3">
                <Skeleton className="h-9 w-24 bg-black/10" />
                <Skeleton className="h-9 w-24 bg-black/10" />
                <Skeleton className="h-9 w-24 bg-black/10" />
              </div>
            </div>
          </div>
        </div>
      </section>
      <span className="sr-only">Loading event details...</span>
    </SiteShell>
  );
}
