import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ActivityMetric } from "@/hooks/useClubAnalytics";

interface ActivityTimelineChartProps {
  data: ActivityMetric[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload) return null;

  const formattedDate = label
    ? new Date(label + "T00:00:00").toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : label;

  return (
    <div className="neu-border bg-white p-3 font-mono text-xs shadow-[4px_4px_0_0_#000]">
      <p className="font-bold text-black mb-2">{formattedDate}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 mb-1">
          <span
            className="inline-block w-3 h-3 border border-black"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-600 capitalize">{entry.name.replace("_", " ")}:</span>
          <span className="font-bold text-black">{entry.value}</span>
        </div>
      ))}
    </div>
  );
}

export function ActivityTimelineChart({ data }: ActivityTimelineChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 font-mono text-sm text-gray-400">
        No activity data in the last 30 days.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#000" strokeOpacity={0.1} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: "#000", strokeWidth: 2 }}
            tickFormatter={(val: string) =>
              new Date(val + "T00:00:00").toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
          />
          <YAxis
            tick={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: "#000", strokeWidth: 2 }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              fontSize: "11px",
              fontFamily: "monospace",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          />
          <Line
            type="monotone"
            dataKey="posts"
            name="Posts"
            stroke="#a3e635"
            strokeWidth={2}
            dot={{ fill: "#a3e635", stroke: "#000", strokeWidth: 1, r: 3 }}
            activeDot={{ r: 5, stroke: "#000", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="comments"
            name="Comments"
            stroke="#60a5fa"
            strokeWidth={2}
            dot={{ fill: "#60a5fa", stroke: "#000", strokeWidth: 1, r: 3 }}
            activeDot={{ r: 5, stroke: "#000", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="rsvps"
            name="RSVPs"
            stroke="#facc15"
            strokeWidth={2}
            dot={{ fill: "#facc15", stroke: "#000", strokeWidth: 1, r: 3 }}
            activeDot={{ r: 5, stroke: "#000", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
