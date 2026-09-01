import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
const sender = Deno.env.get("RESEND_FROM") ?? "CampusConnect <notifications@campusconnect.app>";
const appUrl = Deno.env.get("APP_URL") ?? "https://campusconnect.app";
const supabase = createClient(supabaseUrl, serviceRoleKey);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type MatchNotification = {
  match_id: string;
  campaign_title: string;
  club_name: string;
  club_slug: string;
  recipient_email: string;
  recipient_name: string;
  source_amount_cents: number;
  requested_amount_cents: number;
  source_display_name: string;
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>\"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ??
      character,
  );
}

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!serviceRoleKey || req.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Service-role authorization required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { sourceDonationId } = await req.json();
    if (typeof sourceDonationId !== "string" || !sourceDonationId) {
      return new Response(JSON.stringify({ error: "sourceDonationId is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: notifications, error: notificationError } = await supabase.rpc(
      "get_campaign_match_notifications",
      { p_donation_id: sourceDonationId },
    );
    if (notificationError) throw new Error(notificationError.message);

    let sent = 0;
    let failed = 0;

    for (const notification of (notifications ?? []) as MatchNotification[]) {
      const matchUrl = `${appUrl}/clubs/${encodeURIComponent(notification.club_slug)}?match_id=${encodeURIComponent(notification.match_id)}`;
      const subject = `${notification.source_display_name} just donated to ${notification.club_name}`;
      const html = `
        <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
          <h2>A student donation can go twice as far</h2>
          <p><strong>${escapeHtml(notification.source_display_name)}</strong> just donated
          <strong>${escapeHtml(formatUsd(Number(notification.source_amount_cents)))}</strong>
          to <strong>${escapeHtml(notification.club_name)}</strong>'s campaign
          “${escapeHtml(notification.campaign_title)}”.</p>
          <p>Would you like to match it with a ${escapeHtml(formatUsd(Number(notification.requested_amount_cents)))} alumni gift?</p>
          <p><a href="${matchUrl}" style="display:inline-block;background:#a3e635;color:#111;padding:12px 18px;font-weight:700;text-decoration:none">Match this donation</a></p>
          <p style="font-size:12px;color:#555">This invitation is personal to you and expires if another alumni supporter completes it first.</p>
        </div>
      `;

      let delivered = false;
      try {
        if (!resendApiKey) {
          console.log(
            `[DonationMatch Simulation] Would send ${notification.match_id} to ${notification.recipient_email}`,
          );
          delivered = true;
        } else {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: sender,
              to: [notification.recipient_email],
              subject,
              html,
            }),
          });
          if (!response.ok) {
            console.error(
              `[DonationMatch] Resend failed for ${notification.match_id}: ${await response.text()}`,
            );
          } else {
            delivered = true;
          }
        }
      } catch (error) {
        console.error(`[DonationMatch] Notification failed for ${notification.match_id}:`, error);
      }

      await supabase.rpc("record_campaign_match_notification", {
        p_match_id: notification.match_id,
        p_delivered: delivered,
      });
      if (delivered) sent += 1;
      else failed += 1;
    }

    return new Response(JSON.stringify({ success: true, sent, failed }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[DonationMatch] Notification function failed:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
