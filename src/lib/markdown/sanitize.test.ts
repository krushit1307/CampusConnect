import { describe, it, expect } from "vitest";
import { sanitizeUrl, escapeHtml } from "./sanitize";

describe("sanitizeUrl", () => {
  it("allows https URLs", () => {
    expect(sanitizeUrl("https://example.com")).toBe("https://example.com");
  });

  it("allows http URLs", () => {
    expect(sanitizeUrl("http://example.com")).toBe("http://example.com");
  });

  it("allows mailto URLs", () => {
    expect(sanitizeUrl("mailto:user@example.com")).toBe("mailto:user@example.com");
  });

  it("allows relative URLs starting with /", () => {
    expect(sanitizeUrl("/path/to/page")).toBe("/path/to/page");
  });

  it("allows relative URLs starting with ./", () => {
    expect(sanitizeUrl("./page")).toBe("./page");
  });

  it("allows anchor URLs", () => {
    expect(sanitizeUrl("#section")).toBe("#section");
  });

  it("blocks javascript: URLs", () => {
    expect(sanitizeUrl("javascript:alert(1)")).toBe("#");
  });

  it("blocks data: URLs", () => {
    expect(sanitizeUrl("data:text/html,<script>alert(1)</script>")).toBe("#");
  });

  it("blocks vbscript: URLs", () => {
    expect(sanitizeUrl("vbscript:alert(1)")).toBe("#");
  });

  it("returns # for empty input", () => {
    expect(sanitizeUrl("")).toBe("#");
  });

  it("returns # for null-ish input", () => {
    expect(sanitizeUrl(null as unknown as string)).toBe("#");
  });
});

describe("escapeHtml", () => {
  it("escapes &", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
  });

  it("escapes <", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b");
  });

  it("escapes >", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b");
  });

  it("escapes double quotes", () => {
    expect(escapeHtml('"hello"')).toBe("&quot;hello&quot;");
  });

  it("escapes single quotes", () => {
    expect(escapeHtml("'hello'")).toBe("&#39;hello&#39;");
  });

  it("escapes a full XSS payload", () => {
    const payload = '<script>alert("xss")</script>';
    const escaped = escapeHtml(payload);
    expect(escaped).not.toContain("<script>");
    expect(escaped).toBe("&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;");
  });
});
