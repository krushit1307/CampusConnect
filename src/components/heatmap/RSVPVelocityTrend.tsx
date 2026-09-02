/**
 * RSVPVelocityTrend — Line chart showing RSVP accumulation over semester weeks,
 * with category coloring and growth indicators.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";
import { RSVPVelocityPoint, CATEGORY_COLORS, EventCategory } from "@/utils/activityHeatmap";

interface RSVPVelocityTrendProps {
  data: RSVPVelocityPoint[];
}

export function RSVPVelocityTrend({ data }: RSVPVelocityTrendProps) {
  const growth = useMemo(() => {
    if (data.length < 2) return 0;
    const first = data.slice(0, Math.floor(data.length / 2));
    const second = data.slice(Math.floor(data.length / 2));
    const firstAvg = first.reduce((s, d) => s + d.totalRsvps, 0) / first.length;
    const secondAvg = second.reduce((s, d) => s + d.totalRsvps, 0) / second.length;
    return firstAvg > 0 ? (secondAvg - firstAvg) / firstAvg : 0;
  }, [data]);

  const peakWeek = useMemo(
    () => data.reduce((max, d) => (d.totalRsvps > max.totalRsvps ? d : max), data[0]),
    [data],
  );

  const totalRsvps = useMemo(() => data.reduce((s, d) => s + d.totalRsvps, 0), [data]);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload as RSVPVelocityPoint;
    const color = CATEGORY_COLORS[d.topCategory as EventCategory] || "#6b7280";
    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-xl px-4 py-3 shadow-2xl">
        <div className="text-white text-xs font-bold mb-1">{d.label}</div>
        <div className="text-cyan-400 text-xs">{d.totalRsvps.toLocaleString()} RSVPs</div>
        <div className="text-gray-400 text-[10px]">~{d.avgDailyRsvps}/day</div>
        <div className="flex items-center gap-1 mt-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-[10px] text-gray-300">Top: {d.topCategory}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-amber-400" />
          <h3 className="text-white font-semibold text-sm">RSVP Velocity</h3>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[9px] text-gray-500">Total</div>
            <div className="text-white text-xs font-bold">{totalRsvps.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-gray-500">Growth</div>
            <div
              className={`flex items-center gap-0.5 text-xs font-bold ${growth >= 0 ? "text-emerald-400" : "text-rose-400"}`}
            >
              {growth >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              {Math.abs(Math.round(growth * 100))}%
            </div>
          </div>
        </div>
      </div>

      <div className="h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
            <defs>
              <linearGradient id="rsvpGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
            <XAxis
              dataKey="label"
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "#9ca3af", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : String(v))}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="totalRsvps"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="url(#rsvpGradient)"
              dot={{ fill: "#06b6d4", r: 3, strokeWidth: 0 }}
              activeDot={{ r: 5, stroke: "#06b6d4", strokeWidth: 2, fill: "#0e7490" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Peak Week Callout */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-3 flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2"
      >
        <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
        <span className="text-[11px] text-amber-300">
          Peak week: <strong>{peakWeek.label}</strong> with{" "}
          <strong>{peakWeek.totalRsvps.toLocaleString()}</strong> RSVPs — top category:{" "}
          <span
            className="font-bold"
            style={{ color: CATEGORY_COLORS[peakWeek.topCategory as EventCategory] }}
          >
            {peakWeek.topCategory}
          </span>
        </span>
      </motion.div>
    </div>
  );
}
