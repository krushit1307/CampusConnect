// =============================================================================
// Edge Function: Dispatch Club Notifications
// Issue: #2817 - Implement Push Subscriptions for Specific Clubs
// Description: Triggered when a new event is published.Queries the
// club_subscriptions table to find opted -in users, fetches their Web Push
// endpoints, and dispatches notifications in batches to avoid rate limits.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Configure VAPID keys (Must be set in Supabase Edge Function Secrets)
webpush.setVapidDetails(
  "mailto:notifications@campusconnect.com",
  Deno.env.get("VAPID_PUBLIC_KEY")!,
  Deno.env.get("VAPID_PRIVATE_KEY")!,
);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Use Service Role to bypass RLS for reading all subscribers
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { eventId, clubId, eventTitle, clubName } = await req.json();

    if (!eventId || !clubId) {
      throw new Error("Missing eventId or clubId");
    }

    // 1. Fetch all users subscribed to this club who want event notifications
    const { data: subscribers, error: subError } = await supabaseAdmin
      .from("club_subscriptions")
      .select("user_id")
      .eq("club_id", clubId)
      .eq("notify_events", true);

    if (subError) throw subError;
    if (!subscribers || subscribers.length === 0) {
      return new Response(JSON.stringify({ message: "No subscribers found for this club." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const userIds = subscribers.map((s) => s.user_id);

    // 2. Fetch the Web Push endpoints for these users
    const { data: pushEndpoints, error: pushError } = await supabaseAdmin
      .from("push_subscriptions")
      .select("*")
      .in("user_id", userIds);

    if (pushError) throw pushError;
    if (!pushEndpoints || pushEndpoints.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active push devices found for subscribers." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // 3. Construct the Push Notification Payload
    const payload = JSON.stringify({
      title: `New Event: ${eventTitle}`,
      body: `${clubName} just published a new event. Check it out!`,
      icon: "/icon-192x192.png",
      badge: "/badge-72x72.png",
      data: {
        url: `/events/${eventId}`,
        clubId: clubId,
      },
      tags: [`event-${eventId}`], // Prevents duplicate notifications for the same event
    });

    // 4. Dispatch notifications in batches to avoid VAPID service rate limits
    const BATCH_SIZE = 100;
    let successCount = 0;
    let failureCount = 0;

    for (let i = 0; i < pushEndpoints.length; i += BATCH_SIZE) {
      const batch = pushEndpoints.slice(i, i + BATCH_SIZE);

      const promises = batch.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh_key,
            auth: sub.auth_key,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          successCount++;
        } catch (err: any) {
          failureCount++;
          // If the subscription is no longer valid (e.g., user revoked permissions),
          // we should clean it up from the database.
          if (err.statusCode === 404 || err.statusCode === 410) {
            await supabaseAdmin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
          }
        }
      });

      await Promise.allSettled(promises);
    }

    return new Response(
      JSON.stringify({
        success: true,
        dispatched: successCount,
        failed: failureCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: any) {
    console.error("[DispatchClubNotifications] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
