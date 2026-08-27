// src/lib/addToCalendar.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getGoogleCalendarUrl,
  getYahooCalendarUrl,
  getIcsContent,
  downloadIcsFile,
  type CalendarEvent,
} from "./addToCalendar";

const sampleEvent: CalendarEvent = {
  id: "evt-123",
  title: "Tech Symposium 2026",
  description: "A full-day symposium on emerging technologies.",
  start_date: "2026-08-15T19:30:00.000Z",
  end_date: "2026-08-15T22:00:00.000Z",
  location: "Main Auditorium, IIT Delhi",
  eventUrl: "https://campusconnect.app/events/evt-123",
};

describe("addToCalendar — getGoogleCalendarUrl", () => {
  it("returns a valid Google Calendar URL with UTC dates", () => {
    const url = getGoogleCalendarUrl(sampleEvent);
    expect(url).not.toBeNull();
    expect(url).toContain("https://calendar.google.com/calendar/render");
    expect(url).toContain("action=TEMPLATE");
    expect(url).toContain("text=Tech+Symposium+2026");
    // UTC compact format: YYYYMMDDTHHMMSSZ
    expect(url).toContain("dates=20260815T193000Z/20260815T220000Z");
  });

  it("includes the description with the back-link", () => {
    const url = getGoogleCalendarUrl(sampleEvent);
    expect(url).not.toBeNull();
    // URL-encoded "View on CampusConnect" link is in `details`.
    expect(url).toMatch(/details=.*View\+on\+CampusConnect/);
    expect(url).toContain("campusconnect.app%2Fevents%2Fevt-123");
  });

  it("includes the location", () => {
    const url = getGoogleCalendarUrl(sampleEvent);
    expect(url).toContain("location=Main+Auditorium");
  });

  it("returns null when no start date is provided", () => {
    const url = getGoogleCalendarUrl({ ...sampleEvent, start_date: null, event_date: null });
    expect(url).toBeNull();
  });

  it("falls back to event_date when start_date is absent", () => {
    const url = getGoogleCalendarUrl({
      ...sampleEvent,
      start_date: null,
      event_date: "2026-08-15T19:30:00.000Z",
    });
    expect(url).not.toBeNull();
    expect(url).toContain("dates=20260815T193000Z/");
  });

  it("defaults end to start + 1 hour when end_date is absent", () => {
    const url = getGoogleCalendarUrl({
      ...sampleEvent,
      end_date: null,
    });
    expect(url).not.toBeNull();
    // start=19:30, default end=20:30
    expect(url).toContain("dates=20260815T193000Z/20260815T203000Z");
  });

  it("handles multi-day events", () => {
    const url = getGoogleCalendarUrl({
      ...sampleEvent,
      start_date: "2026-08-15T09:00:00.000Z",
      end_date: "2026-08-17T18:00:00.000Z",
    });
    expect(url).toContain("dates=20260815T090000Z/20260817T180000Z");
  });
});

describe("addToCalendar — getYahooCalendarUrl", () => {
  it("returns a Yahoo Calendar URL with duration in minutes", () => {
    const url = getYahooCalendarUrl(sampleEvent);
    expect(url).not.toBeNull();
    expect(url).toContain("https://calendar.yahoo.com/");
    expect(url).toContain("v=60");
    expect(url).toContain("title=Tech+Symposium+2026");
    expect(url).toContain("st=20260815T193000Z");
    // 19:30 → 22:00 = 150 minutes
    expect(url).toContain("dur=150");
  });
});

