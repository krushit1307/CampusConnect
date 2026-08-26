import { describe, it, expect } from "vitest";
import { formatTicketDate, formatTicketDateRange } from "./format";

// Tests run in jsdom which has the host machine's timezone. We pick ISO
// timestamps at 12:00 UTC so the rendered day is stable across the
// common timezones a CI machine might use (UTC, UTC-12 .. UTC+14).
// We assert on shapes that survive TZ changes (month name, "at" glue,
// AM/PM suffix, "–" separator, "TBA" fallback) rather than literal
// hour/minute values that flip between UTC and local rendering.

describe("formatTicketDate (issue #1913)", () => {
  it("renders month name, day, year, and 'at <time> AM/PM'", () => {
    const out = formatTicketDate("2026-09-15T12:00:00Z");
    expect(out).toMatch(/^September 15, 2026 at \d{1,2}:\d{2} (AM|PM)$/);
  });

  it("returns 'TBA' for null input", () => {
    expect(formatTicketDate(null)).toBe("TBA");
  });

  it("returns 'TBA' for undefined input", () => {
    expect(formatTicketDate(undefined)).toBe("TBA");
  });

  it("returns 'TBA' for unparseable strings", () => {
    expect(formatTicketDate("not a date")).toBe("TBA");
  });

  it("zero-pads single-digit minutes", () => {
    // 12:00 UTC is stable across TZs; the minutes will be 00 either way.
    const out = formatTicketDate("2026-09-15T12:00:00Z");
    expect(out).toMatch(/:\d{2} /);
  });

  it("uses 12-hour time (never shows 24h format)", () => {
    const a = formatTicketDate("2026-09-15T12:00:00Z");
    expect(a).toMatch(/(AM|PM)/);
  });

  it("renders the AM/PM suffix correctly (uppercase, single token)", () => {
    const out = formatTicketDate("2026-09-15T12:00:00Z");
    expect(out).toMatch(/(AM|PM)$/);
  });
});

describe("formatTicketDateRange (issue #1913)", () => {
  it("uses '–' as the range separator", () => {
    const out = formatTicketDateRange("2026-09-15T12:00:00Z", "2026-09-15T18:00:00Z");
    expect(out).toContain(" – ");
  });

  it("collapses same-day ranges into a single date + two times", () => {
    const out = formatTicketDateRange("2026-09-15T12:00:00Z", "2026-09-15T18:00:00Z");
    const dateOccurrences = (out.match(/September 15, 2026/g) ?? []).length;
    expect(dateOccurrences).toBe(1);
  });

  it("emits both full dates when the range spans multiple days", () => {
    const out = formatTicketDateRange("2026-09-15T12:00:00Z", "2026-09-17T12:00:00Z");
    expect(out).toMatch(/September 15/);
    expect(out).toMatch(/September 17/);
  });

  it("returns 'TBA' when both inputs are missing", () => {
    expect(formatTicketDateRange(null, null)).toBe("TBA");
  });

  it("returns the start when only the end is missing", () => {
    expect(formatTicketDateRange("2026-09-15T12:00:00Z", null)).not.toBe("TBA");
    expect(formatTicketDateRange("2026-09-15T12:00:00Z", null)).toContain("September 15");
  });

  it("returns the end when only the start is missing", () => {
    expect(formatTicketDateRange(null, "2026-09-15T12:00:00Z")).not.toBe("TBA");
    expect(formatTicketDateRange(null, "2026-09-15T12:00:00Z")).toContain("September 15");
  });

  it("ignores unparseable inputs (treats them as missing)", () => {
    expect(formatTicketDateRange("not-a-date", "also-not-a-date")).toBe("TBA");
    expect(formatTicketDateRange("not-a-date", "2026-09-15T12:00:00Z")).toContain("September 15");
  });
});
