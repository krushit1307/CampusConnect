import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  formatDate,
  getCountdown,
  formatDateOnly,
  formatEventDateRange,
  getGoogleCalendarUrl,
  getIcsContent,
} from "./utils";

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------
describe("formatDate", () => {
  it("returns empty string for empty input", () => {
    expect(formatDate("")).toBe("");
  });

  it("returns original string for invalid date", () => {
    expect(formatDate("not-a-date")).toBe("not-a-date");
  });

  it("formats a past date correctly", () => {
    const result = formatDate("2020-06-15T10:30:00");
    expect(result).toMatch(/June 15, 2020 at/);
    expect(result).toMatch(/10:30 AM/);
  });

  it("formats a future date correctly", () => {
    const result = formatDate("2030-12-25T15:00:00");
    expect(result).toMatch(/December 25, 2030 at/);
    expect(result).toMatch(/3:00 PM/);
  });

  it("formats midnight correctly", () => {
    const result = formatDate("2024-01-01T00:00:00");
    expect(result).toMatch(/January 1, 2024 at/);
    expect(result).toMatch(/12:00 AM/);
  });

  it("formats noon correctly", () => {
    const result = formatDate("2024-06-15T12:00:00");
    expect(result).toMatch(/June 15, 2024 at/);
    expect(result).toMatch(/12:00 PM/);
  });

  it("formats a time with minutes", () => {
    const result = formatDate("2026-03-10T14:35:00");
    expect(result).toMatch(/2:35 PM/);
  });
});

// ---------------------------------------------------------------------------
// getCountdown
// ---------------------------------------------------------------------------
describe("getCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty string for invalid date", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("not-a-date")).toBe("");
  });

  it("returns 'Today!' for today's date", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-07-23T18:00:00Z")).toBe("Today!");
  });

  it("returns 'Tomorrow' for tomorrow's date", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-07-24T10:00:00Z")).toBe("Tomorrow");
  });

  it("returns 'In 3 days' for a date 3 days away", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-07-26T10:00:00Z")).toBe("In 3 days");
  });

  it("returns 'In 2 days' for exactly 2 days away", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-07-25T10:00:00Z")).toBe("In 2 days");
  });

  it("returns 'Ended' for a past date", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-07-20T10:00:00Z")).toBe("Ended");
  });

  it("returns 'In 1 month' for ~30 days away", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-08-22T10:00:00Z")).toBe("In 1 month");
  });

  it("returns 'In 2 months' for ~60 days away", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-09-21T10:00:00Z")).toBe("In 2 months");
  });

  it("returns 'In 11 days' for 11 days away", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-08-03T10:00:00Z")).toBe("In 11 days");
  });

  it("returns 'In 29 days' for 29 days away", () => {
    vi.setSystemTime(new Date("2026-07-23T12:00:00Z"));
    expect(getCountdown("2026-08-21T10:00:00Z")).toBe("In 29 days");
  });
});

// ---------------------------------------------------------------------------
// formatDateOnly
// ---------------------------------------------------------------------------
describe("formatDateOnly", () => {
  it("returns empty string for empty input", () => {
    expect(formatDateOnly("")).toBe("");
  });

  it("returns original string for invalid date", () => {
    expect(formatDateOnly("not-a-date")).toBe("not-a-date");
  });

  it("formats a date with short month (default)", () => {
    const result = formatDateOnly("2026-07-11T10:00:00Z");
    expect(result).toBe("Jul 11, 2026");
  });

  it("formats a date with long month", () => {
    const result = formatDateOnly("2026-12-25T10:00:00Z", "long");
    expect(result).toBe("December 25, 2026");
  });

  it("formats a date with short month explicitly", () => {
    const result = formatDateOnly("2026-03-01T10:00:00Z", "short");
    expect(result).toBe("Mar 1, 2026");
  });

  it("formats Jan 1 correctly", () => {
    const result = formatDateOnly("2026-01-01T00:00:00Z");
    expect(result).toBe("Jan 1, 2026");
  });

  it("formats Dec 31 correctly", () => {
    const result = formatDateOnly("2026-12-31T23:59:59Z", "long");
    expect(result).toBe("December 31, 2026");
  });

  it("formats leap day correctly", () => {
    const result = formatDateOnly("2028-02-29T12:00:00Z");
    expect(result).toBe("Feb 29, 2028");
  });
});

