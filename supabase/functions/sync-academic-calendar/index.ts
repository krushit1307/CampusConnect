import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parseAcademicCalendarIcs } from "../_shared/academicCalendar.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST" && req.method !== "GET")
    return json({ error: "Method not allowed" }, 405);

  const feedUrl = Deno.env.get("ACADEMIC_CALENDAR_ICS_URL");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!feedUrl || !supabaseUrl || !serviceRoleKey) {
    return json({ error: "Calendar sync is not configured" }, 500);
  }

  const authorization = req.headers.get("Authorization");
  if (authorization !== `Bearer ${serviceRoleKey}`) return json({ error: "Unauthorized" }, 401);

  try {
    const response = await fetch(feedUrl, {
      headers: { Accept: "text/calendar, text/plain;q=0.9, */*;q=0.1" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`ICS feed returned HTTP ${response.status}`);

    const feed = await response.text();
    const parsedEvents = parseAcademicCalendarIcs(feed);
    if (parsedEvents.length === 0) throw new Error("ICS feed contained no valid VEVENT records");

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const rows = parsedEvents.map((event) => ({
      source_uid: event.sourceUid,
      title: event.title,
      start_date: event.startDate,
      end_date: event.endDate,
      type: event.type,
      source_url: feedUrl,
      synced_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase
      .from("campus_calendar_events")
      .upsert(rows, { onConflict: "source_uid" });
    if (upsertError) throw upsertError;

    const sourceUids = parsedEvents.map((event) => event.sourceUid);
    const { data: existingRows, error: existingError } = await supabase
      .from("campus_calendar_events")
      .select("id, source_uid")
      .eq("source_url", feedUrl)
      .limit(5000);
    if (existingError) throw existingError;

    const staleIds = (existingRows ?? [])
      .filter((row) => !sourceUids.includes(row.source_uid))
      .map((row) => row.id);
    if (staleIds.length > 0) {
      const { error: deleteError } = await supabase
        .from("campus_calendar_events")
        .delete()
        .in("id", staleIds);
      if (deleteError) throw deleteError;
    }

    return json({ synced: parsedEvents.length, removed: staleIds.length, feedUrl });
  } catch (error) {
    console.error("[sync-academic-calendar] sync failed", error);
    return json({ error: error instanceof Error ? error.message : "Calendar sync failed" }, 502);
  }
});
