import { Skeleton } from "@/components/ui/skeleton";

export function ProfileSkeleton() {
  return (
    <div className="w-full max-w-3xl rounded-xl border-2 border-black bg-white p-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] sm:p-8">
      {/* Header Row: Fixed Avatar, Shrinking Text */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-20 w-20 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-3 w-full max-w-24" />
          <Skeleton className="h-8 w-full max-w-56" />
          <Skeleton className="h-3 w-full max-w-44" />
        </div>
      </div>

      {/* Divider */}
      <Skeleton className="my-6 h-0.5 w-full bg-black/10" />

      {/* Details Grid */}
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-10 w-full rounded-md" />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-24 w-full rounded-md" />
        </div>
      </div>

      <span className="sr-only">Loading profile...</span>
    </div>
  );
}
