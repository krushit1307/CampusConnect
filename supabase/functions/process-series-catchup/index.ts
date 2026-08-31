import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export interface SeriesCatchUpJobPayload {
  eventId?: string;
  source?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendKey = Deno.env.get("RESEND_API_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceKey);

    let payload: SeriesCatchUpJobPayload = {};
    try {
      payload = await req.json();
    } catch {
      payload = {};
    }

    const now = new Date();
    // Look for events ended in the past 24 hours with a series_id
    let eventQuery = supabaseAdmin
      .from("events")
      .select("id, title, series_id, recording_url, materials_url, end_date, event_date")
      .not("series_id", "is", null);

    if (payload.eventId) {
      eventQuery = eventQuery.eq("id", payload.eventId);
    } else {
      const lowerBound = new Date(now.getTime() - 48 * 60 * 60 * 1000);
      eventQuery = eventQuery.lte("end_date", now.toISOString()).gte("end_date", lowerBound.toISOString());
    }

    const { data: events, error: fetchErr } = await eventQuery;

    if (fetchErr) {
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalCatchups = 0;
    let emailsDispatched = 0;

    for (const event of events || []) {
      const { data: rpcRes, error: rpcErr } = await supabaseAdmin.rpc(
        "process_series_no_show_catchups",
        { p_event_id: event.id },
      );

      if (rpcErr) {
        console.error(`Error processing series catchup for event ${event.id}:`, rpcErr);
        continue;
      }

      totalCatchups += rpcRes?.catchups_generated || 0;

      // Dispatch automated catch-up email if Resend is configured
      if (resendKey && (event.recording_url || event.materials_url)) {
        // Fetch newly created catchups
        const { data: catchupRows } = await supabaseAdmin
          .from("event_series_catchups")
          .select("id, user_id")
          .eq("missed_event_id", event.id);

        for (const row of catchupRows || []) {
          const { data: userRecord } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
          const email = userRecord?.user?.email;
          if (!email) continue;

          const publicAppUrl = Deno.env.get("PUBLIC_APP_URL") ?? supabaseUrl;
          const vodUrl = event.recording_url
            ? `${publicAppUrl}/api/catchup/track?id=${row.id}&type=vod&dest=${encodeURIComponent(event.recording_url)}`
            : null;
          const materialsUrl = event.materials_url
            ? `${publicAppUrl}/api/catchup/track?id=${row.id}&type=materials&dest=${encodeURIComponent(event.materials_url)}`
            : null;

          const nextEventTitle = rpcRes?.next_event_title ? `before ${rpcRes.next_event_title}` : "before next week";

          const html = `
            <h2>We missed you at ${event.title}!</h2>
            <p>Don't worry about falling behind in the series. Here are the session materials so you can catch up ${nextEventTitle}:</p>
            <ul>
              ${vodUrl ? `<li><a href="${vodUrl}">▶ Watch Session Recording (VOD)</a></li>` : ""}
              ${materialsUrl ? `<li><a href="${materialsUrl}">📄 Download Slide Deck & Code Materials</a></li>` : ""}
            </ul>
            <p>See you at the next session!</p>
          `;

          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "CampusConnect Series <series@campusconnect.app>",
              to: [email],
              subject: `Catch up on ${event.title}!`,
              html,
            }),
          });
          emailsDispatched++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        eventsProcessed: events?.length || 0,
        totalCatchups,
        emailsDispatched,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