describe("addToCalendar — getIcsContent", () => {
  it("returns a valid RFC 5545 .ics string", () => {
    const ics = getIcsContent(sampleEvent);
    expect(ics).not.toBeNull();
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
    expect(ics).toContain("PRODID:-//CampusConnect//Event//EN");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("END:VEVENT");
    expect(ics).toContain("END:VCALENDAR");
  });

  it("uses CRLF line breaks", () => {
    const ics = getIcsContent(sampleEvent);
    expect(ics).toContain("\r\n");
    expect(ics).not.toMatch(/[^\r]\n/);
  });

  it("includes UID with the event id", () => {
    const ics = getIcsContent(sampleEvent);
    expect(ics).toContain("UID:evt-123@campusconnect.app");
  });

  it("includes DTSTART and DTEND in UTC compact format", () => {
    const ics = getIcsContent(sampleEvent);
    expect(ics).toContain("DTSTART:20260815T193000Z");
    expect(ics).toContain("DTEND:20260815T220000Z");
  });

  it("includes the summary (title)", () => {
    const ics = getIcsContent(sampleEvent);
    expect(ics).toContain("SUMMARY:Tech Symposium 2026");
  });

  it("includes the description with the back-link", () => {
    const ics = getIcsContent(sampleEvent);
    expect(ics).toContain("DESCRIPTION:");
    expect(ics).toContain("A full-day symposium on emerging technologies.");
    expect(ics).toContain("View on CampusConnect: https://campusconnect.app/events/evt-123");
  });

  it("includes the location", () => {
    const ics = getIcsContent(sampleEvent);
    expect(ics).toContain("LOCATION:Main Auditorium, IIT Delhi");
  });

  it("includes the URL property when eventUrl is provided", () => {
    const ics = getIcsContent(sampleEvent);
    expect(ics).toContain("URL:https://campusconnect.app/events/evt-123");
  });

  it("escapes special characters per RFC 5545", () => {
    const ics = getIcsContent({
      ...sampleEvent,
      title: "Seminar: AI, ML & Data",
      description: "Line 1\nLine 2; with semicolon, and comma",
    });
    // Semicolons and commas in values must be escaped.
    expect(ics).toContain("SUMMARY:Seminar\\: AI\\, ML & Data");
    expect(ics).toContain("Line 1\\nLine 2\\; with semicolon\\, and comma");
  });

  it("handles multi-day events correctly", () => {
    const ics = getIcsContent({
      ...sampleEvent,
      start_date: "2026-08-15T09:00:00.000Z",
      end_date: "2026-08-17T18:00:00.000Z",
    });
    expect(ics).toContain("DTSTART:20260815T090000Z");
    expect(ics).toContain("DTEND:20260817T180000Z");
  });

  it("returns null when no start date is provided", () => {
    const ics = getIcsContent({ ...sampleEvent, start_date: null, event_date: null });
    expect(ics).toBeNull();
  });

  it("clamps end to start when end < start", () => {
    const ics = getIcsContent({
      ...sampleEvent,
      start_date: "2026-08-15T22:00:00.000Z",
      end_date: "2026-08-15T19:00:00.000Z", // before start
    });
    expect(ics).toContain("DTSTART:20260815T220000Z");
    expect(ics).toContain("DTEND:20260815T220000Z"); // clamped to start
  });
});

