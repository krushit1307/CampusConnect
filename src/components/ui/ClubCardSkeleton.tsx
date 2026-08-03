import { Skeleton } from "@/components/ui/skeleton";

const DESCRIPTION_LINES: Record<"sm" | "md" | "lg", number> = {
  sm: 1,
  md: 2,
  lg: 4,
};

export function ClubCardSkeleton({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  return (
    <div className="neu-border flex h-full flex-col justify-between bg-white p-6 shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
      <div>
        <div className="mb-4 flex items-center justify-between gap-2">
          <Skeleton className="h-5 w-16 border-2 border-black" />
        </div>
        <Skeleton className="mb-2 h-6 w-3/4" />
        <div className="mb-6 space-y-2">
          {Array.from({ length: DESCRIPTION_LINES[size] }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-full" />
          ))}
        </div>
      </div>
      <div>
        <div className="my-3 border-t-2 border-black" />
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}