/**
 * AttendanceHeatmapChart — Calendar-style heatmap grid showing
 * attendee counts by day-of-week × hour-of-day to reveal scheduling patterns.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Grid3X3 } from "lucide-react";
import { HeatmapCell, formatNumber } from "@/utils/attendanceAnalytics";

interface AttendanceHeatmapChartProps {
  data: HeatmapCell[];
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOUR_LABELS = Array.from({ length: 24 }, (_, i) => {
  if (i === 0) return "12a";
  if (i < 12) return `${i}a`;
  if (i === 12) return "12p";
  return `${i - 12}p`;
});

function interpolateColor(value: number, max: number): string {
  if (max === 0) return "rgba(255,255,255,0.02)";
  const t = Math.min(value / max, 1);

  if (t === 0) return "rgba(255,255,255,0.02)";

  // Gradient from dim cyan → bright cyan → bright amber
  if (t < 0.5) {
    const s = t / 0.5;
    const r = Math.round(6 + s * (6 - 6));
    const g = Math.round(10 + s * (182 - 10));
    const b = Math.round(30 + s * (212 - 30));
    return `rgba(${r},${g},${b},${0.2 + s * 0.6})`;
  }

  const s = (t - 0.5) / 0.5;
  const r = Math.round(6 + s * (245 - 6));
  const g = Math.round(182 + s * (158 - 182));
  const b = Math.round(212 + s * (11 - 212));
  return `rgba(${r},${g},${b},${0.5 + s * 0.5})`;
}

export function AttendanceHeatmapChart({ data }: AttendanceHeatmapChartProps) {
  const maxCount = useMemo(() => Math.max(...data.map((c) => c.count), 1), [data]);

  const grid = useMemo(() => {
    const g: HeatmapCell[][] = [];
    for (let day = 0; day < 7; day++) {
      g.push(data.filter((c) => c.dayOfWeek === day));
    }
    return g;
  }, [data]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
          <Grid3X3 className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-white font-semibold text-base">Attendance Heatmap</h3>
          <p className="text-gray-400 text-xs">Check-in density by day &amp; hour</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Hour labels header */}
          <div className="flex items-center gap-0 mb-1">
            <div className="w-10 flex-shrink-0" />
            {HOUR_LABELS.map((h, i) => (
              <div
                key={i}
                className="flex-1 text-center text-[8px] text-gray-600 font-mono"
                style={{ minWidth: 20 }}
              >
                {i % 3 === 0 ? h : ""}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          {grid.map((dayCells, dayIdx) => (
            <div key={dayIdx} className="flex items-center gap-0 mb-0.5">
              <div className="w-10 flex-shrink-0 text-[10px] text-gray-400 font-medium pr-2 text-right">
                {DAY_LABELS[dayIdx]}
              </div>
              {dayCells.map((cell, hourIdx) => (
                <motion.div
                  key={`${dayIdx}-${hourIdx}`}
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 + (dayIdx * 24 + hourIdx) * 0.002 }}
                  className="flex-1 aspect-square m-px rounded-[3px] cursor-default relative group"
                  style={{
                    backgroundColor: interpolateColor(cell.count, maxCount),
                    minWidth: 20,
                  }}
                  title={cell.label}
                >
                  {/* Tooltip */}
                  {cell.count > 0 && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                      <div className="bg-gray-900 border border-white/20 rounded-lg px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
                        <div className="text-white font-medium">
                          {formatNumber(cell.count)} attendees
                        </div>
                        <div className="text-gray-400">
                          {DAY_LABELS[cell.dayOfWeek]} {HOUR_LABELS[cell.hour]}
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          ))}

          {/* Legend */}
          <div className="flex items-center justify-end gap-2 mt-4">
            <span className="text-[10px] text-gray-500">Less</span>
            {[0, 0.15, 0.3, 0.5, 0.7, 0.85, 1].map((t) => (
              <div
                key={t}
                className="w-4 h-4 rounded-[3px]"
                style={{ backgroundColor: interpolateColor(t * maxCount, maxCount) }}
                title={`${Math.round(t * maxCount)} attendees`}
              />
            ))}
            <span className="text-[10px] text-gray-500">More</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