// ---------------------------------------------------------------------------
// formatEventDateRange (from utils.ts — the object-based variant)
// ---------------------------------------------------------------------------
describe("formatEventDateRange (object-based)", () => {
  it("shows a same-day start and end time", () => {
    const result = formatEventDateRange({
      event_date: "2026-07-11T09:00:00Z",
      start_date: "2026-07-11T09:00:00Z",
      end_date: "2026-07-11T11:00:00Z",
    });

    expect(result).toMatch(/^July 11, 2026 at .+ – .+$/);
  });

  it("falls back to the legacy event date when no end date exists", () => {
    const result = formatEventDateRange({
      event_date: "2026-07-11T09:00:00Z",
      start_date: null,
      end_date: null,
    });

    expect(result).toMatch(/^July 11, 2026 at .+$/);
  });

  it("returns a fallback label when there is no usable date", () => {
    expect(
      formatEventDateRange({
        event_date: null,
        start_date: null,
        end_date: null,
      }),
    ).toBe("Date TBA");
  });

  it("formats a multi-day event", () => {
    const result = formatEventDateRange({
      event_date: "2026-07-11T09:00:00Z",
      start_date: "2026-07-11T09:00:00Z",
      end_date: "2026-07-13T17:00:00Z",
    });

    expect(result).toContain("–");
    expect(result).toMatch(/July 11, 2026 at .+/);
    expect(result).toMatch(/July 13, 2026 at .+/);
  });

  it("uses start_date over event_date when both provided", () => {
    const result = formatEventDateRange({
      event_date: "2026-06-01T09:00:00Z",
      start_date: "2026-07-11T09:00:00Z",
      end_date: "2026-07-11T11:00:00Z",
    });

    expect(result).toMatch(/July 11, 2026/);
  });

  it("falls back to formatDate when end_date is invalid", () => {
    const result = formatEventDateRange({
      event_date: "2026-07-11T09:00:00Z",
      start_date: "2026-07-11T09:00:00Z",
      end_date: "invalid-date",
    });

    expect(result).toMatch(/July 11, 2026 at/);
  });

  it("returns Date TBA when all dates are undefined", () => {
    expect(
      formatEventDateRange({
        event_date: null,
      }),
    ).toBe("Date TBA");
  });

  it("uses event_date when start_date is empty string", () => {
    const result = formatEventDateRange({
      event_date: "2026-07-11T09:00:00Z",
      start_date: null,
      end_date: "2026-07-11T11:00:00Z",
    });

    expect(result).toMatch(/July 11, 2026/);
  });
});

// ---------------------------------------------------------------------------
// getGoogleCalendarUrl
// ---------------------------------------------------------------------------
describe("getGoogleCalendarUrl", () => {
  const baseEvent = {
    title: "Hackathon 2026",
    description: "A coding event",
    event_date: "2026-07-11T09:00:00Z",
    start_date: "2026-07-11T09:00:00Z",
    end_date: "2026-07-11T17:00:00Z",
    location: "Main Auditorium",
  };

  it("generates a valid Google Calendar URL", () => {
    const url = getGoogleCalendarUrl(baseEvent);
    expect(url).toBeTruthy();
    expect(url).toMatch(/^https:\/\/calendar\.google\.com\/calendar\/render\?/);
  });

  it("includes the event title in the URL", () => {
    const url = getGoogleCalendarUrl(baseEvent);
    expect(url).toContain("text=Hackathon+2026");
  });

  it("includes the description when provided", () => {
    const url = getGoogleCalendarUrl(baseEvent);
    expect(url).toContain("details=A+coding+event");
  });

  it("includes the location when provided", () => {
    const url = getGoogleCalendarUrl(baseEvent);
    expect(url).toContain("location=Main+Auditorium");
  });

  it("returns null when no start date is available", () => {
    expect(
      getGoogleCalendarUrl({
        ...baseEvent,
        event_date: null,
        start_date: null,
      }),
    ).toBeNull();
  });

  it("returns null for invalid start date", () => {
    expect(
      getGoogleCalendarUrl({
        ...baseEvent,
        event_date: "invalid",
        start_date: "invalid",
      }),
    ).toBeNull();
  });

  it("returns null for invalid end date", () => {
    expect(
      getGoogleCalendarUrl({
        ...baseEvent,
        end_date: "invalid",
      }),
    ).toBeNull();
  });

  it("uses start_date over event_date", () => {
    const url = getGoogleCalendarUrl({
      ...baseEvent,
      event_date: "2026-01-01T00:00:00Z",
      start_date: "2026-07-11T09:00:00Z",
    });
    expect(url).toBeTruthy();
  });

  it("defaults end date to 1 hour after start when end_date is null", () => {
    const url = getGoogleCalendarUrl({
      ...baseEvent,
      end_date: null,
    });
    expect(url).toBeTruthy();
  });

  it("omits details when description is null", () => {
    const url = getGoogleCalendarUrl({
      ...baseEvent,
      description: null,
    });
    expect(url).not.toContain("details=");
  });

  it("omits location when location is null", () => {
    const url = getGoogleCalendarUrl({
      ...baseEvent,
      location: null,
    });
    expect(url).not.toContain("location=");
  });
});

