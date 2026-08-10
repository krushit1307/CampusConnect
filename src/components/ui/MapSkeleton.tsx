import { Skeleton } from "@/components/ui/skeleton";
import { MapPin } from "lucide-react";

export function MapSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={`neu-border relative flex flex-col items-center justify-center bg-gray-100 p-4 ${className || "h-[300px] w-full"}`}
      role="status"
      aria-label="Loading Map"
    >
      <Skeleton className="absolute inset-0 bg-black/5" />
      <div className="relative z-10 flex flex-col items-center gap-2 text-gray-500">
        <MapPin size={32} className="animate-bounce text-gray-400" />
        <span className="font-mono text-xs font-bold uppercase tracking-wider">Loading Map...</span>
      </div>
    </div>
  );
}
