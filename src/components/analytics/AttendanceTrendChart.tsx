/**
 * AttendanceTrendChart — Dual-line chart comparing RSVP counts vs actual check-ins
 * over time, with an optional attendance-rate overlay.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, BarChart3 } from "lucide-react";
import { TrendPoint, formatNumber } from "@/utils/attendanceAnalytics";

interface AttendanceTrendChartProps {
  data: TrendPoint[];
}

type ViewMode = "line" | "area";

export function AttendanceTrendChart({ data }: AttendanceTrendChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("line");

  const chartData = useMemo(
    () =>
      data.map((d) => ({
        ...d,
        shortLabel: d.label,
      })),
    [data],
  );

  const maxVal = useMemo(() => {
    const maxRsvp = Math.max(...data.map((d) => d.rsvps), 0);
    const maxCheck = Math.max(...data.map((d) => d.checkedIn), 0);
    return Math.max(maxRsvp, maxCheck);
  }, [data]);

  const yDomain = useMemo(() => [0, Math.ceil(maxVal * 1.15)], [maxVal]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || payload.length === 0) return null;

    return (
      <div className="bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-xl p-4 shadow-2xl min-w-[200px]">
        <div className="text-white text-sm font-semibold mb-2">{label}</div>
        {payload.map((entry: { dataKey: string; value: number; color: string }, idx: number) => (
          <div key={idx} className="flex items-center justify-between gap-4 text-xs mb-1">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-gray-400 capitalize">
                {entry.dataKey === "checkedIn"
                  ? "Checked In"
                  : entry.dataKey === "noShows"
                    ? "No-Shows"
                    : entry.dataKey === "attendanceRate"
                      ? "Rate"
                      : entry.dataKey}
              </span>
            </div>
            <span className="text-white font-medium">
              {entry.dataKey === "attendanceRate" ? `${entry.value}%` : formatNumber(entry.value)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-base">Attendance Trends</h3>
            <p className="text-gray-400 text-xs">RSVPs vs check-ins over time</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setViewMode("line")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === "line" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Line
          </button>
          <button
            onClick={() => setViewMode("area")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              viewMode === "area" ? "bg-white/10 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Area
          </button>
        </div>
      </div>

      <div className="h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === "line" ? (
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                tickFormatter={(v) => formatNumber(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                iconType="circle"
                iconSize={8}
              />
              <Line
                type="monotone"
                dataKey="rsvps"
                name="RSVPs"
                stroke="#3b82f6"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#3b82f6", strokeWidth: 2, stroke: "#1e3a5f" }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="checkedIn"
                name="Checked In"
                stroke="#10b981"
                strokeWidth={2.5}
                dot={{ r: 4, fill: "#10b981", strokeWidth: 2, stroke: "#064e3b" }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="noShows"
                name="No-Shows"
                stroke="#f43f5e"
                strokeWidth={2}
                strokeDasharray="5 5"
                dot={{ r: 3, fill: "#f43f5e", strokeWidth: 1 }}
              />
            </LineChart>
          ) : (
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <defs>
                <linearGradient id="rsvpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="checkinGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis
                dataKey="shortLabel"
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
              />
              <YAxis
                domain={yDomain}
                tick={{ fill: "#9ca3af", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
                tickLine={false}
                tickFormatter={(v) => formatNumber(v)}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: 11, color: "#9ca3af" }}
                iconType="circle"
                iconSize={8}
              />
              <Area
                type="monotone"
                dataKey="rsvps"
                name="RSVPs"
                stroke="#3b82f6"
                fill="url(#rsvpGrad)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="checkedIn"
                name="Checked In"
                stroke="#10b981"
                fill="url(#checkinGrad)"
                strokeWidth={2}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
