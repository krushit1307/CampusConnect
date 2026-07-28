import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";

export function ChartSkeleton({ height = "400px" }: { height?: string }) {
  return (
    <div
      style={{ height }}
      className="neu-border relative flex flex-col items-center justify-center bg-gray-50 p-6 w-full"
      role="status"
      aria-label="Loading Chart"
    >
      <Skeleton className="absolute inset-0 bg-black/5" />
      <div className="relative z-10 flex flex-col items-center gap-3 text-gray-500">
        <BarChart3 size={36} className="animate-pulse text-gray-400" />
        <span className="font-mono text-xs font-bold uppercase tracking-wider">
          Loading Analytics...
        </span>
      </div>
    </div>
  );
}
