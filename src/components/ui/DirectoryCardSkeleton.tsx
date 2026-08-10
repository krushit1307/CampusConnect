import { Skeleton } from "@/components/ui/skeleton";

export function DirectoryCardSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 border-b h-full">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div>
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-48 mt-1" />
          <Skeleton className="h-3 w-24 mt-1" />
        </div>
      </div>
      <div className="text-right flex flex-col items-end">
        <Skeleton className="h-4 w-14" />
        <div className="flex gap-1 mt-1">
          <Skeleton className="h-4 w-12 rounded-full" />
          <Skeleton className="h-4 w-14 rounded-full" />
        </div>
      </div>
    </div>
  );
}
