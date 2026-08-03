import { describe, it, expect, vi } from "vitest";
import { customFetch } from "../src/utils/fetch";

// We mock the global fetch
global.fetch = vi
  .fn()
  .mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
    return new Response(JSON.stringify({ url, init }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

describe("Frontend Fetch Wrapper", () => {
  it("should set cache: 'default' for static metadata", async () => {
    const res = await customFetch("/api/majors", { isStaticMetadata: true });

    // Check that cache: "default" was passed to the underlying fetch
    expect(res.init.cache).toBe("default");
  });

  it("should not append timestamps to static metadata URLs", async () => {
    const res = await customFetch("/api/majors", { isStaticMetadata: true });

    expect(res.url).toBe("/api/majors");
    expect(res.url).not.toContain("?timestamp=");
  });
});
