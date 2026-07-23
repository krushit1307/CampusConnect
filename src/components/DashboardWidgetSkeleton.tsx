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
