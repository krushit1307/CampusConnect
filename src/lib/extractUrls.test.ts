import { describe, it, expect } from "vitest";
import { extractUrls, extractFirstUrl } from "@/lib/extractUrls";

describe("extractUrls", () => {
  it("returns empty array for plain text", () => {
    expect(extractUrls("Hello world, no links here.")).toEqual([]);
  });

  it("extracts a single https URL", () => {
    expect(extractUrls("Check this out: https://example.com")).toEqual(["https://example.com"]);
  });

  it("extracts a single http URL", () => {
    expect(extractUrls("Visit http://campusconnect.app/events")).toEqual([
      "http://campusconnect.app/events",
    ]);
  });

  it("extracts multiple URLs from one message", () => {
    const text = "See https://github.com and https://youtube.com for more.";
    expect(extractUrls(text)).toEqual(["https://github.com", "https://youtube.com"]);
  });

  it("de-duplicates the same URL", () => {
    const text = "https://example.com https://example.com";
    expect(extractUrls(text)).toEqual(["https://example.com"]);
  });

  it("does not include trailing punctuation", () => {
    // URL followed by period (end of sentence) — the period should NOT be captured
    const result = extractUrls("Go to https://example.com.");
    expect(result[0]).toBe("https://example.com");
  });

  it("extracts URL with query params and fragment", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s#intro";
    expect(extractUrls(`Click: ${url}`)).toEqual([url]);
  });

  it("returns empty for ftp:// or mailto: (not http/https)", () => {
    expect(extractUrls("ftp://files.example.com")).toEqual([]);
    expect(extractUrls("mailto:user@example.com")).toEqual([]);
  });

  it("handles message with no content (empty string)", () => {
    expect(extractUrls("")).toEqual([]);
  });
});

describe("extractFirstUrl", () => {
  it("returns null for plain text", () => {
    expect(extractFirstUrl("No links here")).toBeNull();
  });

  it("returns the first URL", () => {
    expect(extractFirstUrl("Go to https://example.com and https://other.com")).toBe(
      "https://example.com",
    );
  });

  it("returns null for empty string", () => {
    expect(extractFirstUrl("")).toBeNull();
  });
});