describe("addToCalendar — downloadIcsFile", () => {
  let createObjectURLSpy: ReturnType<typeof vi.fn>;
  let revokeObjectURLSpy: ReturnType<typeof vi.fn>;
  let createElementSpy: ReturnType<typeof vi.fn>;
  let appendChildSpy: ReturnType<typeof vi.fn>;
  let removeChildSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createObjectURLSpy = vi.fn(() => "blob:fake-url");
    revokeObjectURLSpy = vi.fn();
    createElementSpy = vi.fn(() => ({
      href: "",
      download: "",
      style: {},
      click: vi.fn(),
    }));
    appendChildSpy = vi.fn();
    removeChildSpy = vi.fn();

    vi.stubGlobal("URL", {
      createObjectURL: createObjectURLSpy,
      revokeObjectURL: revokeObjectURLSpy,
    });
    vi.stubGlobal(
      "Blob",
      vi.fn((parts, opts) => ({ parts, opts })),
    );
    vi.stubGlobal("document", {
      createElement: createElementSpy,
      body: { appendChild: appendChildSpy, removeChild: removeChildSpy },
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("creates a Blob with the .ics content and triggers a download", () => {
    downloadIcsFile(sampleEvent);

    expect(Blob).toHaveBeenCalledWith([expect.any(String)], {
      type: "text/calendar;charset=utf-8",
    });
    expect(createObjectURLSpy).toHaveBeenCalled();
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });

  it("slugifies the filename from the event title", () => {
    const linkEl = { href: "", download: "", style: {}, click: vi.fn() };
    createElementSpy.mockReturnValue(linkEl);

    downloadIcsFile(sampleEvent);

    expect(linkEl.download).toBe("tech-symposium-2026.ics");
  });

  it("revokes the object URL after a delay", () => {
    downloadIcsFile(sampleEvent);

    expect(revokeObjectURLSpy).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:fake-url");
  });

  it("does nothing when getIcsContent returns null", () => {
    downloadIcsFile({ ...sampleEvent, start_date: null, event_date: null });
    expect(Blob).not.toHaveBeenCalled();
  });
});

describe("addToCalendar — sanitizeCalendarDescription", () => {
  it("strips Markdown formatting", () => {
    const description = "**Bold text**\n*Italic text*\n# Heading\n- bullet\n[Link](https://example.com)\n\`code\`";
    const result = sanitizeCalendarDescription(description);
    expect(result).toContain("Bold text");
    expect(result).toContain("Italic text");
    expect(result).toContain("Heading");
    expect(result).toContain("bullet");
    expect(result).toContain("Link");
    expect(result).toContain("code");
    // Should NOT contain Markdown syntax
    expect(result).not.toContain("**");
    expect(result).not.toContain("*");
    expect(result).not.toContain("#");
    expect(result).not.toContain("[Link](https://example.com)");
    expect(result).not.toContain("\`code\`");
  });

  it("strips HTML tags", () => {
    const description = "<div>Hello</div><br><p>World</p>";
    const result = sanitizeCalendarDescription(description);
    expect(result).toContain("Hello");
    expect(result).toContain("World");
    // Should NOT contain HTML tags
    expect(result).not.toContain("<div>");
    expect(result).not.toContain("</div>");
    expect(result).not.toContain("<br>");
    expect(result).not.toContain("<p>");
    expect(result).not.toContain("</p>");
  });

  it("handles mixed Markdown and HTML", () => {
    const description = "**Bold** and *italic* with `code`, [link](https://example.com), # heading, - bullet, <div>html</div>";
    const result = sanitizeCalendarDescription(description);
    expect(result).toContain("Bold");
    expect(result).toContain("italic");
    expect(result).toContain("code");
    expect(result).toContain("link");
    expect(result).toContain("heading");
    expect(result).toContain("bullet");
    expect(result).not.toContain("<div>");
    expect(result).not.toContain("**");
    expect(result).not.toContain("*italic* as markdown");
  });

  it("preserves plain-text URLs", () => {
    const description = "Check out https://example.com for more info";
    const result = sanitizeCalendarDescription(description);
    expect(result).toContain("https://example.com");
  });

  it("preserves normal punctuation", () => {
    const description = "Hello, world! This is a test (with parens).";
    const result = sanitizeCalendarDescription(description);
    expect(result).toContain("Hello,");
    expect(result).toContain("world!");
    expect(result).toContain("This is a test");
    expect(result).toContain("(with parens).");
  });

  it("preserves CampusConnect link via buildDescriptionWithLink", () => {
    const event = {
      id: "evt-123",
      title: "Test Event",
      description: "**Bold description**",
      event_date: "2026-08-15T19:30:00.000Z",
      start_date: "2026-08-15T19:30:00.000Z",
      end_date: "2026-08-15T22:00:00.000Z",
      location: "Room 101",
      eventUrl: "/events/evt-123",
    };
    const url = getGoogleCalendarUrl(event);
    expect(url).not.toBeNull();
    // The sanitized description + CampusConnect link should be in details
    expect(url).toMatch(/details=.*View\+on\+CampusConnect/);
    expect(url).toContain("campusconnect.app%2Fevents%2Fevt-123");
    // The raw Markdown should NOT appear in the URL
    expect(url).not.toMatch(/\*\*/);
  });

  it("RFC 5545 escaping is preserved after sanitization", () => {
    const description = "Line 1\nLine 2; with semicolon, and comma";
    const sanitized = sanitizeCalendarDescription(description);
    // After sanitization, escapeIcsText should still work
    const escaped = sanitized
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
    expect(escaped).toContain("Line 1\\n");
    expect(escaped).toContain("Line 2\\;");
    expect(escaped).toContain("and\\, comma");
  });
});
