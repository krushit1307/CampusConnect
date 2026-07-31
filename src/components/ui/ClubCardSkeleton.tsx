import { Skeleton } from "@/components/ui/skeleton";

export function ClubCardSkeleton() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-md border border-gray-100 dark:border-gray-700 flex flex-col justify-between space-y-4">
      {/* Thumbnail Skeleton */}
      <Skeleton className="w-full h-36 rounded-lg" />

      {/* Title & Description Skeletons */}
      <div className="space-y-2">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>

      {/* Footer Skeleton */}
      <div className="pt-2 flex items-center justify-between">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-6 w-6 rounded-full" />
      </div>
    </div>
  );
}
