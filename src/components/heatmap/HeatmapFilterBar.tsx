/**
 * HeatmapFilterBar — Filter controls for the campus activity heatmap.
 */

import { motion } from "framer-motion";
import { Filter, RotateCcw } from "lucide-react";
import {
  EventCategory,
  DayOfWeek,
  ALL_DAYS,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
} from "@/utils/activityHeatmap";
import { HeatmapFilters } from "@/hooks/useCampusActivity";

interface HeatmapFilterBarProps {
  filters: HeatmapFilters;
  allLocations: string[];
  onToggleDay: (day: DayOfWeek) => void;
  onToggleCategory: (cat: EventCategory) => void;
  onSetLocation: (loc: string) => void;
  onReset: () => void;
}

const ALL_CATEGORIES: EventCategory[] = [
  "academic",
  "cultural",
  "sports",
  "tech",
  "social",
  "workshop",
  "seminar",
  "concert",
  "exhibition",
  "networking",
];

export function HeatmapFilterBar({
  filters,
  allLocations,
  onToggleDay,
  onToggleCategory,
  onSetLocation,
  onReset,
}: HeatmapFilterBarProps) {
  const hasActive =
    filters.selectedDays.length > 0 ||
    filters.selectedCategories.length > 0 ||
    filters.locationFilter !== "";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Filters</span>
      </div>

      {/* Day Chips */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 mb-1.5">Days</div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_DAYS.map((day) => {
            const active = filters.selectedDays.includes(day);
            return (
              <button
                key={day}
                onClick={() => onToggleDay(day)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                  active
                    ? "bg-cyan-500/15 text-cyan-400 border-cyan-500/40"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Chips */}
      <div className="mb-3">
        <div className="text-[10px] text-gray-500 mb-1.5">Categories</div>
        <div className="flex flex-wrap gap-1.5">
          {ALL_CATEGORIES.map((cat) => {
            const active = filters.selectedCategories.includes(cat);
            const color = CATEGORY_COLORS[cat];
            return (
              <button
                key={cat}
                onClick={() => onToggleCategory(cat)}
                className={`px-3 py-1 rounded-lg text-[11px] font-medium border transition-all capitalize ${
                  active
                    ? "text-white shadow-sm"
                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                }`}
                style={
                  active
                    ? { color, borderColor: `${color}60`, backgroundColor: `${color}15` }
                    : undefined
                }
              >
                {CATEGORY_LABELS[cat]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Location + Reset */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <span className="text-[10px] text-gray-500">Venue</span>
          <select
            value={filters.locationFilter}
            onChange={(e) => onSetLocation(e.target.value)}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer appearance-auto max-w-[160px]"
          >
            <option value="" className="bg-gray-900">
              All Venues
            </option>
            {allLocations.map((loc) => (
              <option key={loc} value={loc} className="bg-gray-900">
                {loc}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1" />

        {hasActive && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-medium hover:bg-rose-500/20 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Clear All
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
