// tests/meilisearch.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch so we don't actually call Meilisearch.
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock import.meta.env
vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

import { unifiedSearch } from "../src/lib/meilisearch";

beforeEach(() => {
  mockFetch.mockReset();
});

describe("meilisearch — unifiedSearch", () => {
  it("returns empty results for an empty query", async () => {
    const result = await unifiedSearch("");
    expect(result).toEqual({
      events: [],
      clubs: [],
      profiles: [],
      totalHits: 0,
      processingTimeMs: 0,
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns empty results for a whitespace-only query", async () => {
    const result = await unifiedSearch("   ");
    expect(result.totalHits).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("calls the meilisearch-search Edge Function with the query and limit", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [{ id: "e1", title: "Tech Symposium" }],
        clubs: [{ id: "c1", name: "CS Club" }],
        profiles: [{ id: "p1", first_name: "Alice" }],
        totalHits: 3,
        processingTimeMs: 5,
      }),
    });

    const result = await unifiedSearch("tech", 5);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:54321/functions/v1/meilisearch-search",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-anon-key",
        }),
        body: JSON.stringify({ query: "tech", limitPerIndex: 5 }),
      }),
    );

    expect(result.events).toHaveLength(1);
    expect(result.clubs).toHaveLength(1);
    expect(result.profiles).toHaveLength(1);
    expect(result.totalHits).toBe(3);
    expect(result.processingTimeMs).toBe(5);
  });

  it("returns empty results when the fetch fails", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 502,
      text: async () => "Bad gateway",
    });

    const result = await unifiedSearch("fail");
    expect(result.totalHits).toBe(0);
    expect(result.events).toEqual([]);
  });

  it("aborts the in-flight request when a new one starts", async () => {
    const controller = new AbortController();
    const abortSpy = vi.spyOn(controller, "abort");

    // First call — simulates a slow response.
    mockFetch.mockImplementationOnce((url, opts) => {
      return new Promise((resolve) => {
        const timer = setTimeout(() => {
          resolve({
            ok: true,
            json: async () => ({
              events: [],
              clubs: [],
              profiles: [],
              totalHits: 0,
              processingTimeMs: 0,
            }),
          });
        }, 5000);
        // Allow abort to cancel.
        opts.signal?.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve({ ok: false, status: 0, text: async () => "aborted" });
        });
      });
    });

    // Second call — should abort the first.
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        events: [{ id: "e2" }],
        clubs: [],
        profiles: [],
        totalHits: 1,
        processingTimeMs: 2,
      }),
    });

    // Start the first search (don't await yet).
    const firstPromise = unifiedSearch("first");

    // Start the second search.
    const secondResult = await unifiedSearch("second");

    // The second result should be returned.
    expect(secondResult.events).toHaveLength(1);

    // The first result should be empty (aborted).
    const firstResult = await firstPromise;
    expect(firstResult.totalHits).toBe(0);
  });
});

describe("meilisearch — SQL contract (migration guards)", () => {
  it("the DLQ migration creates the meilisearch_dlq table", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/20260816000002_meilisearch_dlq.sql"),
      "utf-8",
    );
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS public.meilisearch_dlq");
    expect(sql).toContain("retry_count");
    expect(sql).toContain("exhausted");
    expect(sql).toContain("next_retry_at");
  });

  it("the DLQ migration creates triggers on events, clubs, profiles", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/20260816000002_meilisearch_dlq.sql"),
      "utf-8",
    );
    expect(sql).toContain("on_events_meilisearch_sync");
    expect(sql).toContain("on_clubs_meilisearch_sync");
    expect(sql).toContain("on_profiles_meilisearch_sync");
    expect(sql).toContain("notify_meilisearch_sync");
  });

  it("the DLQ migration uses pg_net for webhook delivery", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/20260816000002_meilisearch_dlq.sql"),
      "utf-8",
    );
    expect(sql).toContain("extensions.net.http_post");
    expect(sql).toContain("pg_net");
  });
});
