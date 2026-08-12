import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchGraphQL, GraphQLPartialError, isPartialNull } from "./graphql-client";

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

// ── Test suite ──────────────────────────────────────────────────────
describe("fetchGraphQL", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    // Reset fetch mock before each test
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns data on a clean 200 response with no errors", async () => {
    const mockData = { user: { id: "1", name: "Alice" } };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    const result = await fetchGraphQL("query { user { id name } }");
    expect(result).toEqual(mockData);
  });

  it("throws Error when response has errors but no data (complete failure)", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          errors: [{ message: "Database unavailable" }],
        }),
    });

    await expect(fetchGraphQL("query { user { id } }")).rejects.toThrow("Database unavailable");
  });

  it("returns partial data when both data and errors are present", async () => {
    const partialData = { user: { id: "1", name: "Alice", recentPosts: null } };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: partialData,
          errors: [{ message: "Posts resolver timeout", path: ["user", "recentPosts"] }],
        }),
    });

    const result = await fetchGraphQL("query { user { id name recentPosts { title } } }");
    expect(result).toEqual(partialData);
    expect((result as typeof partialData).user.recentPosts).toBeNull();
  });

  it("throws on non-OK HTTP status", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(fetchGraphQL("query { user { id } }")).rejects.toThrow(
      "GraphQL request failed: 500 Internal Server Error",
    );
  });

  it("throws when response has neither data nor errors", async () => {
    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(fetchGraphQL("query { user { id } }")).rejects.toThrow(
      "GraphQL response contained neither data nor errors",
    );
  });

  it("sends request to custom endpoint when provided", async () => {
    const mockData = { ok: true };

    (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: mockData }),
    });

    await fetchGraphQL("query { ok }", undefined, { endpoint: "/custom/graphql" });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/custom/graphql",
      expect.objectContaining({
        method: "POST",
      }),
    );
  });
});

describe("GraphQLPartialError", () => {
  it("carries data and errors", () => {
    const data = { user: { id: "1" } };
    const errors = [{ message: "Timeout on posts" }];
    const err = new GraphQLPartialError(errors, data);

    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("GraphQLPartialError");
    expect(err.message).toBe("Timeout on posts");
    expect(err.data).toEqual(data);
    expect(err.graphQLErrors).toEqual(errors);
  });
});

describe("isPartialNull", () => {
  it("returns true for null", () => {
    expect(isPartialNull(null)).toBe(true);
  });

  it("returns true for undefined", () => {
    expect(isPartialNull(undefined)).toBe(true);
  });

  it("returns false for empty array", () => {
    expect(isPartialNull([])).toBe(false);
  });

  it("returns false for 0", () => {
    expect(isPartialNull(0)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isPartialNull("")).toBe(false);
  });
});
