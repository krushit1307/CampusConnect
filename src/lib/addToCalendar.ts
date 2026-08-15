// src/lib/addToCalendar.ts
//
// Unified "Add to Calendar" utilities (Issue #2688).
//
// Generates RFC 5545-compliant .ics strings and Google / Outlook
// calendar URLs from a CampusConnect event object. Handles multi-day
// events and strict UTC timezones to avoid imports shifting by hours.

/**
 * The subset of an event needed to generate calendar entries.
 * Accepts both `event_date` (legacy single-timestamp field) and the
 * newer `start_date` / `end_date` pair. At least one start field is
 * required.
 */
export interface CalendarEvent {
  id: string;
  title: string;
  description?: string | null;
  /** Legacy single-timestamp field (full ISO string). */
  event_date?: string | null;
  /** Modern start field (full ISO string). Takes precedence over event_date. */
  start_date?: string | null;
  /** Modern end field. Defaults to start + 1 hour if omitted. */
  end_date?: string | null;
  location?: string | null;
  /** Optional URL of the event page on CampusConnect — embedded in the description. */
  eventUrl?: string;
}

/**
 * Google Calendar "render" URL with the event pre-filled.
 * Format: https://calendar.google.com/calendar/render?action=TEMPLATE&text=...&dates=...
 *
 * Google expects UTC dates in the compact form `YYYYMMDDTHHMMSSZ`.
 */
export function getGoogleCalendarUrl(event: CalendarEvent): string | null {
  const { start, end } = resolveDates(event);
  if (!start || !end) return null;

  const dates = `${formatUtcCompact(start)}/${formatUtcCompact(end)}`;
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: event.title,
    dates,
  });

  const details = buildDescriptionWithLink(event);
  if (details) params.append("details", details);
  if (event.location) params.append("location", event.location);

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/**
 * Yahoo Calendar URL. Yahoo uses the same compact UTC format as Google
 * but a different path and parameter names.
 */
export function getYahooCalendarUrl(event: CalendarEvent): string | null {
  const { start, end } = resolveDates(event);
  if (!start || !end) return null;

  const durationMinutes = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const params = new URLSearchParams({
    v: "60",
    title: event.title,
    st: formatUtcCompact(start),
    dur: String(durationMinutes),
  });
  const details = buildDescriptionWithLink(event);
  if (details) params.append("desc", details);
  if (event.location) params.append("in_loc", event.location);

  return `https://calendar.yahoo.com/?${params.toString()}`;
}

/**
 * Generate a standard RFC 5545 .ics file content string.
 *
 * Timezone handling: the .ics uses strict UTC (DTSTART:YYYYMMDDTHHMMSSZ)
 * rather than TZID-anchored local times. This guarantees the event
 * shows at the correct wall-clock time regardless of the importing
 * user's timezone — the Z suffix means "this is UTC, convert to local".
 *
 * Multi-day events are handled naturally: if end_date is 2 days after
 * start_date, DTEND will be 2 days after DTSTART. No special-casing
 * is needed; the .ics spec treats DTSTART/DTEND as absolute instants.
 */
export function getIcsContent(event: CalendarEvent): string | null {
  const { start, end } = resolveDates(event);
  if (!start || !end) return null;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusConnect//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${event.id}@campusconnect.app`,
    `DTSTAMP:${formatUtcCompact(new Date())}`,
    `DTSTART:${formatUtcCompact(start)}`,
    `DTEND:${formatUtcCompact(end)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ];

  const description = buildDescriptionWithLink(event);
  if (description) {
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);
  }
  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`);
  }
  if (event.eventUrl) {
    lines.push(`URL:${event.eventUrl}`);
  }

  lines.push("END:VEVENT", "END:VCALENDAR");

  // RFC 5545 requires CRLF line breaks.
  return lines.join("\r\n");
}

export function downloadIcsFile(event: CalendarEvent): void {
  const icsContent = getIcsContent(event);
  if (!icsContent) {
    console.error("[addToCalendar] Failed to generate .ics content");
    return;
  }

  const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${slugify(event.title || event.id)}.ics`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Release the object URL after the click has been processed.
  // setTimeout ensures the browser has started the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── Helpers ──────────────────────────────────────────────────────

interface ResolvedDates {
  start: Date | null;
  end: Date | null;
}

/**
 * Resolve the start/end Date objects from the CalendarEvent.
 *
 * Precedence:
 *   - start_date (modern) > event_date (legacy)
 *   - end_date > start_date + 1 hour (default duration)
 */
function resolveDates(event: CalendarEvent): ResolvedDates {
  const startValue = event.start_date || event.event_date;
  if (!startValue) return { start: null, end: null };

  const start = new Date(startValue);
  if (isNaN(start.getTime())) return { start: null, end: null };

  const endValue = event.end_date
    ? new Date(event.end_date)
    : new Date(start.getTime() + 60 * 60 * 1000); // default 1 hour
  if (isNaN(endValue.getTime())) return { start: null, end: null };

  // Clamp end to be at least equal to start (Google Calendar rejects
  // events where end < start).
  if (endValue.getTime() < start.getTime()) {
    return { start, end: start };
  }

  return { start, end: endValue };
}

/**
 * Format a Date as a compact UTC string: YYYYMMDDTHHMMSSZ
 * e.g. 20260815T193000Z
 *
 * This is the format required by both Google Calendar URLs and the
 * .ics DTSTART/DTEND properties when using UTC.
 */
function formatUtcCompact(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Build the calendar description, appending a "View on CampusConnect"
 * link if an eventUrl is provided. The link is appended on a new line
 * so the description reads naturally.
 */
function buildDescriptionWithLink(event: CalendarEvent): string {
  const baseDescription = (event.description ?? "").trim();
  if (!event.eventUrl) return baseDescription;
  const linkLine = `\n\nView on CampusConnect: ${event.eventUrl}`;
  return baseDescription ? baseDescription + linkLine : linkLine.trim();
}

/**
 * Escape special characters per RFC 5545 §3.3.11:
 *   - Backslash → \\
 *   - Semicolon → \;
 *   - Comma → \,
 *   - Newline → \n (literal backslash-n)
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Convert a string into a URL-safe filename slug.
 * e.g. "Tech Symposium 2026!!!" → "tech-symposium-2026"
 */
function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "event"
  );
}
