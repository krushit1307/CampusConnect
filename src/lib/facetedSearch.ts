export interface EventItem {
  id: string;
  title: string;
  category: string;
  hasFreeFood: boolean;
  startTime: string; // ISO String
}

export interface FacetFilterState {
  searchQuery?: string;
  categories?: string[];
  hasFreeFood?: boolean;
  startDate?: string;
  endDate?: string;
}

/**
 * Parses search URL search params into structured filter state.
 */
export function parseFilterParams(searchParams: URLSearchParams): FacetFilterState {
  const query = searchParams.get("q") || undefined;
  const categoriesParam = searchParams.get("category");
  const categories = categoriesParam ? categoriesParam.split(",") : undefined;
  const hasFreeFoodParam = searchParams.get("hasFood");
  const hasFreeFood = hasFreeFoodParam === "true" ? true : undefined;
  const startDate = searchParams.get("startDate") || undefined;
  const endDate = searchParams.get("endDate") || undefined;

  return {
    searchQuery: query,
    categories,
    hasFreeFood,
    startDate,
    endDate,
  };
}

/**
 * Serializes filter state into a URL query parameter string.
 */
export function serializeFilterParams(state: FacetFilterState): string {
  const params = new URLSearchParams();

  if (state.searchQuery) params.set("q", state.searchQuery);
  if (state.categories && state.categories.length > 0) {
    params.set("category", state.categories.join(","));
  }
  if (state.hasFreeFood !== undefined) {
    params.set("hasFood", String(state.hasFreeFood));
  }
  if (state.startDate) params.set("startDate", state.startDate);
  if (state.endDate) params.set("endDate", state.endDate);

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

/**
 * Filters in-memory event array based on active facet filters.
 */
export function filterEvents(events: EventItem[], filters: FacetFilterState): EventItem[] {
  return events.filter((event) => {
    // 1. Text Search Query
    if (filters.searchQuery) {
      const q = filters.searchQuery.toLowerCase();
      if (!event.title.toLowerCase().includes(q)) return false;
    }

    // 2. Category Filter
    if (filters.categories && filters.categories.length > 0) {
      if (!filters.categories.includes(event.category)) return false;
    }

    // 3. Free Food Filter
    if (filters.hasFreeFood !== undefined && filters.hasFreeFood) {
      if (!event.hasFreeFood) return false;
    }

    // 4. Date Range Filter
    if (filters.startDate) {
      if (new Date(event.startTime) < new Date(filters.startDate)) return false;
    }
    if (filters.endDate) {
      if (new Date(event.startTime) > new Date(filters.endDate)) return false;
    }

    return true;
  });
}
