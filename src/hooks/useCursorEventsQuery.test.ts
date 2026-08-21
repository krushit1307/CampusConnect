import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGraphQL, EVENTS_CONNECTION_QUERY } from "./useCursorEventsQuery";

const originalFetch = globalThis.fetch;

// ── Mock OpenTelemetry so tests don't need a real tracer ────────────
vi.mock("@opentelemetry/api", () => {
  const mockSpan = {
    setStatus: vi.fn(),
    recordException: vi.fn(),
    end: vi.fn(),
  };
  return {
    trace: {
      getTracer: () => ({ startSpan: () => mockSpan }),
    },
    SpanStatusCode: { ERROR: 2 },
  };
});

describe("useCursorEventsQuery", () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
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

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: mockData }),
    });

    const result = await fetchGraphQL(EVENTS_CONNECTION_QUERY, { first: 1, after: undefined });

    expect(globalThis.fetch).toHaveBeenCalledWith(
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

  it("fetchGraphQL throws error when graphql endpoint returns errors with no data", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        errors: [{ message: "GraphQL syntax error" }],
      }),
    });

    await expect(fetchGraphQL(EVENTS_CONNECTION_QUERY)).rejects.toThrow("GraphQL syntax error");
  });

  it("fetchGraphQL returns partial data when both data and errors are present", async () => {
    const partialData = {
      events: {
        edges: [],
        nodes: [],
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: null,
          endCursor: null,
        },
        totalCount: 0,
      },
    };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: partialData,
        errors: [
          {
            message: "Organizer resolver timeout",
            path: ["events", "edges", 0, "node", "organizer"],
          },
        ],
      }),
    });

    const result = await fetchGraphQL(EVENTS_CONNECTION_QUERY, { first: 10 });
    expect(result).toEqual(partialData);
  });
});
