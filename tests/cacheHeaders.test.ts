import { describe, it, expect } from "vitest";
import { STATIC_CACHE_HEADERS, createCachedResponse } from "../supabase/functions/shared/cache";

describe("Cache Headers Utility", () => {
  it("should contain the correct cache-control string", () => {
    expect(STATIC_CACHE_HEADERS["Cache-Control"]).toBe(
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    );
  });

  it("should create a response with cache headers", () => {
    const data = { test: "data" };
    const res = createCachedResponse(data);

    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
    );
    expect(res.headers.get("Content-Type")).toBe("application/json");
    expect(res.headers.get("Vary")).toBe("Accept-Encoding");
  });
});
