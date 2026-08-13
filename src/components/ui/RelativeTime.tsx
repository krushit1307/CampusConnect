import React from "react";
import { useRelativeTime } from "@/hooks/useRelativeTime";
import { cn } from "@/lib/utils";

export interface RelativeTimeProps {
  date: Date | string | number | null | undefined;
  prefix?: string;
  suffix?: string;
  fallback?: string;
  className?: string;
}

/**
 * Auto-updating Relative Time component (#1750).
 * Displays relative timestamp ("Just now", "5 minutes ago", etc.) and efficiently
 * ticks over in real-time using smart threshold timers without CPU/battery drain.
 */
export const RelativeTime: React.FC<RelativeTimeProps> = ({
  date,
  prefix = "",
  suffix = "",
  fallback = "Recently",
  className,
}) => {
  const relativeText = useRelativeTime(date);

  const isoString = React.useMemo(() => {
    if (!date) return undefined;
    try {
      const d = date instanceof Date ? date : new Date(date);
      return isNaN(d.getTime()) ? undefined : d.toISOString();
    } catch {
      return undefined;
    }
  }, [date]);

  const displayText = relativeText ? `${prefix}${relativeText}${suffix}` : fallback;

  return (
    <time
      dateTime={isoString}
      suppressHydrationWarning
      className={cn("inline-block font-mono text-xs text-muted-foreground", className)}
    >
      {displayText}
    </time>
  );
};
