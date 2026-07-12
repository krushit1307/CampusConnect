import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { formatDate } from "./utils";

const originalDateTimeFormat = Intl.DateTimeFormat;

describe("formatDate", () => {
  beforeAll(() => {
    Intl.DateTimeFormat = class extends originalDateTimeFormat {
      constructor(locale?: string | string[], options: Intl.DateTimeFormatOptions = {}) {
        super(locale, { ...options, timeZone: "UTC" });
      }
    } as typeof Intl.DateTimeFormat;
  });

  afterAll(() => {
    Intl.DateTimeFormat = originalDateTimeFormat;
  });

  it("returns an empty string when the input is empty", () => {
    expect(formatDate("")).toBe("");
  });

  it("returns the original string for an invalid date", () => {
    expect(formatDate("invalid-date")).toBe("invalid-date");
  });

  it("formats a valid ISO date string", () => {
    const result = formatDate("2026-07-11T10:30:00Z");

    expect(result).toBe("July 11, 2026 at 10:30 AM");
  });

  it("formats another valid ISO date string", () => {
    const result = formatDate("2025-12-25T18:45:00Z");

    expect(result).toBe("December 25, 2025 at 6:45 PM");
  });

  it("includes both the formatted date and time separator", () => {
    const result = formatDate("2026-01-15T18:45:00Z");

    expect(result).toBe("January 15, 2026 at 6:45 PM");
    expect(result.split(" at ").length).toBe(2);
  });
});
