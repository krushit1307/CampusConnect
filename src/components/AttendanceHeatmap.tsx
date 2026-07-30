import { useEffect, useState } from "react";
import { ActivityCalendar, ThemeInput } from "react-activity-calendar";
import { createClient } from "@/lib/supabase/client";
import { Tooltip as ReactTooltip } from "react-tooltip";
import 'react-tooltip/dist/react-tooltip.css';
import { format, subDays, startOfYear, isSameDay } from "date-fns";

interface HeatmapData {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export function AttendanceHeatmap({ userId }: { userId: string }) {
  const [data, setData] = useState<HeatmapData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchActivity() {
      if (!userId) return;
      const supabase = createClient();
      setLoading(true);

      const oneYearAgo = subDays(new Date(), 365).toISOString();

      try {
        const [postsRes, rsvpsRes] = await Promise.all([
          supabase
            .from("posts")
            .select("created_at")
            .eq("author_id", userId)
            .gte("created_at", oneYearAgo),
          supabase
            .from("event_rsvps")
            .select("created_at")
            .eq("user_id", userId)
            .gte("created_at", oneYearAgo)
        ]);

        const countsByDate: Record<string, number> = {};

        // Helper to add activity count for a day
        const addDate = (isoString: string) => {
          const dateString = format(new Date(isoString), "yyyy-MM-dd");
          countsByDate[dateString] = (countsByDate[dateString] || 0) + 1;
        };

        (postsRes.data || []).forEach((row) => addDate(row.created_at));
        (rsvpsRes.data || []).forEach((row) => addDate(row.created_at));

        // Generate the full year array to fill in missing days with 0
        const heatmapArray: HeatmapData[] = [];
        const endDate = new Date();
        const startDate = subDays(endDate, 365);

        for (let i = 0; i <= 365; i++) {
          const currentDate = new Date(startDate);
          currentDate.setDate(startDate.getDate() + i);
          const dateStr = format(currentDate, "yyyy-MM-dd");
          const count = countsByDate[dateStr] || 0;
          
          let level: 0 | 1 | 2 | 3 | 4 = 0;
          if (count > 0 && count <= 2) level = 1;
          else if (count > 2 && count <= 4) level = 2;
          else if (count > 4 && count <= 6) level = 3;
          else if (count > 6) level = 4;

          heatmapArray.push({
            date: dateStr,
            count,
            level
          });
        }

        setData(heatmapArray);
      } catch (err) {
        console.error("Failed to fetch activity heatmap data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchActivity();
  }, [userId]);

  const customTheme: ThemeInput = {
    light: ['#f4f4f5', '#d9f99d', '#bef264', '#a3e635', '#65a30d'],
    dark: ['#27272a', '#4d7c0f', '#65a30d', '#a3e635', '#d9f99d'],
  };

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center font-mono text-xs text-gray-500">
        Loading activity...
      </div>
    );
  }

  return (
    <div className="w-full overflow-x-auto py-2">
      <div className="min-w-fit">
        <ActivityCalendar
          data={data}
          theme={customTheme}
          colorScheme="light"
          labels={{
            totalCount: "{{count}} contributions in the last year",
          }}
          renderBlock={(block: any, activity: any) => (
             // @ts-ignore
             <div
               {...block}
               data-tooltip-id="heatmap-tooltip"
               data-tooltip-content={`${activity.count} activities on ${format(new Date(activity.date), "MMM d, yyyy")}`}
             />
          )}
        />
        <ReactTooltip id="heatmap-tooltip" />
      </div>
    </div>
  );
}
