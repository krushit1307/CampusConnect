/**
 * TimeSlotGrid — Day × Hour heatmap grid showing event density.
 * Each cell is colored by event count, with hover details.
 */

import { motion } from "framer-motion";
import {
  ALL_DAYS,
  ALL_HOURS,
  TimeSlotActivity,
  getHeatColor,
  DayOfWeek,
} from "@/utils/activityHeatmap";

interface TimeSlotGridProps {
  timeSlots: TimeSlotActivity[];
  maxValue: number;
  hoveredSlot: { day: DayOfWeek; hour: number } | null;
  onHover: (slot: { day: DayOfWeek; hour: number } | null) => void;
}

function formatHour(hour: number): string {
  if (hour === 0 || hour === 12) return `${hour === 0 ? 12 : 12}${hour < 12 ? "a" : "p"}`;
  return `${hour > 12 ? hour - 12 : hour}${hour < 12 ? "a" : "p"}`;
}

export function TimeSlotGrid({ timeSlots, maxValue, hoveredSlot, onHover }: TimeSlotGridProps) {
  // Build a lookup map for O(1) access
  const slotMap = new Map<string, TimeSlotActivity>();
  for (const slot of timeSlots) {
    slotMap.set(`${slot.day}-${slot.hour}`, slot);
  }

  return (
    <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 overflow-x-auto">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-3 h-3 rounded-full bg-gradient-to-r from-indigo-500 to-pink-500" />
        <h3 className="text-white font-semibold text-sm">Campus Activity Heatmap</h3>
        <span className="text-gray-500 text-[10px] ml-auto">Day × Hour</span>
      </div>

      <div className="min-w-[700px]">
        {/* Hour headers */}
        <div className="flex mb-1">
          <div className="w-12 shrink-0" />
          {ALL_HOURS.map((hour) => (
            <div key={hour} className="flex-1 text-center text-[9px] text-gray-500 font-mono">
              {formatHour(hour)}
            </div>
          ))}
        </div>

        {/* Day rows */}
        {ALL_DAYS.map((day) => (
          <div key={day} className="flex items-center mb-0.5">
            <div className="w-12 shrink-0 text-[10px] text-gray-400 font-medium pr-2 text-right">
              {day}
            </div>
            {ALL_HOURS.map((hour) => {
              const slot = slotMap.get(`${day}-${hour}`);
              const count = slot?.eventCount || 0;
              const isHovered = hoveredSlot?.day === day && hoveredSlot?.hour === hour;

              return (
                <motion.div
                  key={`${day}-${hour}`}
                  className="flex-1 aspect-square mx-px rounded-sm cursor-pointer relative group"
                  style={{ backgroundColor: getHeatColor(count, maxValue) }}
                  onMouseEnter={() => onHover({ day, hour })}
                  onMouseLeave={() => onHover(null)}
                  whileHover={{ scale: 1.3, zIndex: 10 }}
                  transition={{ duration: 0.15 }}
                >
                  {count > 0 && (
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] text-white/80 font-bold">
                      {count}
                    </span>
                  )}

                  {/* Tooltip */}
                  {isHovered && slot && (
                    <motion.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 bg-gray-900/95 border border-white/20 rounded-xl px-3 py-2 shadow-xl whitespace-nowrap pointer-events-none"
                    >
                      <div className="text-white text-[11px] font-semibold">
                        {day} at {formatHour(hour)}
                      </div>
                      <div className="text-gray-400 text-[10px]">
                        {count} event{count !== 1 ? "s" : ""} · {slot.totalRsvps} RSVPs
                      </div>
                      <div className="text-cyan-400 text-[10px]">
                        Fill rate: {Math.round(slot.avgFillRate * 100)}%
                      </div>
                      {/* Mini category breakdown */}
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(slot.categories)
                          .filter(([, c]) => c > 0)
                          .slice(0, 4)
                          .map(([cat, c]) => (
                            <span
                              key={cat}
                              className="text-[8px] text-gray-300 bg-white/10 px-1 rounded"
                            >
                              {cat}: {c}
                            </span>
                          ))}
                      </div>
                      <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900/95" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2 mt-4">
        <span className="text-[9px] text-gray-500">Low</span>
        {[0, 0.2, 0.4, 0.6, 0.8, 1.0].map((v) => (
          <div
            key={v}
            className="w-4 h-3 rounded-sm"
            style={{ backgroundColor: getHeatColor(v * maxValue, maxValue) }}
          />
        ))}
        <span className="text-[9px] text-gray-500">High</span>
      </div>
    </div>
  );
}
