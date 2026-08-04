import { OrganicSkeleton, TextSkeleton } from "@/components/ui/OrganicSkeleton";

interface FeedPostSkeletonProps {
  index?: number;
}

export function FeedPostSkeleton({ index = 0 }: FeedPostSkeletonProps) {
  return (
    <article className="neu-border bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] font-mono">
      <header className="mb-4 flex items-center justify-between gap-3 border-b-2 border-black pb-3">
        <div className="flex items-center gap-3 w-full">
          <OrganicSkeleton width="40px" height="h-10" className="rounded-full flex-shrink-0" />
          <div className="space-y-1.5 flex-1">
            <OrganicSkeleton width="55%" height="h-4" seed={`post-title-${index}`} />
            <OrganicSkeleton width="30%" height="h-3" seed={`post-sub-${index}`} />
          </div>
        </div>
      </header>

      {/* Jagged Organic Paragraph Skeleton */}
      <div className="my-4">
        <TextSkeleton lines={3} seed={`feed-post-body-${index}`} />
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <OrganicSkeleton width="70px" height="h-8" className="rounded-none border border-black" />
          <OrganicSkeleton width="70px" height="h-8" className="rounded-none border border-black" />
        </div>
        <OrganicSkeleton width="80px" height="h-7" className="rounded-none" />
      </div>
    </article>
  );
}
