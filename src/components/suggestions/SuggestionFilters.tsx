import { Search, SlidersHorizontal, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSuggestionStore } from "@/store/useSuggestionStore";
import { CATEGORY_META, STATUS_META } from "@/types/suggestions";
import type { SuggestionCategory, SuggestionStatus, SortOption } from "@/types/suggestions";
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";

export function SuggestionFilters() {
  const { filters, setFilter, resetFilters } = useSuggestionStore();
  const [isExpanded, setIsExpanded] = useState(false);

  const activeFilterCount =
    (filters.category !== "all" ? 1 : 0) +
    (filters.status !== "all" ? 1 : 0) +
    (filters.search ? 1 : 0);

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilter("search", e.target.value);
    },
    [setFilter],
  );

  const clearSearch = useCallback(() => {
    setFilter("search", "");
  }, [setFilter]);

  return (
    <div className="space-y-3">
      {/* Primary row: Search + toggle */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search suggestions..."
            value={filters.search}
            onChange={handleSearchChange}
            className="pl-9 pr-9 h-10 rounded-full border-gray-300 focus:border-indigo-500 focus:ring-indigo-500"
            aria-label="Search suggestions"
          />
          {filters.search && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "gap-2 rounded-full border-gray-300 h-10 px-4",
            isExpanded && "bg-indigo-50 border-indigo-300 text-indigo-700",
          )}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge
              variant="secondary"
              className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-indigo-600 text-white text-[10px]"
            >
              {activeFilterCount}
            </Badge>
          )}
        </Button>

        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="gap-1.5 text-gray-500 hover:text-gray-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Clear
          </Button>
        )}
      </div>

      {/* Expanded filter row */}
      {isExpanded && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-200">
          {/* Category filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Category
            </label>
            <Select
              value={filters.category}
              onValueChange={(val) => setFilter("category", val as SuggestionCategory | "all")}
            >
              <SelectTrigger className="w-36 h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {(Object.keys(CATEGORY_META) as SuggestionCategory[]).map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {CATEGORY_META[cat].icon} {CATEGORY_META[cat].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status filter */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Status
            </label>
            <Select
              value={filters.status}
              onValueChange={(val) => setFilter("status", val as SuggestionStatus | "all")}
            >
              <SelectTrigger className="w-36 h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {(Object.keys(STATUS_META) as SuggestionStatus[]).map((status) => (
                  <SelectItem key={status} value={status}>
                    <span className="flex items-center gap-2">
                      <span className={cn("h-2 w-2 rounded-full", STATUS_META[status].dotClass)} />
                      {STATUS_META[status].label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sort */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
              Sort By
            </label>
            <Select
              value={filters.sort}
              onValueChange={(val) => setFilter("sort", val as SortOption)}
            >
              <SelectTrigger className="w-36 h-9 rounded-lg text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest First</SelectItem>
                <SelectItem value="most_voted">Most Voted</SelectItem>
                <SelectItem value="most_discussed">Most Discussed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {/* Active filter pills */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {filters.category !== "all" && (
            <Badge
              variant="outline"
              className="gap-1 bg-white cursor-pointer hover:bg-red-50 hover:border-red-300 transition-colors"
              onClick={() => setFilter("category", "all")}
            >
              {CATEGORY_META[filters.category].icon} {CATEGORY_META[filters.category].label}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.status !== "all" && (
            <Badge
              variant="outline"
              className="gap-1 bg-white cursor-pointer hover:bg-red-50 hover:border-red-300 transition-colors"
              onClick={() => setFilter("status", "all")}
            >
              {STATUS_META[filters.status].label}
              <X className="h-3 w-3" />
            </Badge>
          )}
          {filters.search && (
            <Badge
              variant="outline"
              className="gap-1 bg-white cursor-pointer hover:bg-red-50 hover:border-red-300 transition-colors"
              onClick={clearSearch}
            >
              &quot;{filters.search}&quot;
              <X className="h-3 w-3" />
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
