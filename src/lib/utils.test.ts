import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { formatDate, getGoogleCalendarUrl } from "./utils";

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

describe("getGoogleCalendarUrl", () => {
  it("returns null when event_date is missing or invalid", () => {
    expect(
      getGoogleCalendarUrl({
        title: "Test Event",
        description: null,
        event_date: null,
        location: null,
      }),
    ).toBeNull();
    expect(
      getGoogleCalendarUrl({
        title: "Test Event",
        description: null,
        event_date: "invalid-date",
        location: null,
      }),
    ).toBeNull();
  });

  it("generates a correct URL with all parameters", () => {
    const event = {
      title: "Design Workshop",
      description: "Learn UI UX design principles",
      event_date: "2026-07-15T10:00:00Z",
      location: "Room 101",
    };
    const url = getGoogleCalendarUrl(event);
    expect(url).not.toBeNull();

    const parsed = new URL(url!);
    expect(parsed.origin).toBe("https://calendar.google.com");
    expect(parsed.pathname).toBe("/calendar/render");
    expect(parsed.searchParams.get("action")).toBe("TEMPLATE");
    expect(parsed.searchParams.get("text")).toBe("Design Workshop");
    expect(parsed.searchParams.get("dates")).toBe("20260715T100000Z/20260715T110000Z");
    expect(parsed.searchParams.get("details")).toBe("Learn UI UX design principles");
    expect(parsed.searchParams.get("location")).toBe("Room 101");
  });

  it("handles missing description and location", () => {
    const event = {
      title: "Short Meeting",
      description: null,
      event_date: "2026-07-15T10:00:00Z",
      location: null,
    };
    const url = getGoogleCalendarUrl(event);
    expect(url).not.toBeNull();

    const parsed = new URL(url!);
    expect(parsed.searchParams.get("text")).toBe("Short Meeting");
    expect(parsed.searchParams.get("dates")).toBe("20260715T100000Z/20260715T110000Z");
    expect(parsed.searchParams.has("details")).toBe(false);
    expect(parsed.searchParams.has("location")).toBe(false);
  });
});
