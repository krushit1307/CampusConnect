/**
 * NoShowAnalysis — Bar chart and insight cards analyzing no-show patterns,
 * including per-event no-show rates and aggregate insights.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts";
import { AlertTriangle, TrendingDown, Clock, Percent } from "lucide-react";
import { AttendanceRecord, formatNumber, formatPercent } from "@/utils/attendanceAnalytics";

interface NoShowAnalysisProps {
  records: AttendanceRecord[];
}

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const d = payload[0].payload;

  return (
    <div className="bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-xl p-3 shadow-2xl min-w-[180px]">
      <div className="text-white text-xs font-semibold mb-1.5 truncate">{d.title}</div>
      <div className="space-y-1 text-[11px]">
        <div className="flex justify-between gap-3">
          <span className="text-gray-400">RSVPs:</span>
          <span className="text-white">{d.rsvps}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-400">Attended:</span>
          <span className="text-emerald-400">{d.checkedIn}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-400">No-Shows:</span>
          <span className="text-rose-400">{d.noShows}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-gray-400">No-Show Rate:</span>
          <span className="text-rose-400">{d.noShowRate}%</span>
        </div>
      </div>
    </div>
  );
};

export function NoShowAnalysis({ records }: NoShowAnalysisProps) {
  const chartData = useMemo(() => {
    return records
      .map((r) => ({
        title: r.title.length > 24 ? r.title.slice(0, 22) + "…" : r.title,
        rsvps: r.rsvps,
        checkedIn: r.checkedIn,
        noShows: r.noShowCount,
        noShowRate: r.rsvps > 0 ? Math.round((r.noShowCount / r.rsvps) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.noShows - a.noShows)
      .slice(0, 12);
  }, [records]);

  const insights = useMemo(() => {
    if (records.length === 0) return null;

    const totalRsvps = records.reduce((s, r) => s + r.rsvps, 0);
    const totalNoShows = records.reduce((s, r) => s + r.noShowCount, 0);
    const overallNoShowRate = totalRsvps > 0 ? (totalNoShows / totalRsvps) * 100 : 0;

    const noShowRates = records
      .filter((r) => r.rsvps > 0)
      .map((r) => (r.noShowCount / r.rsvps) * 100);
    const avgNoShowRate =
      noShowRates.length > 0 ? noShowRates.reduce((s, v) => s + v, 0) / noShowRates.length : 0;
    const maxNoShowRate = noShowRates.length > 0 ? Math.max(...noShowRates) : 0;

    const worstEvent = [...records].sort((a, b) => b.noShowCount - a.noShowCount)[0];
    const bestEvent = [...records].sort((a, b) => a.noShowCount - b.noShowCount)[0];

    return {
      totalNoShows,
      overallNoShowRate,
      avgNoShowRate,
      maxNoShowRate,
      worstEvent: worstEvent ? { title: worstEvent.title, count: worstEvent.noShowCount } : null,
      bestEvent: bestEvent ? { title: bestEvent.title, count: bestEvent.noShowCount } : null,
    };
  }, [records]);

  if (!insights) return null;

  const noShowBarColor = (rate: number) => {
    if (rate >= 20) return "#f43f5e";
    if (rate >= 10) return "#f59e0b";
    return "#10b981";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-rose-500/20 text-rose-400">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base">No-Show Analysis</h3>
          <p className="text-gray-400 text-xs">RSVP-to-attendance drop-off insights</p>
        </div>
      </div>

      {/* Insight Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
              Total No-Shows
            </span>
          </div>
          <div className="text-lg font-bold text-white">{formatNumber(insights.totalNoShows)}</div>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Percent className="w-3.5 h-3.5 text-amber-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
              Avg No-Show Rate
            </span>
          </div>
          <div className="text-lg font-bold text-white">
            {formatPercent(insights.avgNoShowRate)}
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">
              Worst No-Show Rate
            </span>
          </div>
          <div className="text-lg font-bold text-white">
            {formatPercent(insights.maxNoShowRate)}
          </div>
        </div>
        <div className="bg-white/5 rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wider">Worst Event</span>
          </div>
          <div
            className="text-sm font-medium text-white truncate"
            title={insights.worstEvent?.title}
          >
            {insights.worstEvent?.title ?? "N/A"}
          </div>
          <div className="text-[10px] text-gray-500">
            {insights.worstEvent?.count ?? 0} no-shows
          </div>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 20, left: 5, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.06)"
              horizontal={false}
            />
            <XAxis
              type="number"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="title"
              tick={{ fill: "#d1d5db", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              width={140}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine x={0} stroke="rgba(255,255,255,0.1)" />
            <Bar dataKey="noShows" radius={[0, 4, 4, 0]} barSize={14}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={noShowBarColor(entry.noShowRate)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}
