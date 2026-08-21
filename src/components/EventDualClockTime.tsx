/**
 * src/components/EventDualClockTime.tsx
 * Issue #3680 — Dynamic "Multi-Campus" Timezone Converter.
 *
 * Renders the start (and optional end) time of an event in two clocks
 * when the viewer's timezone differs from the venue's physical
 * timezone, and in a single line otherwise.
 *
 *   ┌─ Dual-clock ────────────────────────────────────┐
 *   │ Starts at 1:00 PM EDT (Your Local Time)        │
 *   │ 5:00 PM BST (London Time — Venue Local)         │
 *   └──────────────────────────────────────────────────┘
 *
 *   ┌─ Single-clock (tz match) ───────────────────────┐
 *   │ Fri, Aug 15 · 5:00 PM – 7:00 PM BST             │
 *   └──────────────────────────────────────────────────┘
 */

import { memo } from "react";
import { Calendar, Clock, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { venueTimezoneLabel } from "@/lib/venueTimezone";
import type { DualClockEventTime } from "@/lib/timezone";

export interface EventDualClockTimeProps {
  data: DualClockEventTime | null;
  venueLabel?: string | null;
  variant?: "full" | "compact";
  className?: string;
}

function EventDualClockTimeImpl({
  data,
  venueLabel,
  variant = "full",
  className,
}: EventDualClockTimeProps) {
  if (!data) {
    return (
      <span className={cn("font-mono text-sm text-gray-500", className)}>
        Date &amp; time TBA
      </span>
    );
  }

  // ── Single-clock variant (tz match) ──────────────────────────────
  if (!data.isDualClock) {
    const startDate = new Date(data.startUtcIso);
    const dateStr = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: data.userTimeZone,
    }).format(startDate);

    const rangeStr = data.localEnd
      ? `${data.localStart} – ${data.localEnd} ${data.userTzAbbrev}`
      : `${data.localStart} ${data.userTzAbbrev}`;

    const timeNode = (
      <time dateTime={data.startUtcIso} itemProp="startDate">
        {dateStr} · {rangeStr}
      </time>
    );

    if (variant === "compact") {
      return (
        <span className={cn("font-mono text-sm text-gray-700", className)}>
          {timeNode}
        </span>
      );
    }

    return (
      <div className={cn("flex items-start gap-3", className)}>
        <Calendar size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-gray-600" />
        <div className="font-mono text-sm text-gray-800">
          {timeNode}
          {data.relativeDayHint && (
            <span className="ml-2 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-amber-700">
              {data.relativeDayHint}
            </span>
          )}
        </div>
      </div>
    );
  }

  // ── Dual-clock variant (tz differ) ──────────────────────────────
  const venueCityLabel = venueTimezoneLabel(data.venueTimeZone);
  const venueFullLabel = venueLabel ? `${venueLabel}` : `${venueCityLabel} Time`;
  const hint = data.relativeDayHint ? ` (${data.relativeDayHint})` : "";

  if (variant === "compact") {
    return (
      <div className={cn("flex flex-col gap-0.5 font-mono text-xs", className)}>
        <time
          dateTime={data.startUtcIso}
          itemProp="startDate"
          className="flex items-center gap-1 text-gray-800"
        >
          <Clock size={12} aria-hidden="true" />
          <span className="font-semibold">{data.localStart}</span>
          <span className="text-gray-500">{data.userTzAbbrev} (you)</span>
        </time>
        <span className="flex items-center gap-1 text-gray-500">
          <Globe size={12} aria-hidden="true" />
          {data.venueStart} {data.venueTzAbbrev}
          <span className="text-gray-400">({venueFullLabel}{hint})</span>
        </span>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-start gap-3">
        <Clock size={18} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-gray-600" />
        <div className="font-mono text-sm">
          <div className="text-gray-800">
            <span className="text-gray-500">Starts at </span>
            <time dateTime={data.startUtcIso} itemProp="startDate" className="font-semibold">
              {data.localStart}
            </time>
            <span className="ml-1 font-semibold text-indigo-600">{data.userTzAbbrev}</span>
            <span className="text-gray-500"> (Your Local Time)</span>
            {hint && (
              <span className="ml-1 rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-semibold uppercase text-amber-700">
                {data.relativeDayHint}
              </span>
            )}
          </div>
          {data.localEnd && (
            <div className="text-gray-600">
              <span className="text-gray-400">Ends at </span>
              {data.localEnd} {data.userTzAbbrev}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-start gap-3 border-t border-dashed border-gray-200 pt-2 pl-7">
        <Globe size={16} aria-hidden="true" className="mt-0.5 flex-shrink-0 text-gray-500" />
        <div className="font-mono text-sm text-gray-600">
          <span className="font-semibold text-gray-700">{data.venueStart}</span>
          <span className="ml-1 font-semibold text-emerald-600">{data.venueTzAbbrev}</span>
          <span className="text-gray-500"> ({venueFullLabel}{hint})</span>
          {data.venueEnd && (
            <span className="ml-2 text-gray-400">→ {data.venueEnd} {data.venueTzAbbrev}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export const EventDualClockTime = memo(EventDualClockTimeImpl);
