import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  useDirectoryStore,
  parseUrlParams,
  buildQueryString,
  DEFAULT_DIRECTORY_FILTERS,
} from "./useDirectoryStore";

describe("useDirectoryStore & URL Sync (#1746)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useDirectoryStore.getState().resetFilters();
    // Reset browser location mock
    window.history.replaceState(null, "", "/directory");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("parses URL search query parameters correctly", () => {
    const parsed = parseUrlParams("?category=Tech&status=Active&sort=Popular&search=Coding");

    expect(parsed).toEqual({
      category: "Tech",
      status: "Active",
      sort: "Popular",
      search: "Coding",
    });
  });

  it("omits default values when building URL query string to keep URLs clean", () => {
    // All defaults -> empty query string
    expect(buildQueryString(DEFAULT_DIRECTORY_FILTERS)).toBe("");

    // Custom values -> clean query string
    const customQuery = buildQueryString({
      search: "Robotics",
      category: "Tech",
      status: "Active",
      sort: "Popular",
    });

    expect(customQuery).toBe("?search=Robotics&category=Tech&status=Active&sort=Popular");
  });

  it("hydrates Zustand store state from URL on call", () => {
    useDirectoryStore.getState().hydrateFromUrl("?category=Arts&status=Pending&sort=Newest");

    const state = useDirectoryStore.getState();
    expect(state.category).toBe("Arts");
    expect(state.status).toBe("Pending");
    expect(state.sort).toBe("Newest");
  });

  it("immediately syncs category, status, and sort filter updates to URL", () => {
    const store = useDirectoryStore.getState();
    store.setCategory("Tech");
    store.setStatus("Active");

    expect(window.location.search).toBe("?category=Tech&status=Active");
  });

  it("debounces search filter URL update by 500ms to prevent flooding history", () => {
    const store = useDirectoryStore.getState();
    store.setSearch("Rob");

    // Before 500ms, search query not yet flushed to URL
    expect(window.location.search).toBe("");

    // Fast-forward timers by 500ms
    vi.advanceTimersByTime(500);

    expect(window.location.search).toBe("?search=Rob");
  });

  it("clears URL parameters when resetting filters", () => {
    const store = useDirectoryStore.getState();
    store.setCategory("Tech");
    expect(window.location.search).toBe("?category=Tech");

    store.resetFilters();
    expect(window.location.search).toBe("");
  });
});
