import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import format from "date-fns/format";
import subDays from "date-fns/subDays";
import parseISO from "date-fns/parseISO";

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  count: number;
  formattedDate: string;
  dayOfWeek: number; // 0=Sun, 1=Mon, ..., 6=Sat
  monthName: string;
}

/**
 * Formats a date or ISO timestamp string into a local YYYY-MM-DD string.
 * Prevents UTC midnight strings like '2024-10-15T00:00:00Z' from shifting
 * to October 14th when evaluated in negative UTC offset timezones (e.g. California UTC-8).
 */
export function formatToLocalYYYYMMDD(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "";

  if (typeof dateInput === "string") {
    // If it's a date-only string or UTC midnight format, extract YYYY-MM-DD directly
    const dateOnlyMatch = dateInput.match(/^(\d{4}-\d{2}-\d{2})(T00:00:00(\.000)?Z)?$/);
    if (dateOnlyMatch) {
      return dateOnlyMatch[1];
    }
  }

  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return "";

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns Tailwind CSS background and border classes based on attendance count.
 */
export function getSquareColorClass(count: number): string {
  if (count === 0)
    return "bg-gray-100 border-gray-200 hover:bg-gray-200 dark:bg-zinc-800 dark:border-zinc-700 dark:hover:bg-zinc-700";
  if (count < 2)
    return "bg-green-200 border-green-300 hover:bg-green-300 dark:bg-green-900/60 dark:border-green-800 dark:hover:bg-green-800";
  if (count < 4)
    return "bg-green-400 border-green-500 hover:bg-green-500 dark:bg-green-700 dark:border-green-600 dark:hover:bg-green-600";
  if (count < 6)
    return "bg-green-600 border-green-700 hover:bg-green-700 text-white dark:bg-green-500 dark:border-green-400";
  return "bg-green-800 border-green-900 hover:bg-green-900 text-white dark:bg-green-400 dark:border-green-300";
}

interface AttendanceHeatmapProps {
  userId: string;
  className?: string;
}

export function AttendanceHeatmap({ userId, className }: AttendanceHeatmapProps) {
  const [countsByDate, setCountsByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function fetchAttendanceHistory() {
      if (!userId) return;
      setLoading(true);
      setError(null);

      const supabase = createClient();
      const oneYearAgo = subDays(new Date(), 365).toISOString();

      try {
        const { data, error: fetchError } = await supabase
          .from("event_rsvps")
          .select(
            `
            id,
            rsvp_at,
            created_at,
            events (
              id,
              event_date,
              start_date
            )
          `,
          )
          .eq("user_id", userId)
          .gte("created_at", oneYearAgo);

        if (fetchError) throw fetchError;

        const counts: Record<string, number> = {};

        (data || []).forEach((rsvp) => {
          const eventObj = Array.isArray(rsvp.events) ? rsvp.events[0] : rsvp.events;
          // Prefer event date, falling back to rsvp timestamp
          const rawDate =
            eventObj?.event_date || eventObj?.start_date || rsvp.rsvp_at || rsvp.created_at;
          if (rawDate) {
            const formattedLocal = formatToLocalYYYYMMDD(rawDate);
            if (formattedLocal) {
              counts[formattedLocal] = (counts[formattedLocal] || 0) + 1;
            }
          }
        });

        if (isMounted) {
          setCountsByDate(counts);
        }
      } catch (err: any) {
        console.error("Failed to fetch user attendance history:", err);
        if (isMounted) {
          setError("Failed to load attendance history.");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    fetchAttendanceHistory();
    return () => {
      isMounted = false;
    };
  }, [userId]);

  // Generate 365 days data structured into 52+ week columns
  const { weeks, monthHeaders, totalEvents } = useMemo(() => {
    const today = new Date();
    const daysList: HeatmapDay[] = [];
    let sumCount = 0;

    for (let i = 0; i <= 364; i++) {
      const d = subDays(today, 364 - i);
      const dateStr = formatToLocalYYYYMMDD(d);
      const count = countsByDate[dateStr] || 0;
      sumCount += count;

      // Parse for display string (Month Day, Year)
      const parsedDate = parseISO(dateStr);
      const formattedDate = isNaN(parsedDate.getTime())
        ? dateStr
        : format(parsedDate, "MMM d, yyyy");

      daysList.push({
        date: dateStr,
        count,
        formattedDate,
        dayOfWeek: d.getDay(),
        monthName: isNaN(parsedDate.getTime()) ? "" : format(parsedDate, "MMM"),
      });
    }

    // Group days into columns (weeks). Each week column holds up to 7 days (Sun..Sat)
    const weekColumns: (HeatmapDay | null)[][] = [];
    let currentWeek: (HeatmapDay | null)[] = [];

    // Pad leading days of the first week if startDate is not Sunday
    const startDayOfWeek = daysList[0]?.dayOfWeek ?? 0;
    for (let i = 0; i < startDayOfWeek; i++) {
      currentWeek.push(null);
    }

    daysList.forEach((day) => {
      currentWeek.push(day);
      if (currentWeek.length === 7) {
        weekColumns.push(currentWeek);
        currentWeek = [];
      }
    });

    if (currentWeek.length > 0) {
      // Pad trailing days
      while (currentWeek.length < 7) {
        currentWeek.push(null);
      }
      weekColumns.push(currentWeek);
    }

    // Calculate month label positions
    const months: { name: string; colIndex: number }[] = [];
    let lastMonth = "";

    weekColumns.forEach((col, colIdx) => {
      const firstValidDay = col.find((d): d is HeatmapDay => d !== null);
      if (firstValidDay && firstValidDay.monthName !== lastMonth) {
        months.push({ name: firstValidDay.monthName, colIndex: colIdx });
        lastMonth = firstValidDay.monthName;
      }
    });

    return {
      weeks: weekColumns,
      monthHeaders: months,
      totalEvents: sumCount,
    };
  }, [countsByDate]);

  if (loading) {
    return (
      <div className={cn("neu-border bg-white p-6 dark:bg-zinc-900", className)}>
        <div className="flex h-32 items-center justify-center font-mono text-sm text-gray-500 animate-pulse">
          Loading attendance heatmap...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("neu-border bg-red-50 p-6 text-red-700 font-mono text-sm", className)}>
        {error}
      </div>
    );
  }

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <TooltipProvider delayDuration={100}>
      <div
        className={cn(
          "neu-border bg-white p-6 font-mono dark:bg-zinc-900 dark:text-white",
          className,
        )}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black dark:border-zinc-700 pb-3 mb-4">
          <div>
            <h3 className="font-display font-bold text-lg text-black dark:text-white">
              Attendance Heatmap
            </h3>
            <p className="text-xs text-gray-600 dark:text-zinc-400">
              {totalEvents} {totalEvents === 1 ? "event" : "events"} attended in the last 365 days
            </p>
          </div>
        </div>

        <div className="w-full overflow-x-auto pb-2">
          <div className="min-w-[700px]">
            {/* Month Header Row */}
            <div className="flex text-xs text-gray-500 dark:text-zinc-400 mb-1 pl-8 relative h-4">
              {monthHeaders.map((m, idx) => (
                <span
                  key={`${m.name}-${idx}`}
                  className="absolute font-semibold text-[10px]"
                  style={{ left: `${32 + m.colIndex * 15}px` }}
                >
                  {m.name}
                </span>
              ))}
            </div>

            {/* Grid Area: Day Labels + Week Columns */}
            <div className="flex gap-1">
              {/* Day of Week Labels (Mon, Wed, Fri) */}
              <div className="flex flex-col gap-1 pr-2 text-[10px] text-gray-400 dark:text-zinc-500 justify-between py-[2px] w-6 shrink-0">
                <span>{dayLabels[1]}</span>
                <span>{dayLabels[3]}</span>
                <span>{dayLabels[5]}</span>
              </div>

              {/* 52 Columns Grid */}
              <div className="flex gap-1">
                {weeks.map((week, wIdx) => (
                  <div key={wIdx} className="flex flex-col gap-1">
                    {week.map((day, dIdx) => {
                      if (!day) {
                        return (
                          <div
                            key={`empty-${wIdx}-${dIdx}`}
                            className="h-3 w-3 rounded-xs bg-transparent"
                          />
                        );
                      }

                      return (
                        <Tooltip key={day.date}>
                          <TooltipTrigger asChild>
                            <div
                              tabIndex={0}
                              role="gridcell"
                              aria-label={`${day.count} events on ${day.formattedDate}`}
                              className={cn(
                                "h-3 w-3 rounded-xs border transition-colors cursor-pointer focus:outline-none focus:ring-1 focus:ring-black dark:focus:ring-white",
                                getSquareColorClass(day.count),
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            className="neu-border bg-black text-white font-mono text-xs px-3 py-1.5 shadow-md"
                          >
                            <span className="font-bold text-lime">
                              {day.count} {day.count === 1 ? "event" : "events"}
                            </span>{" "}
                            on {day.formattedDate}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            {/* Heatmap Legend */}
            <div className="flex items-center justify-end gap-2 text-[11px] text-gray-500 dark:text-zinc-400 mt-4">
              <span>Less</span>
              <div className="flex gap-1">
                <div className={cn("h-3 w-3 rounded-xs border", getSquareColorClass(0))} />
                <div className={cn("h-3 w-3 rounded-xs border", getSquareColorClass(1))} />
                <div className={cn("h-3 w-3 rounded-xs border", getSquareColorClass(3))} />
                <div className={cn("h-3 w-3 rounded-xs border", getSquareColorClass(5))} />
                <div className={cn("h-3 w-3 rounded-xs border", getSquareColorClass(7))} />
              </div>
              <span>More</span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
