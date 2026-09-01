/**
 * RecommendationFilters — Filter controls for the recommendation engine
 * allowing users to narrow recommendations by category, price, rating, and date.
 */

import { motion } from "framer-motion";
import { Filter, RotateCcw, DollarSign, Star, Calendar } from "lucide-react";
import { EventCategory } from "@/utils/recommendationEngine";
import { RecommendationFilters as FilterType } from "@/hooks/useEventRecommendations";

interface RecommendationFiltersProps {
  filters: FilterType;
  onToggleCategory: (cat: EventCategory) => void;
  onUpdateFilter: (patch: Partial<FilterType>) => void;
  onReset: () => void;
}

const ALL_CATEGORIES: EventCategory[] = [
  "tech",
  "workshop",
  "seminar",
  "networking",
  "social",
  "cultural",
  "sports",
  "concert",
  "exhibition",
  "academic",
];

const CATEGORY_COLORS: Record<EventCategory, string> = {
  academic: "#3b82f6",
  cultural: "#a855f7",
  sports: "#10b981",
  tech: "#06b6d4",
  social: "#f59e0b",
  workshop: "#ec4899",
  seminar: "#6366f1",
  concert: "#f43f5e",
  exhibition: "#14b8a6",
  networking: "#f97316",
};

export function RecommendationFilters({
  filters,
  onToggleCategory,
  onUpdateFilter,
  onReset,
}: RecommendationFiltersProps) {
  const hasActive =
    filters.categories.length > 0 ||
    filters.maxPrice < Infinity ||
    filters.minRating > 0 ||
    filters.dateRange !== "all";

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-4"
    >
      <div className="flex items-center gap-2 mb-3">
        <Filter className="w-4 h-4 text-gray-400" />
        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Refine</span>
      </div>

      {/* Category Chips */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {ALL_CATEGORIES.map((cat) => {
          const active = filters.categories.includes(cat);
          const color = CATEGORY_COLORS[cat];
          return (
            <button
              key={cat}
              onClick={() => onToggleCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all capitalize ${
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
              {cat}
            </button>
          );
        })}
      </div>

      {/* Dropdown Row */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Price Filter */}
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <DollarSign className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filters.maxPrice === Infinity ? "any" : filters.maxPrice}
            onChange={(e) =>
              onUpdateFilter({
                maxPrice: e.target.value === "any" ? Infinity : Number(e.target.value),
              })
            }
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer appearance-auto"
          >
            <option value="any" className="bg-gray-900">
              Any Price
            </option>
            <option value="0" className="bg-gray-900">
              Free Only
            </option>
            <option value="100" className="bg-gray-900">
              Under ₹100
            </option>
            <option value="200" className="bg-gray-900">
              Under ₹200
            </option>
            <option value="500" className="bg-gray-900">
              Under ₹500
            </option>
          </select>
        </div>

        {/* Rating Filter */}
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <Star className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filters.minRating}
            onChange={(e) => onUpdateFilter({ minRating: Number(e.target.value) })}
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer appearance-auto"
          >
            <option value="0" className="bg-gray-900">
              Any Rating
            </option>
            <option value="4" className="bg-gray-900">
              4.0+ Stars
            </option>
            <option value="4.5" className="bg-gray-900">
              4.5+ Stars
            </option>
            <option value="4.8" className="bg-gray-900">
              4.8+ Stars
            </option>
          </select>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={filters.dateRange}
            onChange={(e) =>
              onUpdateFilter({ dateRange: e.target.value as FilterType["dateRange"] })
            }
            className="bg-transparent text-xs text-white focus:outline-none cursor-pointer appearance-auto"
          >
            <option value="all" className="bg-gray-900">
              Any Date
            </option>
            <option value="7d" className="bg-gray-900">
              Next 7 Days
            </option>
            <option value="14d" className="bg-gray-900">
              Next 14 Days
            </option>
            <option value="30d" className="bg-gray-900">
              Next 30 Days
            </option>
          </select>
        </div>

        <div className="flex-1" />

        {/* Reset */}
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
