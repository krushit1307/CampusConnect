import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface DauRecord {
  activity_date: string;
  daily_active_users: number;
}

interface AdminAnalyticsChartProps {
  dauData: DauRecord[];
}

export function AdminAnalyticsChart({ dauData }: AdminAnalyticsChartProps) {
  if (dauData.length === 0) {
    return (
      <div className="flex h-full items-center justify-center font-mono text-sm text-gray-400">
        No active session data recorded yet.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={dauData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="dauGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#A3E635" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#A3E635" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="activity_date"
          stroke="#000000"
          fontSize={10}
          fontFamily="monospace"
          tickFormatter={(date) => {
            try {
              const parts = date.split("-");
              return `${parts[1]}/${parts[2]}`;
            } catch {
              return date;
            }
          }}
        />
        <YAxis stroke="#000000" fontSize={10} fontFamily="monospace" />
        <Tooltip
          contentStyle={{
            border: "2px solid #000000",
            boxShadow: "4px 4px 0px 0px #000000",
            fontFamily: "monospace",
            fontSize: "12px",
          }}
        />
        <Area
          type="monotone"
          dataKey="daily_active_users"
          name="Active Users"
          stroke="#000000"
          strokeWidth={2}
          fillOpacity={1}
          fill="url(#dauGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export default AdminAnalyticsChart;
