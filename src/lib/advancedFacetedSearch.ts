export interface FacetedSearchFilterState {
  query: string;
  dateRange: "all" | "today" | "this_weekend" | "custom";
  startDate: string | null;
  endDate: string | null;
  cost: "all" | "free" | "paid";
  hasFood: boolean;
  givesPoints: boolean;
  format: "all" | "in_person" | "virtual";
  page: number;
}

export const DEFAULT_FACETED_FILTERS: FacetedSearchFilterState = {
  query: "",
  dateRange: "all",
  startDate: null,
  endDate: null,
  cost: "all",
  hasFood: false,
  givesPoints: false,
  format: "all",
  page: 1,
};

/**
 * Serializes faceted filter state into URL query parameter string (#2973).
 * Cleanly omits default parameter values to keep shareable links clean and short.
 */
export function serializeFacetedFiltersToUrl(filters: FacetedSearchFilterState): string {
  const params = new URLSearchParams();

  if (filters.query && filters.query.trim() !== "") {
    params.set("query", filters.query.trim());
  }
  if (filters.dateRange && filters.dateRange !== "all") {
    params.set("dateRange", filters.dateRange);
  }
  if (filters.startDate) {
    params.set("start", filters.startDate);
  }
  if (filters.endDate) {
    params.set("end", filters.endDate);
  }
  if (filters.cost && filters.cost !== "all") {
    params.set("cost", filters.cost);
  }
  if (filters.hasFood) {
    params.set("food", "true");
  }
  if (filters.givesPoints) {
    params.set("points", "true");
  }
  if (filters.format && filters.format !== "all") {
    params.set("format", filters.format);
  }
  if (filters.page && filters.page > 1) {
    params.set("page", String(filters.page));
  }

  const queryStr = params.toString();
  return queryStr ? `?${queryStr}` : "";
}

/**
 * Parses URL search query string into FacetedSearchFilterState (#2973).
 */
export function parseFacetedFiltersFromUrl(searchStr: string): FacetedSearchFilterState {
  if (!searchStr) return { ...DEFAULT_FACETED_FILTERS };

  const params = new URLSearchParams(searchStr);
  const parsed: FacetedSearchFilterState = { ...DEFAULT_FACETED_FILTERS };

  const query = params.get("query");
  if (query) parsed.query = query;

  const dateRange = params.get("dateRange");
  if (dateRange && ["all", "today", "this_weekend", "custom"].includes(dateRange)) {
    parsed.dateRange = dateRange as FacetedSearchFilterState["dateRange"];
  }

  const start = params.get("start");
  if (start) parsed.startDate = start;

  const end = params.get("end");
  if (end) parsed.endDate = end;

  const cost = params.get("cost");
  if (cost && ["all", "free", "paid"].includes(cost)) {
    parsed.cost = cost as FacetedSearchFilterState["cost"];
  }

  if (params.get("food") === "true") {
    parsed.hasFood = true;
  }
  if (params.get("points") === "true") {
    parsed.givesPoints = true;
  }

  const format = params.get("format");
  if (format && ["all", "in_person", "virtual"].includes(format)) {
    parsed.format = format as FacetedSearchFilterState["format"];
  }

  const page = params.get("page");
  if (page && !isNaN(Number(page))) {
    parsed.page = Math.max(1, Number(page));
  }

  return parsed;
}

/**
 * Updates a filter parameter and automatically resets pagination cursor back to Page 1 (#2973).
 * Prevent users from being left stranded on an empty Page 5 when applying filters.
 */
export function updateFacetedFilter<K extends keyof FacetedSearchFilterState>(
  currentState: FacetedSearchFilterState,
  key: K,
  value: FacetedSearchFilterState[K]
): FacetedSearchFilterState {
  const updated = {
    ...currentState,
    [key]: value,
  };

  // Changing any filter parameter MUST reset pagination back to Page 1
  if (key !== "page") {
    updated.page = 1;
  }

  return updated;
}

/**
 * Generates an intelligent empty state suggestion when 0 events match hyper-specific criteria (#2973).
 * Example: "No events match all criteria. Try removing the 'Virtual' filter to see in-person events."
 */
export function generateIntelligentEmptyStateSuggestion(
  filters: FacetedSearchFilterState
): { message: string; relaxKey: keyof FacetedSearchFilterState | null; relaxLabel: string } {
  if (filters.format === "virtual") {
    return {
      message: "No virtual events match all criteria. Try switching to 'In-Person' or 'All Formats'.",
      relaxKey: "format",
      relaxLabel: "Clear Format Filter",
    };
  }

  if (filters.hasFood) {
    return {
      message: "No food-provided events match all criteria. Try removing the 'Has Food' perk filter.",
      relaxKey: "hasFood",
      relaxLabel: "Remove Food Filter",
    };
  }

  if (filters.cost === "free") {
    return {
      message: "No free events found for these criteria. Try including paid events.",
      relaxKey: "cost",
      relaxLabel: "Include Paid Events",
    };
  }

  if (filters.dateRange !== "all") {
    return {
      message: "No events found for this specific date range. Try expanding your date filter to 'All Dates'.",
      relaxKey: "dateRange",
      relaxLabel: "Reset Date Range",
    };
  }

  if (filters.givesPoints) {
    return {
      message: "No point-granting events match your search. Try removing the gamification points filter.",
      relaxKey: "givesPoints",
      relaxLabel: "Remove Points Filter",
    };
  }

  return {
    message: "No events match all selected criteria. Try resetting your search filters.",
    relaxKey: null,
    relaxLabel: "Reset All Filters",
  };
}
