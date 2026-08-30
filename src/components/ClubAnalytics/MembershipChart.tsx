import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { MembershipTrend } from "@/hooks/useClubAnalytics";

interface MembershipChartProps {
  data: MembershipTrend[];
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

  return (
    <div className="neu-border bg-white p-3 font-mono text-xs shadow-[4px_4px_0_0_#000]">
      <p className="font-bold text-black mb-2 uppercase">{label}</p>
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

export function MembershipChart({ data }: MembershipChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 font-mono text-sm text-gray-400">
        No membership data available yet.
      </div>
    );
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#000" strokeOpacity={0.1} />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fontFamily: "monospace", fontWeight: 700 }}
            tickLine={false}
            axisLine={{ stroke: "#000", strokeWidth: 2 }}
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
          <Bar
            dataKey="new_members"
            name="New Members"
            fill="#a3e635"
            stroke="#000"
            strokeWidth={1}
            radius={[2, 2, 0, 0]}
          />
          <Bar
            dataKey="left_members"
            name="Left Members"
            fill="#f87171"
            stroke="#000"
            strokeWidth={1}
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