// ---------------------------------------------------------------------------
// getIcsContent
// ---------------------------------------------------------------------------
describe("getIcsContent", () => {
  const baseEvent = {
    title: "Hackathon 2026",
    description: "A coding event",
    event_date: "2026-07-11T09:00:00Z",
    start_date: "2026-07-11T09:00:00Z",
    end_date: "2026-07-11T17:00:00Z",
    location: "Main Auditorium",
  };

  it("returns a valid ICS string", () => {
    const ics = getIcsContent(baseEvent);
    expect(ics).toBeTruthy();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
  });

  it("includes version and prodid", () => {
    const ics = getIcsContent(baseEvent);
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//CampusConnect//Event//EN");
  });

  it("includes the event summary (title)", () => {
    const ics = getIcsContent(baseEvent);
    expect(ics).toContain("SUMMARY:Hackathon 2026");
  });

  it("includes DTSTART and DTEND", () => {
    const ics = getIcsContent(baseEvent);
    expect(ics).toMatch(/DTSTART:/);
    expect(ics).toMatch(/DTEND:/);
  });

  it("includes description when provided", () => {
    const ics = getIcsContent(baseEvent);
    expect(ics).toContain("DESCRIPTION:A coding event");
  });

  it("includes location when provided", () => {
    const ics = getIcsContent(baseEvent);
    expect(ics).toContain("LOCATION:Main Auditorium");
  });

  it("returns null when no start date is available", () => {
    expect(
      getIcsContent({
        ...baseEvent,
        event_date: null,
        start_date: null,
      }),
    ).toBeNull();
  });

  it("returns null for invalid start date", () => {
    expect(
      getIcsContent({
        ...baseEvent,
        event_date: "invalid",
        start_date: "invalid",
      }),
    ).toBeNull();
  });

  it("returns null for invalid end date", () => {
    expect(
      getIcsContent({
        ...baseEvent,
        end_date: "invalid",
      }),
    ).toBeNull();
  });

  it("defaults end date to 1 hour after start when end_date is null", () => {
    const ics = getIcsContent({
      ...baseEvent,
      end_date: null,
    });
    expect(ics).toBeTruthy();
    expect(ics).toMatch(/DTSTART:/);
    expect(ics).toMatch(/DTEND:/);
  });

  it("omits DESCRIPTION when description is null", () => {
    const ics = getIcsContent({
      ...baseEvent,
      description: null,
    });
    expect(ics).not.toContain("DESCRIPTION:");
  });

  it("omits LOCATION when location is null", () => {
    const ics = getIcsContent({
      ...baseEvent,
      location: null,
    });
    expect(ics).not.toContain("LOCATION:");
  });

  it("escapes newlines in description", () => {
    const ics = getIcsContent({
      ...baseEvent,
      description: "Line 1\nLine 2",
    });
    expect(ics).toContain("DESCRIPTION:Line 1\\nLine 2");
  });

  it("uses start_date over event_date", () => {
    const ics = getIcsContent({
      ...baseEvent,
      event_date: "2026-01-01T00:00:00Z",
      start_date: "2026-07-11T09:00:00Z",
    });
    expect(ics).toBeTruthy();
  });

  it("uses correct CRLF line endings", () => {
    const ics = getIcsContent(baseEvent);
    expect(ics).toContain("\r\n");
  });
});
