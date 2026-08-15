import { describe, expect, it } from "vitest";
import { getEventTldr, truncateEventDescription } from "./eventSummary";

describe("event TL;DR helpers", () => {
  it("prefers an organizer or generated summary", () => {
    expect(getEventTldr("Free pizza and networking tonight", "A very long description")).toBe(
      "Free pizza and networking tonight",
    );
  });

  it("falls back to a bounded one-line description", () => {
    const description = "A long event description ".repeat(10);
    const fallback = truncateEventDescription(description);
    expect(fallback.length).toBeLessThanOrEqual(100);
    expect(fallback.endsWith("…")).toBe(true);
    expect(getEventTldr(null, description)).toBe(fallback);
  });

  it("normalizes whitespace in summaries", () => {
    expect(getEventTldr("  Bring\n snacks  ", "Fallback")).toBe("Bring snacks");
  });
});
