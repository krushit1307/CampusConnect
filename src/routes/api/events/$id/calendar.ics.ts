import { createClient } from "@/lib/supabase/client";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface IcsEventRow {
  title: string | null;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  event_date: string | null;
  location: string | null;
  venue_timezone: string | null;
}

/**
 * Format a Date as a compact UTC string: YYYYMMDDTHHMMSSZ
 * (e.g. 20260815T170000Z). RFC 5545 strict-UTC form — the trailing `Z`
 * means "this instant is in UTC, render in the importing client's local tz".
 */
function formatUtcCompact(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeIcsText(text: string): string {
  return (text || "")
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

function slugify(text: string): string {
  return (
    (text || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 60) || "event"
  );
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const eventId = params.id;

  if (!eventId || !UUID_RE.test(eventId)) {
    return new Response(
      JSON.stringify({ error: "Invalid event id" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient();

  const { data: event, error } = await supabase
    .from("events")
    .select(
      "title, description, start_date, end_date, event_date, location, venue_timezone",
    )
    .eq("id", eventId)
    .is("deleted_at", null)
    .maybeSingle<IcsEventRow>();

  if (error || !event) {
    return new Response(
      JSON.stringify({ error: "Event not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const startValue = event.start_date || event.event_date;
  if (!startValue) {
    return new Response(
      JSON.stringify({ error: "Event has no start date" }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  const start = new Date(startValue);
  if (Number.isNaN(start.getTime())) {
    return new Response(
      JSON.stringify({ error: "Event has an invalid start date" }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  const end = event.end_date
    ? new Date(event.end_date)
    : new Date(start.getTime() + 60 * 60 * 1000);
  const safeEnd = end.getTime() < start.getTime() ? start : end;

  // Strict UTC .ics per acceptance criterion #3.
  const dtStart = `DTSTART:${formatUtcCompact(start)}`;
  const dtEnd = `DTEND:${formatUtcCompact(safeEnd)}`;
  const dtStamp = `DTSTAMP:${formatUtcCompact(new Date())}`;
  const uid = `UID:${eventId}@campusconnect.app`;

  // Optional: embed the venue's local-time note in DESCRIPTION so users
  // importing to Google Calendar see "5:00 PM BST at venue" inline.
  const venueNote =
    event.venue_timezone && event.venue_timezone !== "UTC"
      ? `Venue local time: ${start.toLocaleString("en-US", { timeZone: event.venue_timezone })} (${event.venue_timezone}).`
      : null;

  const descriptionParts = [event.description || "", venueNote ?? ""].filter(Boolean);
  const description = descriptionParts.join("\n\n");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusConnect//Event//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    uid,
    dtStamp,
    dtStart,
    dtEnd,
    `SUMMARY:${escapeIcsText(event.title || "Untitled Event")}`,
    description ? `DESCRIPTION:${escapeIcsText(description)}` : null,
    event.location ? `LOCATION:${escapeIcsText(event.location)}` : null,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  const filename = `${slugify(event.title || "event")}-${eventId.slice(0, 8)}.ics`;

  return new Response(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "public, max-age=300",
    },
  });
}
