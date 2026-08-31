import { useMemo, useState } from "react";
import format from "date-fns/format";
import type { DateRange } from "react-day-picker";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  maxTrafficCount,
  trafficCellKey,
  trafficIntensity,
  type EventTrafficCell,
} from "@/lib/eventTraffic";

export interface EventTrafficRecord extends EventTrafficCell {
  category_id: string | null;
}

interface EventTrafficHeatmapProps {
  dateRange?: DateRange;
  enabled?: boolean;
}

function formatHour(hour: number) {
  if (hour === 0) return "12 AM";
  if (hour < 12) return `${hour} AM`;
  if (hour === 12) return "12 PM";
  return `${hour - 12} PM`;
}

function intensityClass(value: number, maximum: number) {
  const ratio = trafficIntensity(value, maximum);
  if (ratio === 0) return "bg-white";
  if (ratio <= 0.2) return "bg-lime-100";
  if (ratio <= 0.4) return "bg-lime-300";
  if (ratio <= 0.6) return "bg-lime-500";
  if (ratio <= 0.8) return "bg-lime-700 text-white";
  return "bg-lime-950 text-white";
}

export function EventTrafficHeatmap({ dateRange, enabled = true }: EventTrafficHeatmapProps) {
  const [supabase] = useState(() => createClient());
  const [hoveredCell, setHoveredCell] = useState<EventTrafficRecord | null>(null);
  const startDate = dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined;
  const endDate = dateRange?.to ? format(dateRange.to, "yyyy-MM-dd") : startDate;

  const {
    data: records = [],
    isLoading,
    isError,
  } = useQuery<EventTrafficRecord[]>({
    queryKey: ["event-traffic-heatmap", startDate, endDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_traffic_heatmap", {
        p_start_date: startDate,
        p_end_date: endDate,
      });
      if (error) throw new Error(error.message);
      return ((data ?? []) as EventTrafficRecord[]).map((record) => ({
        ...record,
        hour_of_day: Number(record.hour_of_day),
        traffic_count: Number(record.traffic_count),
        unique_viewers: Number(record.unique_viewers),
      }));
    },
    enabled,
  });

  const { lookup, maximum } = useMemo(() => {
    const nextLookup = new Map<string, EventTrafficRecord>();
    records.forEach((record) => {
      nextLookup.set(trafficCellKey(record.category_name, record.hour_of_day), record);
    });
    return { lookup: nextLookup, maximum: maxTrafficCount(records) };
  }, [records]);

  return (
    <section className="neu-border space-y-6 bg-white p-6 text-black shadow-[4px_4px_0_0_#000]">
      <div className="flex flex-col gap-4 border-b-2 border-black pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-display text-2xl font-black uppercase">Event traffic heatmap</h2>
          <p className="mt-1 max-w-2xl font-mono text-xs text-black/60">
            Explore event-detail views by category and time of day. Counts are aggregated for
            administrators; raw traffic records are never shown here.
          </p>
        </div>
        <p className="font-mono text-[10px] font-bold uppercase text-black/55">
          {startDate && endDate ? `${startDate} → ${endDate}` : "Last 30 days"}
        </p>
      </div>

      <div className="flex min-h-10 items-center justify-between gap-3 border-2 border-black bg-yellow-50 p-3 font-mono text-xs">
        {hoveredCell ? (
          <p>
            <span className="font-bold">{hoveredCell.category_name}</span> at{" "}
            <span className="font-bold">{formatHour(hoveredCell.hour_of_day)}</span>:{" "}
            {hoveredCell.traffic_count} views, {hoveredCell.unique_viewers} unique viewers.
          </p>
        ) : (
          <p className="text-black/55">Hover over a cell to inspect its traffic.</p>
        )}
        <div className="hidden items-center gap-1 text-[10px] font-bold uppercase sm:flex">
          <span>Low</span>
          {[
            "bg-white",
            "bg-lime-100",
            "bg-lime-300",
            "bg-lime-500",
            "bg-lime-700",
            "bg-lime-950",
          ].map((className) => (
            <span key={className} className={`h-3 w-3 border border-black ${className}`} />
          ))}
          <span>High</span>
        </div>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center border-2 border-black">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
        </div>
      ) : isError ? (
        <div className="flex h-64 items-center justify-center border-2 border-red-500 bg-red-50 p-6 text-center font-mono text-sm text-red-700">
          Could not load event traffic analytics.
        </div>
      ) : records.length === 0 ? (
        <div className="flex h-64 items-center justify-center border-2 border-dashed border-black/25 p-6 text-center font-mono text-sm text-black/55">
          No event-detail traffic has been recorded for this period.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[960px] border-2 border-black bg-gray-50 p-4">
            <div className="grid grid-cols-[150px_repeat(24,minmax(28px,1fr))] gap-1 pb-2">
              <div className="font-mono text-[10px] font-bold uppercase">Category</div>
              {Array.from({ length: 24 }, (_, hour) => (
                <div
                  key={hour}
                  className="truncate text-center font-mono text-[9px] font-bold"
                  title={formatHour(hour)}
                >
                  {formatHour(hour)}
                </div>
              ))}
            </div>
            <div className="space-y-1">
              {[...new Set(records.map((record) => record.category_name))].map((categoryName) => (
                <div
                  key={categoryName}
                  className="grid grid-cols-[150px_repeat(24,minmax(28px,1fr))] items-center gap-1"
                >
                  <div className="truncate pr-2 font-mono text-xs font-bold" title={categoryName}>
                    {categoryName}
                  </div>
                  {Array.from({ length: 24 }, (_, hour) => {
                    const record = lookup.get(trafficCellKey(categoryName, hour)) ?? {
                      category_id: null,
                      category_name: categoryName,
                      hour_of_day: hour,
                      traffic_count: 0,
                      unique_viewers: 0,
                    };
                    return (
                      <button
                        key={hour}
                        type="button"
                        aria-label={`${categoryName}, ${formatHour(hour)}: ${record.traffic_count} views`}
                        title={`${record.traffic_count} views · ${record.unique_viewers} unique viewers`}
                        onMouseEnter={() => setHoveredCell(record)}
                        onFocus={() => setHoveredCell(record)}
                        onMouseLeave={() => setHoveredCell(null)}
                        onBlur={() => setHoveredCell(null)}
                        className={`h-8 border border-black/35 transition-transform hover:z-10 hover:scale-110 focus:z-10 focus:scale-110 focus:outline focus:outline-2 focus:outline-black ${intensityClass(record.traffic_count, maximum)}`}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
