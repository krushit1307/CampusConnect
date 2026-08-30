// =============================================================================
// Edge Function: Trigger Post-Event Surveys
// Issue: #4042 - Implement 'Automated "Post-Event Feedback" Aggregation'
// Description: Cron job that runs hourly. Finds events that ended 1 hour ago,
// fetches attendees who checked in, and sends them a 1-click feedback email.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { createHmac } from "https://deno.land/std@0.177.0/node/crypto.ts";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = Deno.env.get("APP_URL") || "https://campusconnect.app";
const HMAC_SECRET = Deno.env.get("FEEDBACK_HMAC_SECRET") || "default-secret-change-me";

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${Deno.env.get("SUPABASE_CRON_SECRET")}`) {
        return new Response("Unauthorized", { status: 401 });
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
        );

        // 1. Find events that ended between 1 and 2 hours ago
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString();

        const { data: events, error: eventErr } = await supabaseAdmin
            .from("events")
            .select("id, title, club_id, clubs(name)")
            .gte("end_date", twoHoursAgo)
            .lte("end_date", oneHourAgo);

        if (eventErr) throw eventErr;
        if (!events || events.length === 0) {
            return new Response(JSON.stringify({ triggered: 0 }), { headers: corsHeaders });
        }

        let totalSent = 0;

        // 2. Iterate events and send surveys to attendees
        for (const event of events) {
            const { data: attendees } = await supabaseAdmin
                .from("event_rsvps")
                .select("user_id, profiles(full_name, email)")
                .eq("event_id", event.id)
                .eq("checked_in", true);

            if (!attendees) continue;

            for (const attendee of attendees) {
                const email = (attendee.profiles as any)?.email;
                if (!email) continue;

                // 3. Generate secure 1-click token
                const payload = `${event.id}:${attendee.user_id}`;
                const token = createHmac("sha256", HMAC_SECRET).update(payload).digest("hex");
                const feedbackUrl = `${APP_URL}/feedback/submit?event=${event.id}&user=${attendee.user_id}&token=${token}`;

                // 4. Send Email (Mocked Resend API call)
                const emailHtml = `
          <div style="font-family:sans-serif;max-width:500px;margin:0 auto;">
            <h2>How was "${event.title}"?</h2>
            <p>Hi ${(attendee.profiles as any)?.full_name || 'there'},</p>
            <p>We hope you enjoyed the event! Please take 2 seconds to rate it:</p>
            <div style="margin:20px 0;">
              ${[1, 2, 3, 4, 5].map(star => `
                <a href="${feedbackUrl}&rating=${star}" 
                   style="display:inline-block;margin:0 5px;padding:10px 15px;background:#4f46e5;color:#fff;
                          border-radius:8px;text-decoration:none;font-size:20px;font-weight:bold;">
                  ${star} ★
                </a>
              `).join('')}
            </div>
            <p style="color:#6b7280;font-size:12px;">This link is secure and unique to you.</p>
          </div>
        `;

                // In production, replace with actual Resend/SendGrid fetch call
                console.log(`[Survey] Sending to ${email} for event ${event.id}`);
                totalSent++;
            }
        }

        return new Response(JSON.stringify({ success: true, triggered: totalSent }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200
        });
    } catch (error: any) {
        console.error("[TriggerPostEventSurveys] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
