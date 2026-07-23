import { Skeleton } from "@/components/ui/skeleton";

export function WidgetListSkeleton({ rows = 3 }: { rows?: number }) {
  const delays = [
    "animate-pulse delay-75",
    "animate-pulse delay-150",
    "animate-pulse delay-300",
    "animate-pulse delay-500",
  ];

  return (
    <ul className="divide-y-2 divide-black">
      {Array.from({ length: rows }).map((_, i) => (
        <li key={i} className="flex items-center gap-4 py-4">
          <Skeleton className={`h-12 w-16 shrink-0 rounded-none ${delays[i % delays.length]}`} />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className={`h-5 w-3/4 rounded-none ${delays[i % delays.length]}`} />
            <Skeleton className={`h-3 w-1/2 rounded-none ${delays[i % delays.length]}`} />
          </div>
          <Skeleton className={`h-8 w-20 shrink-0 rounded-none ${delays[i % delays.length]}`} />
        </li>
      ))}
    </ul>
  );
}

export function TrendingCarouselSkeleton() {
  const delays = ["animate-pulse delay-75", "animate-pulse delay-150", "animate-pulse delay-300"];

  return (
    <div className="mb-8 w-full">
      <div className="mb-4 flex items-center gap-2">
        <Skeleton className={`h-6 w-6 rounded-none ${delays[0]}`} />
        <Skeleton className={`h-6 w-40 rounded-none ${delays[1]}`} />
      </div>
      <div className="flex gap-4 overflow-hidden py-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-40 min-w-[280px] shrink-0 md:min-w-[320px] rounded-none ${delays[i % delays.length]}`}
          />
        ))}
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  const delays = ["animate-pulse delay-75", "animate-pulse delay-150", "animate-pulse delay-300"];

  return (
    <div className="space-y-6">
      {/* Header bar of calendar */}
      <div className="flex flex-col justify-between gap-4 border-b-2 border-black pb-5 dark:border-cream sm:flex-row sm:items-end">
        <div className="space-y-2 w-full">
          <Skeleton className={`h-4 w-32 rounded-none ${delays[0]}`} />
          <Skeleton className={`h-8 w-64 rounded-none ${delays[1]}`} />
          <Skeleton className={`h-4 w-5/6 max-w-xl rounded-none ${delays[2]}`} />
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="neu-border bg-white p-4 dark:bg-black">
        {/* Month header selector skeleton */}
        <div className="mb-6 flex items-center justify-between border-b-2 border-black pb-4">
          <Skeleton className="h-8 w-40 rounded-none animate-pulse" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-8 rounded-none animate-pulse" />
            <Skeleton className="h-8 w-8 rounded-none animate-pulse" />
          </div>
        </div>

        {/* Days of week skeleton (7 cols) */}
        <div className="grid grid-cols-7 gap-2 mb-2 text-center">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full rounded-none animate-pulse" />
          ))}
        </div>

        {/* Days grid (7 columns x 5 rows) */}
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: 35 }).map((_, i) => {
            const hasEvent = i === 12 || i === 19 || i === 25;
            return (
              <div
                key={i}
                className="neu-border flex min-h-[85px] flex-col justify-between bg-cream p-1.5 dark:bg-brand-gray-base-800 md:min-h-[105px]"
              >
                <Skeleton className="h-4 w-5 rounded-none animate-pulse" />
                {hasEvent && (
                  <Skeleton className="mt-1 h-8 w-full rounded-none bg-sky/30 border border-black animate-pulse" />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ClubManageSkeleton() {
  const delays = ["animate-pulse delay-75", "animate-pulse delay-150", "animate-pulse delay-300"];

  return (
    <div className="bg-cream min-h-screen">
      {/* Header Skeleton */}
      <header className="border-b-2 border-black bg-white px-4 py-8">
        <div className="max-w-5xl mx-auto space-y-3">
          <Skeleton className={`h-8 w-80 rounded-none ${delays[0]}`} />
          <Skeleton className={`h-4 w-40 rounded-none ${delays[1]}`} />
        </div>
      </header>

      {/* Main Content Area Skeleton */}
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        {/* Sidebar Menu Skeleton */}
        <aside className="w-full md:w-64 shrink-0">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton
                key={i}
                className={`h-14 w-full rounded-none border-2 border-black ${delays[i % delays.length]}`}
              />
            ))}
          </div>
        </aside>

        {/* Form Panel Skeleton */}
        <main className="flex-1">
          <div className="neu-border bg-white p-6 space-y-6">
            <Skeleton className="h-7 w-48 rounded-none animate-pulse" />
            <hr className="border-black border" />
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-4 w-16 rounded-none animate-pulse" />
                <Skeleton className="h-10 w-full rounded-none border border-black animate-pulse" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-24 rounded-none animate-pulse" />
                <Skeleton className="h-28 w-full rounded-none border border-black animate-pulse" />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28 rounded-none animate-pulse" />
                  <Skeleton className="h-10 w-full rounded-none border border-black animate-pulse" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-4 w-28 rounded-none animate-pulse" />
                  <Skeleton className="h-10 w-full rounded-none border border-black animate-pulse" />
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <Skeleton className="h-11 w-32 rounded-none border-2 border-black bg-black animate-pulse" />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
