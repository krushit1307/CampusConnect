/**
 * WaitlistPosition
 *
 * Displays a user's current waitlist position with visual indicator
 * and estimated wait time.
 */

import { cn } from "@/lib/utils";
import { formatWaitlistPosition, formatWaitDuration, generateWaitlistSummary, estimateWaitTime } from "@/lib/waitlist-utils";
import type { WaitlistEntry } from "@/types/waitlist";

interface WaitlistPositionProps {
  /** User's position on the waitlist */
  position: number;
  /** Total number of people waiting */
  totalWaiting: number;
  /** All waitlist entries for estimation */
  entries: WaitlistEntry[];
  /** User's join time */
  joinedAt: string;
  /** Size variant */
  variant?: "compact" | "full";
  /** Additional CSS classes */
  className?: string;
}

export function WaitlistPosition({
  position,
  totalWaiting,
  entries,
  joinedAt,
  variant = "full",
  className,
}: WaitlistPositionProps) {
  const estimatedMinutes = estimateWaitTime(entries, position);
  const summary = generateWaitlistSummary(position, totalWaiting, estimatedMinutes);
  const waitDuration = formatWaitDuration(joinedAt);

  if (variant === "compact") {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <div className="neu-border bg-peach px-2 py-1 text-center">
          <span className="font-mono text-sm font-black text-orange-700">
            #{position}
          </span>
        </div>
        <span className="font-mono text-xs text-gray-600">
          of {totalWaiting}
        </span>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "neu-border p-4 bg-cream",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Your Position
          </p>
          <p className="mt-1 font-mono text-3xl font-black text-orange-700">
            #{position}
          </p>
          <p className="mt-1 font-mono text-xs text-gray-600">
            {totalWaiting > 1
              ? `of ${totalWaiting} people waiting`
              : "1 person waiting"}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500">
            Waiting For
          </p>
          <p className="mt-1 font-mono text-sm font-bold text-black">
            {waitDuration}
          </p>
        </div>
      </div>

      {estimatedMinutes !== null && (
        <div className="mt-3 pt-3 border-t border-black/10">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Estimated Wait
            </span>
            <span className="font-mono text-xs font-bold text-blue-700">
              {estimatedMinutes < 60
                ? `~${estimatedMinutes} minutes`
                : `~${Math.floor(estimatedMinutes / 60)}h ${estimatedMinutes % 60}m`}
            </span>
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-2 w-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-lime transition-all duration-500"
              style={{ width: `${Math.max(5, 100 - (position / totalWaiting) * 100)}%` }}
            />
          </div>
        </div>
      )}

      <p className="mt-3 font-mono text-[10px] text-gray-500">
        You will be notified when a spot opens up. You have 60 minutes to confirm.
      </p>
    </div>
  );
}
