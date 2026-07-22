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
    .replace(/\n/g, "\\n");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate Limiting: 20 requests per minute per IP for feed fetching
  const rateLimitResponse = await limitRate(req, "generate-ical", { limit: 20, windowMs: 60000 });
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  const url = new URL(req.url);
  const clubId = url.searchParams.get("club_id");

  if (!clubId) {
    return new Response("Missing club_id parameter", { status: 400 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing environment variables.");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch club info
    const { data: club, error: clubError } = await supabase
      .from("clubs")
      .select("name, description")
      .eq("id", clubId)
      .single();

    if (clubError || !club) {
      return new Response("Club not found", { status: 404 });
    }

    // Fetch events for this club
    const { data: events, error: eventsError } = await supabase
      .from("events")
      .select(
        "id, title, description, start_date, end_date, event_date, location, created_at, updated_at",
      )
      .eq("club_id", clubId)
      .order("start_date", { ascending: true });

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    // Build iCal string
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//CampusConnect//EN",
      "CALSCALE:GREGORIAN",
      `X-WR-CALNAME:${escapeICalText(club.name + " Events")}`,
      `X-WR-CALDESC:${escapeICalText(club.description || "")}`,
    ];

    const now = new Date();

    if (events) {
      for (const event of events) {
        const startDateStr = event.start_date || event.event_date;
        if (!startDateStr) continue;

        const startDate = new Date(startDateStr);
        // Default end date to 1 hour after start if not provided
        const endDate = event.end_date
          ? new Date(event.end_date)
          : new Date(startDate.getTime() + 60 * 60 * 1000);

        const dtstamp = event.updated_at
          ? new Date(event.updated_at)
          : event.created_at
            ? new Date(event.created_at)
            : now;

        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${event.id}@campusconnect`);
        lines.push(`DTSTAMP:${formatDateForICal(dtstamp)}`);
        lines.push(`DTSTART:${formatDateForICal(startDate)}`);
        lines.push(`DTEND:${formatDateForICal(endDate)}`);
        lines.push(`SUMMARY:${escapeICalText(event.title)}`);
        if (event.description) {
          lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
        }
        if (event.location) {
          lines.push(`LOCATION:${escapeICalText(event.location)}`);
        }
        lines.push("END:VEVENT");
      }
    }

    lines.push("END:VCALENDAR");

    // Must use \r\n for line endings according to the iCalendar specification (RFC 5545)
    const icalContent = lines.join("\r\n");

    return new Response(icalContent, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="club-${clubId}-events.ics"`,
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
