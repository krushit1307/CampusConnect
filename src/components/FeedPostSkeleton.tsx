import { Skeleton } from "@/components/ui/skeleton";

export function FeedPostSkeleton() {
  return (
    <article className="neu-border bg-white p-6">
      <header className="mb-3 flex items-center justify-between gap-2 border-b-2 border-black pb-3">
        <div>
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3.5 w-64" />
        </div>
      </header>

      <div className="mt-4 space-y-2.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="mt-4 flex gap-2">
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
        <Skeleton className="h-8 w-16" />
      </div>
    </article>
  );
}
