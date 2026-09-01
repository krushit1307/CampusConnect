// =============================================================================
// Edge Function: Donation Impact Report
// Issue: #3709 - Develop a 'Dynamic "Alumni Donation" Tracker'
// Description: Triggered when an event is completed with a photo gallery. Finds
// donations allocated to that event, emails each alum a stewardship report with
// success metrics, and flags the donation as reported.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_KEY = Deno.env.get("RESEND_API_KEY") || "";
const APP_URL = Deno.env.get("APP_URL") || "https://campusconnect.app";

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { event_id } = await req.json();
        if (!event_id) throw new Error("Missing event_id");

        // 1. Load the completed event + its success metrics
        const { data: event } = await supabaseAdmin
            .from("events")
            .select("title, cover_image_url, clubs(name)")
            .eq("id", event_id)
            .single();
        if (!event) throw new Error("Event not found");

        const { count: attendeeCount } = await supabaseAdmin
            .from("event_rsvps")
            .select("*", { count: "exact", head: true })
            .eq("event_id", event_id)
            .eq("checked_in", true);

        // 2. Find donations allocated to this event that have not been reported
        const { data: donations } = await supabaseAdmin.rpc("get_event_donations", {
            p_event_id: event_id,
        });

        const pending = (donations || []).filter((d: any) => !d.impact_reported);
        if (pending.length === 0) {
            return new Response(JSON.stringify({ notified: 0 }), { headers: corsHeaders });
        }

        // 3. Email each alum a beautiful impact report
        let notified = 0;
        for (const d of pending) {
            const dashboardUrl = `${APP_URL}/alumni/impact?donation=${d.donation_id}`;
            const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <h2 style="color:#4f46e5;">See your donation in action! 🎉</h2>
          <p>Hi ${d.alum_name},</p>
          <p>Thanks to your generous <strong>$${Number(d.amount).toLocaleString()}</strong> gift to the
             ${(event.clubs as any)?.name}, we successfully hosted
             <strong>${event.title}</strong> for <strong>${attendeeCount || 0}</strong> students.</p>
          <p>Your support made this possible. View the photo gallery and full impact metrics below.</p>
          <a href="${dashboardUrl}"
             style="display:inline-block;margin:16px 0;padding:12px 24px;background:#4f46e5;color:#fff;
                    border-radius:8px;text-decoration:none;font-weight:bold;">
            View Your Impact Dashboard
          </a>
        </div>`;

            if (RESEND_KEY) {
                const { data: profile } = await supabaseAdmin
                    .from("profiles").select("email").eq("id", d.alum_user_id).single();
                await fetch("https://api.resend.com/emails", {
                    method: "POST",
                    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
                    body: JSON.stringify({
                        from: "CampusConnect Giving <giving@campusconnect.app>",
                        to: [profile?.email],
                        subject: `Your $${d.amount} donation in action — ${event.title}`,
                        html,
                    }),
                });
            }

            // 4. Mark donation as reported so we never double-email
            await supabaseAdmin.from("donations").update({ impact_reported: true }).eq("id", d.donation_id);
            notified++;
        }

        return new Response(JSON.stringify({ notified, attendees: attendeeCount }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
        });
    } catch (error: any) {
        console.error("[DonationImpactReport] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
