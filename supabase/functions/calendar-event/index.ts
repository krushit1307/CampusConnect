import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { limitRate } from "../shared/rate_limiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDateForICal(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function escapeICalText(text: string): string {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate Limiting: 60 requests per minute per IP
  const rateLimitResponse = await limitRate(req, "calendar-event", { limit: 60, windowMs: 60000 });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const url = new URL(req.url);
  const eventId = url.searchParams.get("event_id");

  if (!eventId) {
    return new Response("Missing event_id parameter", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch event info
    const { data: event, error: eventError } = await supabase
      .from("events")
      .select(
        "id, title, description, start_date, end_date, event_date, location, created_at, updated_at",
      )
      .eq("id", eventId)
      .is("deleted_at", null)
      .single();

    if (eventError || !event) {
      return new Response("Event not found", { status: 404 });
    }

    // Determine Start and End dates
    const startDateStr = event.start_date || event.event_date;
    if (!startDateStr) {
      return new Response("Event does not have a valid start date", { status: 400 });
    }
    const startDate = new Date(startDateStr);

    let endDate = event.end_date
      ? new Date(event.end_date)
      : new Date(startDate.getTime() + 60 * 60 * 1000); // Default to 1 hour after start

    if (endDate.getTime() < startDate.getTime()) {
      endDate = startDate;
    }

    const dtstamp = event.updated_at
      ? new Date(event.updated_at)
      : event.created_at
        ? new Date(event.created_at)
        : new Date();

    const frontendUrl = Deno.env.get("FRONTEND_URL") || "https://campusconnect.app";
    const eventUrl = `${frontendUrl}/events/${event.id}`;

    let description = (event.description ?? "").trim();
    description += `\n\nView on CampusConnect: ${eventUrl}`;

    // Build iCal string
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CampusConnect//Event//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${event.id}@campusconnect.app`,
      `DTSTAMP:${formatDateForICal(dtstamp)}`,
      `DTSTART:${formatDateForICal(startDate)}`,
      `DTEND:${formatDateForICal(endDate)}`,
      `SUMMARY:${escapeICalText(event.title)}`,
    ];

    if (description) {
      lines.push(`DESCRIPTION:${escapeICalText(description)}`);
    }
    if (event.location) {
      lines.push(`LOCATION:${escapeICalText(event.location)}`);
    }
    lines.push(`URL:${eventUrl}`);
    lines.push("END:VEVENT");
    lines.push("END:VCALENDAR");

    // Must use \r\n for line endings according to the iCalendar specification (RFC 5545)
    const icalContent = lines.join("\r\n");
    const filename = `${slugify(event.title || event.id)}.ics`;

    return new Response(icalContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error: unknown) {
    console.error("Internal Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "An unexpected error occurred.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      },
    );
  }
});
