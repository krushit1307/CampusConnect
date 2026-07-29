import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchGraphQL, EVENTS_CONNECTION_QUERY } from "./useCursorEventsQuery";

global.fetch = vi.fn();

describe("useCursorEventsQuery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchGraphQL posts query to /api/graphql and returns data", async () => {
    const mockData = {
      events: {
        edges: [
          {
            cursor: "Y3Vyc29yLTE=",
            node: { id: "evt-1", title: "Cursor Event 1" },
          },
        ],
        nodes: [{ id: "evt-1", title: "Cursor Event 1" }],
        pageInfo: {
          hasNextPage: true,
          hasPreviousPage: false,
          startCursor: "Y3Vyc29yLTE=",
          endCursor: "Y3Vyc29yLTE=",
        },
        totalCount: 1,
      },
    };

    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: vi.fn().mockResolvedValue({ data: mockData }),
    });

    const result = await fetchGraphQL(EVENTS_CONNECTION_QUERY, { first: 1, after: undefined });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/graphql",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          query: EVENTS_CONNECTION_QUERY,
          variables: { first: 1, after: undefined },
        }),
      }),
    );
    expect(result).toEqual(mockData);
  });

  it("fetchGraphQL throws error when graphql endpoint returns errors", async () => {
    (global.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      json: vi.fn().mockResolvedValue({
        errors: [{ message: "GraphQL syntax error" }],
      }),
    });

    await expect(fetchGraphQL(EVENTS_CONNECTION_QUERY)).rejects.toThrow("GraphQL syntax error");
  });
});
