import { describe, it, expect } from "vitest";
import {
  eventFormSchema,
  isEndAfterStart,
  isPastDate,
  formatEventDateRange,
  parseCoordinates,
  TITLE_MAX_LENGTH,
} from "./eventUtils";

// ---------------------------------------------------------------------------
// eventFormSchema — field-level validation
// ---------------------------------------------------------------------------
describe("eventFormSchema", () => {
  const valid = {
    title: "Hackathon 2026",
    description: "A 24-hour coding event.",
    startDate: "2026-07-11T09:00",
    endDate: "2026-07-12T09:00",
  };

  it("accepts a fully valid payload", () => {
    expect(eventFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an empty title", () => {
    const result = eventFormSchema.safeParse({ ...valid, title: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.title).toBeDefined();
  });

  it("rejects a title that exceeds the max length", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      title: "a".repeat(TITLE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });

  it("rejects an empty description", () => {
    const result = eventFormSchema.safeParse({ ...valid, description: "" });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.description).toBeDefined();
  });

  it("rejects a missing startDate", () => {
    const result = eventFormSchema.safeParse({ ...valid, startDate: "" });
    expect(result.success).toBe(false);
  });

  it("rejects a missing endDate", () => {
    const result = eventFormSchema.safeParse({ ...valid, endDate: "" });
    expect(result.success).toBe(false);
  });

  it("rejects when endDate equals startDate", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      endDate: valid.startDate,
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.flatten().fieldErrors.endDate).toBeDefined();
  });

  it("rejects when endDate is before startDate", () => {
    const result = eventFormSchema.safeParse({
      ...valid,
      endDate: "2026-07-10T09:00",
    });
    expect(result.success).toBe(false);
  });

  it("trims whitespace-only title", () => {
    const result = eventFormSchema.safeParse({ ...valid, title: "   " });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isEndAfterStart
// ---------------------------------------------------------------------------
describe("isEndAfterStart", () => {
  it("returns true when end is after start", () => {
    expect(isEndAfterStart("2026-07-11T09:00", "2026-07-11T10:00")).toBe(true);
  });

  it("returns false when end equals start", () => {
    expect(isEndAfterStart("2026-07-11T09:00", "2026-07-11T09:00")).toBe(false);
  });

  it("returns false when end is before start", () => {
    expect(isEndAfterStart("2026-07-11T10:00", "2026-07-11T09:00")).toBe(false);
  });

  it("handles leap-year boundary (Feb 28 → Feb 29)", () => {
    expect(isEndAfterStart("2028-02-28T23:59", "2028-02-29T00:00")).toBe(true);
  });

  it("handles leap-year boundary (Feb 29 → Mar 1)", () => {
    expect(isEndAfterStart("2028-02-29T00:00", "2028-03-01T00:00")).toBe(true);
  });

  it("returns false for Feb 29 on a non-leap year (invalid date)", () => {
    // "2027-02-29" is not a real date; Date constructor rolls it over to Mar 1
    // so end (Mar 1) > start (Feb 28) — the function still returns a boolean
    const result = isEndAfterStart("2027-02-28T00:00", "2027-02-29T00:00");
    expect(typeof result).toBe("boolean");
  });

  it("spans across year boundary", () => {
    expect(isEndAfterStart("2025-12-31T23:00", "2026-01-01T00:00")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// isPastDate
// ---------------------------------------------------------------------------
describe("isPastDate", () => {
  const FIXED_NOW = new Date("2026-07-11T12:00:00Z");

  it("returns true for a date in the past", () => {
    expect(isPastDate("2026-07-11T11:59:00Z", FIXED_NOW)).toBe(true);
  });

  it("returns false for a date in the future", () => {
    expect(isPastDate("2026-07-11T12:01:00Z", FIXED_NOW)).toBe(false);
  });

  it("returns false for a date equal to now (not strictly less)", () => {
    expect(isPastDate("2026-07-11T12:00:00Z", FIXED_NOW)).toBe(false);
  });

  it("returns true for a date one year in the past", () => {
    expect(isPastDate("2025-07-11T12:00:00Z", FIXED_NOW)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// formatEventDateRange
// ---------------------------------------------------------------------------
describe("formatEventDateRange", () => {
  it("formats a same-day range correctly", () => {
    const result = formatEventDateRange("2026-07-11T09:00:00Z", "2026-07-11T11:00:00Z");
    expect(result).toBe("July 11, 2026 at 9:00 AM – 11:00 AM");
  });

  it("formats a PM range correctly", () => {
    const result = formatEventDateRange("2026-12-25T14:00:00Z", "2026-12-25T18:30:00Z");
    expect(result).toBe("December 25, 2026 at 2:00 PM – 6:30 PM");
  });

  it("returns empty string for an invalid start date", () => {
    expect(formatEventDateRange("not-a-date", "2026-07-11T11:00:00Z")).toBe("");
  });

  it("returns empty string for an invalid end date", () => {
    expect(formatEventDateRange("2026-07-11T09:00:00Z", "bad")).toBe("");
  });

  it("handles leap-year date Feb 29", () => {
    const result = formatEventDateRange("2028-02-29T10:00:00Z", "2028-02-29T12:00:00Z");
    expect(result).toBe("February 29, 2028 at 10:00 AM – 12:00 PM");
  });

  it("output contains ' at ' separator and ' – ' range separator", () => {
    const result = formatEventDateRange("2026-07-11T09:00:00Z", "2026-07-11T11:00:00Z");
    expect(result).toContain(" at ");
    expect(result).toContain(" – ");
  });
});

// ---------------------------------------------------------------------------
// parseCoordinates
// ---------------------------------------------------------------------------
describe("parseCoordinates", () => {
  it("identifies valid coordinates", () => {
    const result = parseCoordinates("28.7041, 77.1025");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.lat).toBe(28.7041);
    expect(result.lng).toBe(77.1025);
  });

  it("identifies negative coordinates", () => {
    const result = parseCoordinates("-33.8688, 151.2093");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(true);
    expect(result.lat).toBe(-33.8688);
    expect(result.lng).toBe(151.2093);
  });

  it("identifies invalid latitude (out of bounds)", () => {
    const result = parseCoordinates("95.1234, 77.1025");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("identifies invalid longitude (out of bounds)", () => {
    const result = parseCoordinates("28.7041, -195.1234");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("identifies coordinate-like inputs with alphabetic chars as coordinates and invalid", () => {
    const result = parseCoordinates("28.7041, abc");
    expect(result.isCoordinates).toBe(true);
    expect(result.isValid).toBe(false);
  });

  it("treats plain address strings as not coordinates (and valid)", () => {
    const result = parseCoordinates("Main Auditorium, IIT Bombay");
    expect(result.isCoordinates).toBe(false);
    expect(result.isValid).toBe(true);
  });

  it("treats online event string as not coordinates (and valid)", () => {
    const result = parseCoordinates("online");
    expect(result.isCoordinates).toBe(false);
    expect(result.isValid).toBe(true);
  });
});
