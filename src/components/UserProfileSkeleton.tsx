import { Skeleton } from "@/components/ui/skeleton";

export function UserProfileSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto p-4 md:p-6 lg:p-8 space-y-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
        {/* Avatar Skeleton */}
        <Skeleton className="h-32 w-32 rounded-full shrink-0" />
        
        {/* User Info Skeleton */}
        <div className="flex flex-col gap-3 w-full mt-4 md:mt-2 items-center md:items-start">
          <Skeleton className="h-8 w-3/4 md:w-1/3" />
          <Skeleton className="h-4 w-full md:w-1/2" />
          <Skeleton className="h-4 w-5/6 md:w-2/5" />
          
          {/* Action Buttons Skeleton */}
          <div className="flex gap-3 mt-4 w-full justify-center md:justify-start">
            <Skeleton className="h-10 w-24 rounded-md" />
            <Skeleton className="h-10 w-24 rounded-md" />
          </div>
        </div>
      </div>

      {/* Tabs/Navigation Skeleton */}
      <div className="flex gap-4 border-b pb-2 justify-center md:justify-start">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-20" />
      </div>

      {/* Content Grid Skeleton (e.g., for posts, events, or certificates) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-3">
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
