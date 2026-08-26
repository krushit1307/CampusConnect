import { describe, it, expect, vi } from "vitest";
import { searchService } from "../src/services/searchService";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

describe("searchService", () => {
  it("should not call RPC if query is empty", async () => {
    const result = await searchService.searchEvents({ query: "   " });
    expect(result).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("should call search_events RPC and return data", async () => {
    const mockRpc = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: [{ id: "1", title: "Test Event" }], error: null }),
      }),
    });
    vi.mocked(createClient).mockReturnValue({ rpc: mockRpc } as unknown as ReturnType<
      typeof createClient
    >);

    const result = await searchService.searchEvents({ query: "Test" });
expect(mockRpc).toHaveBeenCalledWith("search_events", {
  query_text: "Test",
  category_filter: null,
  date_filter: null,
});    expect(result).toEqual([{ id: "1", title: "Test Event" }]);
  });
});
