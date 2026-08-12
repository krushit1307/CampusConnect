import { create } from "zustand";

export interface DirectoryFilters {
  search: string;
  category: string;
  status: string;
  sort: string;
}

export const DEFAULT_DIRECTORY_FILTERS: DirectoryFilters = {
  search: "",
  category: "all",
  status: "all",
  sort: "popular",
};

export interface DirectoryStoreState extends DirectoryFilters {
  setSearch: (search: string) => void;
  setCategory: (category: string) => void;
  setStatus: (status: string) => void;
  setSort: (sort: string) => void;
  setFilters: (filters: Partial<DirectoryFilters>) => void;
  hydrateFromUrl: (queryString?: string) => void;
  resetFilters: () => void;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Parses URL search query string and extracts non-default filter values (#1746).
 */
export function parseUrlParams(queryString?: string): Partial<DirectoryFilters> {
  const searchStr = queryString ?? (typeof window !== "undefined" ? window.location.search : "");
  if (!searchStr) return {};

  const params = new URLSearchParams(searchStr);
  const parsed: Partial<DirectoryFilters> = {};

  const search = params.get("search");
  if (search) parsed.search = search;

  const category = params.get("category");
  if (category) parsed.category = category;

  const status = params.get("status");
  if (status) parsed.status = status;

  const sort = params.get("sort");
  if (sort) parsed.sort = sort;

  return parsed;
}

/**
 * Converts directory filter state into clean URL query string parameters,
 * cleanly omitting default values to keep URLs short (#1746).
 */
export function buildQueryString(filters: DirectoryFilters): string {
  const params = new URLSearchParams();

  if (filters.search && filters.search.trim() !== DEFAULT_DIRECTORY_FILTERS.search) {
    params.set("search", filters.search.trim());
  }
  if (filters.category && filters.category !== DEFAULT_DIRECTORY_FILTERS.category) {
    params.set("category", filters.category);
  }
  if (filters.status && filters.status !== DEFAULT_DIRECTORY_FILTERS.status) {
    params.set("status", filters.status);
  }
  if (filters.sort && filters.sort !== DEFAULT_DIRECTORY_FILTERS.sort) {
    params.set("sort", filters.sort);
  }

  const queryStr = params.toString();
  return queryStr ? `?${queryStr}` : "";
}

/**
 * Syncs directory filter state to browser URL search params (`history.replaceState`).
 */
export function updateUrlParams(filters: DirectoryFilters, immediate = true): void {
  if (typeof window === "undefined") return;

  const performUpdate = () => {
    const newQueryStr = buildQueryString(filters);
    const newUrl = `${window.location.pathname}${newQueryStr}${window.location.hash}`;
    if (window.location.search !== newQueryStr) {
      window.history.replaceState(null, "", newUrl);
    }
  };

  if (immediate) {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    performUpdate();
  } else {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(performUpdate, 500); // 500ms debounce for search input (#1746)
  }
}

/**
 * Initial hydration from URL params on store initialization.
 */
const initialParsed = typeof window !== "undefined" ? parseUrlParams() : {};

export const useDirectoryStore = create<DirectoryStoreState>((set, get) => ({
  ...DEFAULT_DIRECTORY_FILTERS,
  ...initialParsed,

  setSearch: (search: string) => {
    set({ search });
    updateUrlParams({ ...get(), search }, false); // 500ms debounced URL update
  },

  setCategory: (category: string) => {
    set({ category });
    updateUrlParams({ ...get(), category }, true);
  },

  setStatus: (status: string) => {
    set({ status });
    updateUrlParams({ ...get(), status }, true);
  },

  setSort: (sort: string) => {
    set({ sort });
    updateUrlParams({ ...get(), sort }, true);
  },

  setFilters: (newFilters: Partial<DirectoryFilters>) => {
    set((state) => {
      const updated = { ...state, ...newFilters };
      updateUrlParams(updated, true);
      return updated;
    });
  },

  hydrateFromUrl: (queryString?: string) => {
    const parsed = parseUrlParams(queryString);
    const hydratedState = { ...DEFAULT_DIRECTORY_FILTERS, ...parsed };
    set(hydratedState);
  },

  resetFilters: () => {
    set(DEFAULT_DIRECTORY_FILTERS);
    updateUrlParams(DEFAULT_DIRECTORY_FILTERS, true);
  },
}));
