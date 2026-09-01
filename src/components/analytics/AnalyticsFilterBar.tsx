/**
 * AnalyticsFilterBar — Controls for filtering the analytics dashboard
 * by date range, event category, and organizing club.
 */

import { motion } from "framer-motion";
import { Filter, RotateCcw, Download } from "lucide-react";
import { FilterOptions } from "@/utils/attendanceAnalytics";

interface AnalyticsFilterBarProps {
  filters: FilterOptions;
  availableCategories: string[];
  availableClubs: string[];
  onUpdateFilter: (patch: Partial<FilterOptions>) => void;
  onReset: () => void;
  onExport: () => void;
}

const DATE_RANGES: { value: FilterOptions["dateRange"]; label: string }[] = [
  { value: "7d", label: "7 Days" },
  { value: "30d", label: "30 Days" },
  { value: "90d", label: "90 Days" },
  { value: "1y", label: "1 Year" },
  { value: "all", label: "All Time" },
];

export function AnalyticsFilterBar({
  filters,
  availableCategories,
  availableClubs,
  onUpdateFilter,
  onReset,
  onExport,
}: AnalyticsFilterBarProps) {
  const hasActiveFilters =
    filters.dateRange !== "all" || filters.category !== "all" || filters.club !== "all";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4"
    >
      <div className="flex items-center flex-wrap gap-4">
        {/* Filter Icon + Label */}
        <div className="flex items-center gap-2 text-gray-400">
          <Filter className="w-4 h-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Filters</span>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-1 bg-white/5 rounded-lg p-1">
          {DATE_RANGES.map((dr) => (
            <button
              key={dr.value}
              onClick={() => onUpdateFilter({ dateRange: dr.value })}
              className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all ${
                filters.dateRange === dr.value
                  ? "bg-white/10 text-white shadow-sm"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              {dr.label}
            </button>
          ))}
        </div>

        {/* Category */}
        <select
          value={filters.category}
          onChange={(e) => onUpdateFilter({ category: e.target.value })}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer appearance-auto"
        >
          <option value="all" className="bg-gray-900">
            All Categories
          </option>
          {availableCategories.map((cat) => (
            <option key={cat} value={cat} className="bg-gray-900 capitalize">
              {cat}
            </option>
          ))}
        </select>

        {/* Club */}
        <select
          value={filters.club}
          onChange={(e) => onUpdateFilter({ club: e.target.value })}
          className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/50 cursor-pointer appearance-auto"
        >
          <option value="all" className="bg-gray-900">
            All Clubs
          </option>
          {availableClubs.map((club) => (
            <option key={club} value={club} className="bg-gray-900">
              {club}
            </option>
          ))}
        </select>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Reset */}
        {hasActiveFilters && (
          <motion.button
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/20 text-[11px] font-medium hover:bg-rose-500/20 transition-all"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </motion.button>
        )}

        {/* Export */}
        <button
          onClick={onExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 text-[11px] font-medium hover:text-white hover:bg-white/10 transition-all"
        >
          <Download className="w-3 h-3" />
          Export CSV
        </button>
      </div>
    </motion.div>
  );
}
