import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  toDate,
  formatStandardDate,
  formatRelativeTime,
  formatEventDate,
  formatEventDateRange,
  isLeapYearDate,
  isMidnightBoundary,
  formatTimezoneAdjustedDate,
  getDaysDifference,
  isSameCalendarDay,
} from "./dateUtils";

describe("dateUtils Unit Tests Suite - Issue #1778", () => {
  const MOCK_NOW = new Date(2026, 9, 15, 12, 0, 0);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(MOCK_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 1. Date Normalization (toDate) ──
  describe("toDate() Date Normalization", () => {
    it("converts valid ISO date strings to Date objects", () => {
      const result = toDate("2026-10-12T14:30:00Z");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getUTCFullYear()).toBe(2026);
      expect(result?.getUTCMonth()).toBe(9);
      expect(result?.getUTCDate()).toBe(12);
    });

    it("passes through valid Date objects untouched", () => {
      const input = new Date(2026, 4, 1, 8, 0, 0);
      const result = toDate(input);
      expect(result).toBe(input);
    });

    it("handles invalid Date instances by returning null", () => {
      const invalidDate = new Date("invalid");
      expect(toDate(invalidDate)).toBeNull();
    });

    it("handles invalid numeric timestamps by returning null", () => {
      expect(toDate(NaN)).toBeNull();
    });

    it("converts numeric timestamps (milliseconds) to Date objects", () => {
      const timestamp = 1700000000000;
      const result = toDate(timestamp);
      expect(result).toBeInstanceOf(Date);
      expect(result?.getTime()).toBe(timestamp);
    });

    it("returns null for invalid, null, whitespace, or empty string inputs", () => {
      expect(toDate("")).toBeNull();
      expect(toDate("   ")).toBeNull();
      expect(toDate(null)).toBeNull();
      expect(toDate(undefined)).toBeNull();
      expect(toDate("invalid-date-string")).toBeNull();
    });
  });

  // ── 2. Standard Date Formatting (formatStandardDate & formatEventDate) ──
  describe("Standard Date Formatting", () => {
    it("formats local Date into standard pattern (Oct 12, 2026)", () => {
      const dateObj = new Date(2026, 9, 12, 10, 0, 0);
      expect(formatStandardDate(dateObj, "MMM d, yyyy")).toBe("Oct 12, 2026");
    });

    it("formats dates with custom pattern (e.g. MMMM d, yyyy)", () => {
      const dateObj = new Date(2026, 0, 1, 0, 0, 0);
      expect(formatStandardDate(dateObj, "MMMM d, yyyy")).toBe("January 1, 2026");
    });

    it("returns empty string on formatting error in formatStandardDate", () => {
      const dateObj = new Date(2026, 0, 1);
      expect(formatStandardDate(dateObj, "INVALID_PATTERN_###")).toBe("");
    });

    it("formats event date with default options and fallback", () => {
      const dateObj = new Date(2026, 6, 20, 14, 0, 0);
      expect(formatEventDate(dateObj)).toBe("Jul 20, 2026");
      expect(formatEventDate(null)).toBe("Date TBA");
      expect(formatEventDate(null, { fallback: "Custom Fallback" })).toBe("Custom Fallback");
    });

    it("formats event date with timeZone option specified", () => {
      const dateObj = new Date(2026, 6, 20, 14, 0, 0);
      const res = formatEventDate(dateObj, { timeZone: "America/New_York", includeTime: true });
      expect(res).toBeDefined();
    });

    it("returns fallback string on pattern format error in formatEventDate", () => {
      const dateObj = new Date(2026, 6, 20);
      expect(formatEventDate(dateObj, { pattern: "INVALID_PTRN_###" })).toBe("Date TBA");
    });

    it("includes time when includeTime option is enabled", () => {
      const dateObj = new Date(2026, 6, 20, 14, 30, 0);
      const result = formatEventDate(dateObj, { includeTime: true });
      expect(result).toContain("Jul 20, 2026");
      expect(result).toContain("at");
      expect(result).toContain("2:30 PM");
    });
  });

  // ── 3. Relative Time Calculations (formatRelativeTime) ──
  describe("Relative Time Formatting (Frozen Clock)", () => {
    it("formats past relative time ('about 2 hours ago')", () => {
      const pastDate = new Date(2026, 9, 15, 10, 0, 0);
      const relative = formatRelativeTime(pastDate);
      expect(relative).toContain("ago");
    });

    it("formats future relative time ('in 3 days')", () => {
      const futureDate = new Date(2026, 9, 18, 12, 0, 0);
      const relative = formatRelativeTime(futureDate);
      expect(relative).toContain("in");
    });

    it("handles Yesterday and Tomorrow relative formatting", () => {
      const yesterday = new Date(2026, 9, 14, 12, 0, 0);
      const tomorrow = new Date(2026, 9, 16, 12, 0, 0);
      const ref = new Date(2026, 9, 15, 12, 0, 0);

      expect(formatRelativeTime(yesterday, ref)).toBe("Yesterday");
      expect(formatRelativeTime(tomorrow, ref)).toBe("Tomorrow");
    });

    it("returns empty string for invalid date inputs in formatRelativeTime", () => {
      expect(formatRelativeTime("bad-input")).toBe("");
      expect(formatRelativeTime(null)).toBe("");
      const throwingObj = {
        getTime() {
          throw new Error("fail");
        },
      } as unknown as Date;
      expect(formatRelativeTime(throwingObj)).toBe("");
    });
  });

  // ── 4. Leap Year Handling (Feb 29) ──
  describe("Leap Year Assertions (isLeapYearDate)", () => {
    it("identifies leap years correctly (2024, 2028, 2032)", () => {
      expect(isLeapYearDate(new Date(2024, 1, 29))).toBe(true);
      expect(isLeapYearDate(new Date(2028, 1, 29))).toBe(true);
    });

    it("identifies non-leap years correctly (2025, 2026, 2027)", () => {
      expect(isLeapYearDate(new Date(2025, 1, 28))).toBe(false);
      expect(isLeapYearDate(new Date(2026, 1, 28))).toBe(false);
    });

    it("returns false for invalid input in isLeapYearDate", () => {
      expect(isLeapYearDate(null)).toBe(false);
      expect(isLeapYearDate("invalid")).toBe(false);
    });

    it("formats Leap Day (Feb 29) flawlessly", () => {
      const leapDate = new Date(2024, 1, 29, 15, 45, 0);
      expect(formatStandardDate(leapDate, "MMMM d, yyyy")).toBe("February 29, 2024");
    });
  });

  // ── 5. Edge of Midnight Boundaries ──
  describe("Edge of Midnight Boundaries (isMidnightBoundary)", () => {
    it("detects 00:00:00 start of day boundary", () => {
      const midnightStart = new Date(2026, 9, 15, 0, 0, 0);
      expect(isMidnightBoundary(midnightStart)).toBe(true);
    });

    it("detects 23:59:59 end of day boundary", () => {
      const midnightEnd = new Date(2026, 9, 15, 23, 59, 59);
      expect(isMidnightBoundary(midnightEnd)).toBe(true);
    });

    it("returns false for mid-day timestamps", () => {
      const midday = new Date(2026, 9, 15, 14, 30, 0);
      expect(isMidnightBoundary(midday)).toBe(false);
    });

    it("returns false for invalid input in isMidnightBoundary", () => {
      expect(isMidnightBoundary(null)).toBe(false);
      expect(isMidnightBoundary("invalid")).toBe(false);
    });
  });

  // ── 6. Timezone Variations (formatTimezoneAdjustedDate) ──
  describe("Timezone Variations", () => {
    it("formats dates in UTC timezone", () => {
      const iso = "2026-10-15T18:00:00.000Z";
      const result = formatTimezoneAdjustedDate(iso, "UTC");
      expect(result).toContain("UTC");
    });

    it("formats dates in America/New_York (EDT / EST)", () => {
      const iso = "2026-10-15T18:00:00.000Z";
      const result = formatTimezoneAdjustedDate(iso, "America/New_York");
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("formats dates in Asia/Kolkata (IST)", () => {
      const iso = "2026-10-15T18:00:00.000Z";
      const result = formatTimezoneAdjustedDate(iso, "Asia/Kolkata");
      expect(result).toBeDefined();
    });

    it("falls back gracefully on invalid IANA timezone name", () => {
      const iso = new Date(2026, 9, 15, 12, 0);
      const fallbackResult = formatTimezoneAdjustedDate(iso, "Invalid/Timezone_Name");
      expect(fallbackResult).toContain("October 15, 2026");
    });

    it("returns empty string when invalid date is provided to timezone function", () => {
      expect(formatTimezoneAdjustedDate("invalid", "UTC")).toBe("");
    });
  });

  // ── 7. Event Date Range Formatting (formatEventDateRange) ──
  describe("Event Date Range Formatting", () => {
    it("formats same-day event range with start and end times", () => {
      const start = new Date(2026, 9, 15, 10, 0);
      const end = new Date(2026, 9, 15, 16, 0);
      const range = formatEventDateRange(start, end, { pattern: "MMMM d, yyyy" });
      expect(range).toContain("October 15, 2026");
      expect(range).toContain("from");
      expect(range).toContain("to");
    });

    it("formats single-day event when no end date is passed", () => {
      const start = new Date(2026, 9, 15, 10, 0);
      const range = formatEventDateRange(start);
      expect(range).toContain("October 15, 2026");
    });

    it("formats multi-day event range across calendar dates", () => {
      const start = new Date(2026, 9, 15, 10, 0);
      const end = new Date(2026, 9, 17, 18, 0);
      const range = formatEventDateRange(start, end, { pattern: "MMM d, yyyy" });
      expect(range).toContain("Oct 15, 2026");
      expect(range).toContain("Oct 17, 2026");
      expect(range).toContain("–");
    });

    it("returns 'Date TBA' when start date is missing or invalid", () => {
      expect(formatEventDateRange(null)).toBe("Date TBA");
      expect(formatEventDateRange("invalid")).toBe("Date TBA");
    });
  });

  // ── 8. Calendar Day Comparisons & Differences ──
  describe("Calendar Day Comparisons", () => {
    it("calculates exact calendar day difference", () => {
      const start = new Date(2026, 9, 10, 10, 0, 0);
      const end = new Date(2026, 9, 15, 14, 0, 0);
      expect(getDaysDifference(start, end)).toBe(5);
    });

    it("returns 0 difference for invalid inputs in getDaysDifference", () => {
      expect(getDaysDifference(null, "2026-10-15")).toBe(0);
      expect(getDaysDifference("2026-10-10", null)).toBe(0);
    });

    it("confirms identical calendar days with isSameCalendarDay", () => {
      const d1 = new Date(2026, 9, 15, 8, 0, 0);
      const d2 = new Date(2026, 9, 15, 22, 0, 0);
      expect(isSameCalendarDay(d1, d2)).toBe(true);
    });

    it("returns false for missing date inputs in isSameCalendarDay", () => {
      expect(isSameCalendarDay(null, "2026-10-15")).toBe(false);
      expect(isSameCalendarDay("2026-10-15", null)).toBe(false);
    });

    it("rejects different calendar days with isSameCalendarDay", () => {
      const d1 = new Date(2026, 9, 15, 23, 59, 59);
      const d2 = new Date(2026, 9, 16, 0, 0, 1);
      expect(isSameCalendarDay(d1, d2)).toBe(false);
    });
  });
});
