import * as React from "react";
import { cn } from "@/lib/utils";

export interface LiveNowBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  showDot?: boolean;
}

export function LiveNowBadge({
  className,
  showDot = true,
  children,
  ...props
}: LiveNowBadgeProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-600 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white shadow-md dark:bg-red-700 dark:text-red-50 dark:border-red-400/40",
        className,
      )}
      {...props}
    >
      {showDot && (
        <span className="relative inline-flex h-2 w-2 flex-shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75 motion-reduce:animate-none" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-white dark:bg-red-100" />
        </span>
      )}
      {children ?? "Live Now"}
    </div>
  );
}

export default LiveNowBadge;
