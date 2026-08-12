import { describe, expect, it, vi, beforeEach } from "vitest";
import { searchService } from "../src/services/searchService";

const mockRpc = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    rpc: mockRpc,
  }),
}));

describe("advanced event search", () => {
  beforeEach(() => {
    mockRpc.mockReset();
  });

  it("calls the fuzzy event search RPC with the search query", async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          id: "event-1",
          title: "Science Hackathon",
        },
      ],
      error: null,
    });

    const result = await searchService.searchEvents({
      query: "sience",
    });

    expect(mockRpc).toHaveBeenCalledWith("search_events", {
      query_text: "sience",
      category_filter: null,
      date_filter: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0].title).toBe("Science Hackathon");
  });

  it("passes the category filter to the RPC", async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    await searchService.searchEvents({
      query: "hackathon",
      categoryFilter: "Academic",
    });

    expect(mockRpc).toHaveBeenCalledWith("search_events", {
      query_text: "hackathon",
      category_filter: "Academic",
      date_filter: null,
    });
  });

  it("passes the date filter to the RPC", async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    await searchService.searchEvents({
      query: "science",
      dateFilter: "this_week",
    });

    expect(mockRpc).toHaveBeenCalledWith("search_events", {
      query_text: "science",
      category_filter: null,
      date_filter: "this_week",
    });
  });

  it("passes both filters securely as RPC parameters", async () => {
    mockRpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const maliciousQuery = "'; DROP TABLE events; --";

    await searchService.searchEvents({
      query: maliciousQuery,
      categoryFilter: "Academic",
      dateFilter: "this_week",
    });

    expect(mockRpc).toHaveBeenCalledWith("search_events", {
      query_text: maliciousQuery,
      category_filter: "Academic",
      date_filter: "this_week",
    });
  });

  it("returns an empty array when the RPC returns no rows", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: null,
    });

    const result = await searchService.searchEvents({
      query: "science",
    });

    expect(result).toEqual([]);
  });

  it("throws when the RPC reports an error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: new Error("Search failed"),
    });

    await expect(
      searchService.searchEvents({
        query: "science",
      }),
    ).rejects.toThrow("Search failed");
  });
});