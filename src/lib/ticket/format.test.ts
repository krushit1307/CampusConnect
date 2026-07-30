import { describe, it, expect } from "vitest";
import { formatTicketDate, formatTicketDateRange } from "./format";

describe("formatTicketDate (issue #1913)", () => {
  it("formats a UTC ISO timestamp in 12-hour time", () => {
    expect(formatTicketDate("2026-09-15T18:00:00Z")).toBe(
      "September 15, 2026 at 6:00 PM",
    );
  });

  it("formats midnight as 12:00 AM, not 0:00 AM", () => {
    expect(formatTicketDate("2026-09-15T00:30:00Z")).toMatch(/12:30 AM$/);
  });

  it("formats noon as 12:00 PM, not 0:00 PM", () => {
    expect(formatTicketDate("2026-09-15T12:00:00Z")).toMatch(/12:00 PM$/);
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
    expect(formatTicketDate("2026-09-15T18:05:00Z")).toMatch(/6:05 PM$/);
  });
});

describe("formatTicketDateRange (issue #1913)", () => {
  it("collapses same-day ranges into 'start – endTime'", () => {
    const result = formatTicketDateRange("2026-09-15T18:00:00Z", "2026-09-15T21:00:00Z");
    expect(result).toMatch(/September 15, 2026 at 6:00 PM/);
    expect(result).toMatch(/9:00 PM/);
    expect(result).toContain(" – ");
  });

  it("emits both full dates when the range spans multiple days", () => {
    const result = formatTicketDateRange("2026-09-15T18:00:00Z", "2026-09-17T21:00:00Z");
    expect(result).toMatch(/September 15/);
    expect(result).toMatch(/September 17/);
    expect(result).toContain(" – ");
  });

  it("returns 'TBA' when both inputs are missing", () => {
    expect(formatTicketDateRange(null, null)).toBe("TBA");
  });

  it("returns the start when only the end is missing", () => {
    expect(formatTicketDateRange("2026-09-15T18:00:00Z", null)).toMatch(
      /September 15, 2026 at 6:00 PM/,
    );
  });

  it("returns the end when only the start is missing", () => {
    expect(formatTicketDateRange(null, "2026-09-15T21:00:00Z")).toMatch(
      /September 15, 2026 at 9:00 PM/,
    );
  });
});
