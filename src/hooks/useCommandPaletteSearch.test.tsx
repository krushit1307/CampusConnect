// @vitest-environment jsdom

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClientProvider, queryClient } from "@/hooks/useReactQueryReplacement";
import { useCommandPaletteSearch } from "./useCommandPaletteSearch";
import { searchService } from "@/services/searchService";

vi.mock("@/services/searchService", () => ({
  searchService: {
    globalSearch: vi.fn(),
  },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe("useCommandPaletteSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(searchService.globalSearch).mockResolvedValue([]);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not query while the query is empty", async () => {
    const { result } = renderHook(() => useCommandPaletteSearch(""), { wrapper });

    expect(result.current.results).toEqual([]);
    expect(searchService.globalSearch).not.toHaveBeenCalled();
  });

  it("debounces queries by 300ms before calling globalSearch", async () => {
    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCommandPaletteSearch(query),
      { wrapper, initialProps: { query: "" } },
    );

    rerender({ query: "tech" });

    // Before the debounce elapses, no query should fire.
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(searchService.globalSearch).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(1);
    });
    await waitFor(() => {
      expect(searchService.globalSearch).toHaveBeenCalledWith("tech");
    });

    expect(result.current.isLoading).toBe(false);
  });

  it("maps global_search rows to CommandSearchResult with entity-specific paths", async () => {
    vi.mocked(searchService.globalSearch).mockResolvedValue([
      {
        entity_type: "event",
        id: "evt-1",
        label: "Tech Fest",
        description: "Annual tech fest",
        sublabel: "event",
        short_id: "tf-2026",
        slug: null,
        handle: null,
        first_name: null,
        last_name: null,
        avatar_url: null,
        club_name: null,
        rank: 1,
      },
      {
        entity_type: "club",
        id: "clb-1",
        label: "Coding Club",
        description: "We code",
        sublabel: "club",
        short_id: null,
        slug: "coding-club",
        handle: null,
        first_name: null,
        last_name: null,
        avatar_url: null,
        club_name: null,
        rank: 2,
      },
      {
        entity_type: "profile",
        id: "usr-1",
        label: "Jane Doe",
        description: "",
        sublabel: "user",
        short_id: null,
        slug: null,
        handle: "jane",
        first_name: "Jane",
        last_name: "Doe",
        avatar_url: null,
        club_name: null,
        rank: 3,
      },
    ]);

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCommandPaletteSearch(query),
      { wrapper, initialProps: { query: "" } },
    );

    rerender({ query: "tech" });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.results).toEqual([
        {
          id: "evt-1",
          type: "event",
          label: "Tech Fest",
          sublabel: "Event",
          path: "/events/tf-2026",
        },
        {
          id: "clb-1",
          type: "club",
          label: "Coding Club",
          sublabel: "Club",
          path: "/clubs/coding-club",
        },
        { id: "usr-1", type: "person", label: "Jane Doe", sublabel: "User", path: "/profile/jane" },
      ]);
    });
  });

  it("filters results to the scoped entity when using a prefix", async () => {
    vi.mocked(searchService.globalSearch).mockResolvedValue([
      {
        entity_type: "event",
        id: "evt-1",
        label: "Tech Fest",
        description: "",
        sublabel: "event",
        short_id: "tf-2026",
        slug: null,
        handle: null,
        first_name: null,
        last_name: null,
        avatar_url: null,
        club_name: null,
        rank: 1,
      },
      {
        entity_type: "club",
        id: "clb-1",
        label: "Coding Club",
        description: "",
        sublabel: "club",
        short_id: null,
        slug: "coding-club",
        handle: null,
        first_name: null,
        last_name: null,
        avatar_url: null,
        club_name: null,
        rank: 2,
      },
    ]);

    const { result, rerender } = renderHook(
      ({ query }: { query: string }) => useCommandPaletteSearch(query),
      { wrapper, initialProps: { query: "" } },
    );

    rerender({ query: "clubs:tech" });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(result.current.results).toEqual([
        {
          id: "clb-1",
          type: "club",
          label: "Coding Club",
          sublabel: "Club",
          path: "/clubs/coding-club",
        },
      ]);
    });
  });
});
