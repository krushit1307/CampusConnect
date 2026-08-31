/**
 * CategoryPieChart — Donut chart showing attendance distribution across event categories,
 * with an interactive hover tooltip and a sidebar legend with stats.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Sector } from "recharts";
import { PieChart as PieIcon } from "lucide-react";
import { CategoryStats, formatNumber, formatPercent } from "@/utils/attendanceAnalytics";

interface CategoryPieChartProps {
  data: CategoryStats[];
}

const renderActiveShape = (props: any) => {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill, payload, value, percent } =
    props;

  return (
    <g>
      <text x={cx} y={cy - 12} textAnchor="middle" className="fill-white text-sm font-semibold">
        {payload.category}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" className="fill-gray-400 text-xs">
        {formatNumber(value)} attendees
      </text>
      <text x={cx} y={cy + 28} textAnchor="middle" className="fill-gray-500 text-[10px]">
        {`${(percent * 100).toFixed(1)}%`}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={1}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius - 4}
        outerRadius={innerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
        opacity={0.5}
      />
    </g>
  );
};

const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload as CategoryStats;

  return (
    <div className="bg-gray-900/95 backdrop-blur-md border border-white/20 rounded-xl p-3 shadow-2xl">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }} />
        <span className="text-white text-sm font-semibold">{data.category}</span>
      </div>
      <div className="text-xs text-gray-400 space-y-1">
        <div className="flex justify-between gap-4">
          <span>Events:</span>
          <span className="text-white">{data.totalEvents}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Total Attendees:</span>
          <span className="text-white">{formatNumber(data.totalAttendees)}</span>
        </div>
        <div className="flex justify-between gap-4">
          <span>Avg Attendance Rate:</span>
          <span className="text-white">{formatPercent(data.avgAttendanceRate)}</span>
        </div>
        {data.avgRating !== null && (
          <div className="flex justify-between gap-4">
            <span>Avg Rating:</span>
            <span className="text-white">{data.avgRating.toFixed(1)} ⭐</span>
          </div>
        )}
      </div>
    </div>
  );
};

export function CategoryPieChart({ data }: CategoryPieChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | undefined>(undefined);

  const totalAttendees = useMemo(() => data.reduce((sum, d) => sum + d.totalAttendees, 0), [data]);

  const onPieEnter = (_: unknown, index: number) => {
    setActiveIndex(index);
  };

  const onPieLeave = () => {
    setActiveIndex(undefined);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400">
          <PieIcon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base">Category Breakdown</h3>
          <p className="text-gray-400 text-xs">Attendance by event category</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row items-center gap-6">
        {/* Donut Chart */}
        <div className="w-full lg:w-1/2 h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={2}
                dataKey="totalAttendees"
                activeIndex={activeIndex}
                activeShape={renderActiveShape}
                onMouseEnter={onPieEnter}
                onMouseLeave={onPieLeave}
              >
                {data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="transparent"
                    style={{ cursor: "pointer" }}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend / Stats */}
        <div className="w-full lg:w-1/2 space-y-2.5">
          {data.map((cat) => {
            const pct = totalAttendees > 0 ? (cat.totalAttendees / totalAttendees) * 100 : 0;
            return (
              <div
                key={cat.category}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all cursor-default"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: cat.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs font-medium">{cat.category}</span>
                    <span className="text-gray-400 text-[10px]">{cat.totalEvents} events</span>
                  </div>
                  <div className="mt-1.5 h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 0.5, duration: 0.8 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: cat.color }}
                    />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-gray-500 text-[10px]">
                      {formatNumber(cat.totalAttendees)} attendees
                    </span>
                    <span className="text-gray-500 text-[10px]">{pct.toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
