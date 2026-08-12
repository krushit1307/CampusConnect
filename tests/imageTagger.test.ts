// tests/imageTagger.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the fetch global so we don't actually call the Edge Function.
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Mock import.meta.env
vi.stubEnv("VITE_SUPABASE_URL", "http://localhost:54321");
vi.stubEnv("VITE_SUPABASE_ANON_KEY", "test-anon-key");

// Mock the canvas-based image compression (jsdom doesn't implement
// HTMLCanvasElement.toDataURL). We monkey-patch it to return a fixed
// base64 string + MIME type.
class MockImage {
  width = 800;
  height = 600;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() {
    setTimeout(() => {
      this.onload?.();
    }, 0);
  }
}

class MockCanvas {
  width = 0;
  height = 0;
  getContext() {
    return {
      drawImage: vi.fn(),
    };
  }
  toDataURL(mimeType: string, _quality: number) {
    return `data:${mimeType};base64,SGVsbG8gV29ybGQ=`;
  }
}

beforeEach(() => {
  mockFetch.mockReset();
  (globalThis as unknown as { Image: typeof MockImage }).Image = MockImage;
  (globalThis as unknown as { HTMLCanvasElement: typeof MockCanvas }).HTMLCanvasElement =
    MockCanvas as unknown as typeof HTMLCanvasElement;
  // document.createElement('canvas') should return our mock.
  if (typeof document !== "undefined") {
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return new MockCanvas() as unknown as HTMLCanvasElement;
      }
      return {} as HTMLElement;
    });
  }
  // URL.createObjectURL / revokeObjectURL stubs.
  (
    globalThis as unknown as { URL: { createObjectURL: () => string; revokeObjectURL: () => void } }
  ).URL = {
    createObjectURL: () => "blob:fake-url",
    revokeObjectURL: () => {},
  };
});

afterEach(() => {
  vi.restoreAllMocks();
});

import { autoTagImage } from "../src/lib/imageTagger";

function makeFile(type = "image/jpeg", size = 1024): File {
  return new File([new Uint8Array(size)], "test.jpg", { type });
}

describe("imageTagger — autoTagImage", () => {
  it("returns tags and hasPii=false on a successful non-PII image", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tags: ["water bottle", "blue", "stickers"],
        hasPii: false,
      }),
    });

    const result = await autoTagImage(makeFile());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.tags).toEqual(["water bottle", "blue", "stickers"]);
      expect(result.result.hasPii).toBe(false);
      expect(result.result.piiReason).toBeUndefined();
    }
  });

  it("returns hasPii=true and piiReason when PII is detected", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tags: [],
        hasPii: true,
        piiReason: "Visible credit card number detected.",
      }),
    });

    const result = await autoTagImage(makeFile());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.hasPii).toBe(true);
      expect(result.result.piiReason).toBe("Visible credit card number detected.");
      expect(result.result.tags).toEqual([]);
    }
  });

  it("returns error when the Edge Function returns an error status", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 413,
      json: async () => ({
        error: "Image too large. Maximum 2MB after compression.",
      }),
    });

    const result = await autoTagImage(makeFile());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toContain("Image too large");
    }
  });

  it("returns error when the network call throws", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network down"));

    const result = await autoTagImage(makeFile());
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toContain("Network error");
    }
  });

  it("returns error when the file is not an image", async () => {
    const result = await autoTagImage(
      new File([new Uint8Array(100)], "doc.pdf", { type: "application/pdf" }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toContain("image file");
    }
  });

  it("returns error when the file is too large (> 10 MB)", async () => {
    const result = await autoTagImage(makeFile("image/jpeg", 11 * 1024 * 1024));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.error).toContain("too large");
    }
  });

  it("sends compressed base64 to the Edge Function", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tags: ["test"], hasPii: false }),
    });

    await autoTagImage(makeFile());

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:54321/functions/v1/lost-found-auto-tag",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-anon-key",
        }),
      }),
    );

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.imageBase64).toBe("SGVsbG8gV29ybGQ=");
    expect(callBody.mimeType).toMatch(/^image\//);
  });
});

describe("imageTagger — SQL contract (migration guards)", () => {
  it("the migration adds search_tags and pii_rejected_at columns", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/20260817000000_lost_found_auto_tagger.sql"),
      "utf-8",
    );
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS search_tags JSONB");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS pii_rejected_at TIMESTAMPTZ");
  });

  it("the migration creates a GIN index on search_tags", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/20260817000000_lost_found_auto_tagger.sql"),
      "utf-8",
    );
    expect(sql).toContain("USING GIN (search_tags)");
  });

  it("the migration creates the get_lost_items_by_tag RPC", async () => {
    const fs = await import("node:fs");
    const path = await import("node:path");
    const sql = fs.readFileSync(
      path.resolve(__dirname, "../supabase/migrations/20260817000000_lost_found_auto_tagger.sql"),
      "utf-8",
    );
    expect(sql).toContain("CREATE OR REPLACE FUNCTION public.get_lost_items_by_tag");
  });
});
