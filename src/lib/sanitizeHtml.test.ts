import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "./sanitizeHtml";

describe("sanitizeHtml", () => {
  it("allows safe tags through", () => {
    const input = "<p><b>Hello</b> <i>World</i></p>";
    const result = sanitizeHtml(input);
    expect(result).toContain("<b>Hello</b>");
    expect(result).toContain("<i>World</i>");
  });

  it("removes script tags", () => {
    const input = '<p>Hello</p><script>alert("XSS")</script>';
    expect(sanitizeHtml(input)).toBe("<p>Hello</p>");
  });

  it("removes iframe tags", () => {
    const input = '<p>Hello</p><iframe src="http://evil.com"></iframe>';
    expect(sanitizeHtml(input)).toBe("<p>Hello</p>");
  });

  it("removes style tags", () => {
    const input = "<p>Hello</p><style>body { display: none; }</style>";
    expect(sanitizeHtml(input)).toBe("<p>Hello</p>");
  });

  it("removes onerror XSS payloads", () => {
    const input = "<p>Hello</p><img src=x onerror=alert(1)>";
    expect(sanitizeHtml(input)).toBe("<p>Hello</p>");
  });

  it("adds target and rel to anchor tags", () => {
    const input = '<a href="https://example.com">Link</a>';
    const result = sanitizeHtml(input);
    expect(result).toContain('target="_blank"');
    expect(result).toContain('rel="noopener noreferrer"');
  });

  it("returns empty string for null", () => {
    expect(sanitizeHtml(null)).toBe("");
  });

  it("returns empty string for undefined", () => {
    expect(sanitizeHtml(undefined)).toBe("");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });
});
