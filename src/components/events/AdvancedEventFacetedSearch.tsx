import React, { useState, useEffect } from "react";
import { Search, Calendar, DollarSign, Utensils, Award, Video, Filter, RotateCcw } from "lucide-react";
import {
  FacetedSearchFilterState,
  DEFAULT_FACETED_FILTERS,
  serializeFacetedFiltersToUrl,
  parseFacetedFiltersFromUrl,
  updateFacetedFilter,
  generateIntelligentEmptyStateSuggestion,
} from "@/lib/advancedFacetedSearch";
import { cn } from "@/lib/utils";

export interface EventItem {
  id: string;
  title: string;
  description: string;
  location?: string;
  start_date: string;
  end_date?: string;
  price?: number;
  is_free?: boolean;
  has_food?: boolean;
  gives_points?: boolean;
  is_virtual?: boolean;
}

export interface AdvancedEventFacetedSearchProps {
  events?: EventItem[];
  onFilterChange?: (filters: FacetedSearchFilterState) => void;
  className?: string;
}

export const AdvancedEventFacetedSearch: React.FC<AdvancedEventFacetedSearchProps> = ({
  events = [],
  onFilterChange,
  className,
}) => {
  const [filters, setFilters] = useState<FacetedSearchFilterState>(() => {
    return typeof window !== "undefined"
      ? parseFacetedFiltersFromUrl(window.location.search)
      : DEFAULT_FACETED_FILTERS;
  });

  // Sync state to URL and trigger callback on change
  useEffect(() => {
    if (typeof window !== "undefined") {
      const newQueryStr = serializeFacetedFiltersToUrl(filters);
      const newUrl = `${window.location.pathname}${newQueryStr}${window.location.hash}`;
      if (window.location.search !== newQueryStr) {
        window.history.replaceState(null, "", newUrl);
      }
    }
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }, [filters, onFilterChange]);

  const handleUpdate = <K extends keyof FacetedSearchFilterState>(key: K, value: FacetedSearchFilterState[K]) => {
    setFilters((prev) => updateFacetedFilter(prev, key, value));
  };

  const handleReset = () => {
    setFilters(DEFAULT_FACETED_FILTERS);
  };

  // Client-side filtering simulation for mock/local event lists
  const filteredEvents = events.filter((e) => {
    if (filters.query && !e.title.toLowerCase().includes(filters.query.toLowerCase()) && !e.description?.toLowerCase().includes(filters.query.toLowerCase())) {
      return false;
    }
    if (filters.cost === "free" && e.is_free === false) return false;
    if (filters.cost === "paid" && (e.is_free === true || (e.price && e.price === 0))) return false;
    if (filters.hasFood && !e.has_food) return false;
    if (filters.givesPoints && !e.gives_points) return false;
    if (filters.format === "virtual" && !e.is_virtual) return false;
    if (filters.format === "in_person" && e.is_virtual) return false;
    return true;
  });

  const emptySuggestion = generateIntelligentEmptyStateSuggestion(filters);

  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-4 gap-6 font-mono text-sm", className)}>
      {/* Faceted Search Sidebar (#2973) */}
      <aside className="lg:col-span-1 border-2 border-black p-5 bg-peach/20 rounded-xl space-y-6 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
        <div className="flex items-center justify-between border-b-2 border-black pb-3">
          <div className="flex items-center gap-2 font-bold uppercase text-base">
            <Filter className="w-5 h-5 text-purple-600" />
            <span>Search & Facets</span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="text-xs flex items-center gap-1 font-bold text-gray-700 hover:text-black transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>

        {/* Text Search */}
        <div className="space-y-2">
          <label className="font-bold text-xs uppercase tracking-wider block">Keyword Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search title, details..."
              value={filters.query}
              onChange={(e) => handleUpdate("query", e.target.value)}
              className="w-full pl-9 pr-3 py-2 border-2 border-black bg-white focus:outline-none focus:ring-2 focus:ring-purple-400 font-sans text-sm rounded-md"
            />
          </div>
        </div>

        {/* Date Range Facet */}
        <div className="space-y-2">
          <label className="font-bold text-xs uppercase tracking-wider block flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            Date Range
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(["all", "today", "this_weekend", "custom"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => handleUpdate("dateRange", r)}
                className={cn(
                  "px-2.5 py-1.5 border-2 border-black font-mono text-xs font-bold capitalize transition-all rounded-md",
                  filters.dateRange === r
                    ? "bg-black text-white shadow-[2px_2px_0px_0px_rgba(100,100,100,1)]"
                    : "bg-white text-black hover:bg-gray-100"
                )}
              >
                {r.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Cost Facet */}
        <div className="space-y-2">
          <label className="font-bold text-xs uppercase tracking-wider block flex items-center gap-1.5">
            <DollarSign className="w-4 h-4 text-green-600" />
            Cost Filter
          </label>
          <div className="flex gap-2">
            {(["all", "free", "paid"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => handleUpdate("cost", c)}
                className={cn(
                  "flex-1 py-1.5 border-2 border-black text-xs font-bold capitalize rounded-md transition-all",
                  filters.cost === c
                    ? "bg-green-600 text-white shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                    : "bg-white text-black hover:bg-gray-100"
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        {/* Perks Facets */}
        <div className="space-y-2">
          <label className="font-bold text-xs uppercase tracking-wider block">Event Perks</label>
          <div className="space-y-2 bg-white border-2 border-black p-3 rounded-md">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
              <input
                type="checkbox"
                checked={filters.hasFood}
                onChange={(e) => handleUpdate("hasFood", e.target.checked)}
                className="w-4 h-4 border-2 border-black rounded accent-purple-600"
              />
              <Utensils className="w-4 h-4 text-orange-500" />
              <span>Food Provided 🍕</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-bold text-xs">
              <input
                type="checkbox"
                checked={filters.givesPoints}
                onChange={(e) => handleUpdate("givesPoints", e.target.checked)}
                className="w-4 h-4 border-2 border-black rounded accent-purple-600"
              />
              <Award className="w-4 h-4 text-amber-500" />
              <span>Gamification Points 🏆</span>
            </label>
          </div>
        </div>

        {/* Format Facet */}
        <div className="space-y-2">
          <label className="font-bold text-xs uppercase tracking-wider block flex items-center gap-1.5">
            <Video className="w-4 h-4 text-purple-600" />
            Format
          </label>
          <select
            value={filters.format}
            onChange={(e) => handleUpdate("format", e.target.value as FacetedSearchFilterState["format"])}
            className="w-full p-2 border-2 border-black bg-white font-mono text-xs font-bold rounded-md"
          >
            <option value="all">All Formats</option>
            <option value="in_person">In-Person Only 🏛️</option>
            <option value="virtual">Virtual Only 💻</option>
          </select>
        </div>
      </aside>

      {/* Main Results View */}
      <main className="lg:col-span-3 space-y-4">
        <div className="flex items-center justify-between border-2 border-black p-3 bg-white rounded-xl">
          <span className="font-bold">
            Showing <span className="text-purple-600">{filteredEvents.length}</span> matching events
          </span>
          <span className="text-xs text-gray-500 font-mono">Page {filters.page}</span>
        </div>

        {/* Intelligent Empty State (#2973) */}
        {filteredEvents.length === 0 ? (
          <div data-testid="faceted-empty-state" className="border-2 border-black p-8 bg-yellow-50 rounded-xl text-center space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
            <div className="text-4xl">🔍</div>
            <h3 className="text-lg font-bold">No Events Match All Criteria</h3>
            <p className="text-sm font-sans text-gray-700 max-w-md mx-auto">{emptySuggestion.message}</p>
            {emptySuggestion.relaxKey && (
              <button
                type="button"
                onClick={() => {
                  if (emptySuggestion.relaxKey === "format") handleUpdate("format", "all");
                  else if (emptySuggestion.relaxKey === "hasFood") handleUpdate("hasFood", false);
                  else if (emptySuggestion.relaxKey === "cost") handleUpdate("cost", "all");
                  else if (emptySuggestion.relaxKey === "dateRange") handleUpdate("dateRange", "all");
                  else if (emptySuggestion.relaxKey === "givesPoints") handleUpdate("givesPoints", false);
                }}
                className="px-4 py-2 border-2 border-black bg-black text-white font-bold text-xs uppercase rounded-md shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-gray-800 transition-colors"
              >
                {emptySuggestion.relaxLabel}
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredEvents.map((e) => (
              <div key={e.id} className="border-2 border-black p-4 bg-white rounded-xl space-y-2 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
                <div className="flex items-start justify-between">
                  <h4 className="font-bold text-base font-sans">{e.title}</h4>
                  <span className={cn("px-2 py-0.5 text-[10px] font-bold uppercase border border-black rounded", e.is_free ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800")}>
                    {e.is_free ? "Free" : `$${e.price || 0}`}
                  </span>
                </div>
                <p className="text-xs font-sans text-gray-600 line-clamp-2">{e.description}</p>
                <div className="flex items-center gap-2 pt-2 border-t text-[11px] text-gray-700">
                  {e.has_food && <span className="bg-orange-100 border px-1.5 py-0.5 rounded">🍕 Food</span>}
                  {e.gives_points && <span className="bg-amber-100 border px-1.5 py-0.5 rounded">🏆 Points</span>}
                  {e.is_virtual && <span className="bg-purple-100 border px-1.5 py-0.5 rounded">💻 Virtual</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
