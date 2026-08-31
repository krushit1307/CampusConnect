/**
 * CategoryBreakdown — Stacked visualization of event categories with fill-rate indicators.
 */

import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Layers } from "lucide-react";
import {
  CategoryDistribution,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  EventCategory,
} from "@/utils/activityHeatmap";

interface CategoryBreakdownProps {
  categories: CategoryDistribution[];
}

export function CategoryBreakdown({ categories }: CategoryBreakdownProps) {
  const pieData = categories.map((c) => ({
    ...c,
    name: CATEGORY_LABELS[c.category as EventCategory] || c.category,
    fill: CATEGORY_COLORS[c.category as EventCategory] || "#6b7280",
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-gray-900/95 border border-white/20 rounded-xl px-3 py-2 shadow-xl">
        <div className="text-white text-[11px] font-semibold">{d.name}</div>
        <div className="text-gray-400 text-[10px]">
          {d.count} events ({d.percentage}%)
        </div>
        <div className="text-cyan-400 text-[10px]">
          Avg fill: {Math.round(d.avgFillRate * 100)}%
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
      <div className="flex items-center gap-2 mb-5">
        <Layers className="w-4 h-4 text-purple-400" />
        <h3 className="text-white font-semibold text-sm">Category Breakdown</h3>
      </div>

      <div className="flex items-center gap-6">
        {/* Pie Chart */}
        <div className="w-[150px] h-[150px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={65}
                paddingAngle={2}
                dataKey="count"
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Category list */}
        <div className="flex-1 space-y-2">
          {categories.map((cat, i) => {
            const color = CATEGORY_COLORS[cat.category as EventCategory] || "#6b7280";
            return (
              <motion.div
                key={cat.category}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className="flex items-center gap-2"
              >
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[11px] text-gray-300 flex-1 truncate">
                  {CATEGORY_LABELS[cat.category as EventCategory] || cat.category}
                </span>
                <span className="text-[10px] text-gray-500 font-mono w-8 text-right">
                  {cat.percentage}%
                </span>
                <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${cat.avgFillRate * 100}%` }}
                    transition={{ delay: 0.2 + i * 0.03, duration: 0.4 }}
                    className="h-full rounded-full"
                    style={{ backgroundColor: color }}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
