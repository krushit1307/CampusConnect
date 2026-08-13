// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore: Deno imports
import webpush from "https://esm.sh/web-push@3.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { eventId, rsvpCount, venueCapacity } = body;

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch Event, Primary Host Club, and Club President User ID
    const { data: eventHosts, error: hostError } = await supabase
      .from("event_hosts")
      .select("club_id, clubs(created_by, name), events(title)")
      .eq("event_id", eventId)
      .eq("is_primary_host", true)
      .single();

    if (hostError || !eventHosts) {
      console.error("[CapacityWarning] Failed to fetch host details:", hostError);
      return new Response(JSON.stringify({ error: "Failed to fetch event host" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventTitle = eventHosts.events?.title || "Unnamed Event";
    const clubName = eventHosts.clubs?.name || "Unnamed Club";
    const presidentId = eventHosts.clubs?.created_by;

    if (!presidentId) {
      console.warn("[CapacityWarning] No president found for club", eventHosts.club_id);
      return new Response(JSON.stringify({ success: true, message: "No president associated with primary host club" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch President's Profile (Name, Phone Number)
    const { data: presidentProfile, error: profileError } = await supabase
      .from("profiles")
      .select("full_name, phone_number")
      .eq("id", presidentId)
      .single();

    if (profileError || !presidentProfile) {
      console.error("[CapacityWarning] Failed to fetch president profile:", profileError);
    }

    const presidentName = presidentProfile?.full_name || "Club President";
    const presidentPhone = presidentProfile?.phone_number;

    const messageText = `CRITICAL: Event "${eventTitle}" (hosted by ${clubName}) is at 90% capacity. Please ensure you have crowd control in place or close registration.`;

    console.log(`[CapacityWarning] Warning trigger message constructed: "${messageText}"`);

    // 3. SMS Alert (via Twilio)
    let smsSent = false;
    let smsError = null;
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioFromNumber = Deno.env.get("TWILIO_FROM_NUMBER");

    if (presidentPhone && twilioAccountSid && twilioAuthToken && twilioFromNumber) {
      try {
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const basicAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

        const smsRes = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${basicAuth}`,
          },
          body: new URLSearchParams({
            From: twilioFromNumber,
            To: presidentPhone,
            Body: messageText,
          }).toString(),
        });

        if (smsRes.ok) {
          smsSent = true;
          console.log(`[CapacityWarning] SMS successfully dispatched via Twilio to: ${presidentPhone}`);
        } else {
          const errBody = await smsRes.text();
          smsError = `Twilio API returned status ${smsRes.status}: ${errBody}`;
          console.error("[CapacityWarning] Twilio SMS dispatch failed:", smsError);
        }
      } catch (err: any) {
        smsError = err.message || err;
        console.error("[CapacityWarning] SMS dispatch error:", err);
      }
    } else {
      console.warn("[CapacityWarning] Twilio credentials or president phone_number missing. SMS dispatch skipped.");
    }

    // 4. Web Push Notification Alert
    let pushSent = false;
    let pushError = null;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@campusconnect.app";

    if (vapidPublicKey && vapidPrivateKey) {
      try {
        webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

        const { data: subscriptions, error: subError } = await supabase
          .from("push_subscriptions")
          .select("endpoint, p256dh, auth")
          .eq("user_id", presidentId);

        if (subError) {
          throw new Error(`Failed to fetch push subscriptions: ${subError.message}`);
        }

        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: "CRITICAL: Event Capacity Alert",
            body: messageText,
            icon: "/favicon.png",
            data: { url: `/events/${eventId}` },
            tag: `capacity-warning-${eventId}`,
          });

          const sendPromises = subscriptions.map(async (sub: any) => {
            const pushSubscription = {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            };
            try {
              await webpush.sendNotification(pushSubscription as any, payload);
            } catch (err: any) {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
              }
              throw err;
            }
          });

          await Promise.all(sendPromises);
          pushSent = true;
          console.log(`[CapacityWarning] Push notifications successfully dispatched to ${subscriptions.length} devices.`);
        } else {
          console.log("[CapacityWarning] No push subscriptions found for president.");
        }
      } catch (err: any) {
        pushError = err.message || err;
        console.error("[CapacityWarning] Web Push dispatch failed:", err);
      }
    } else {
      console.warn("[CapacityWarning] VAPID keys missing. Web Push notification skipped.");
    }

    return new Response(
      JSON.stringify({
        success: true,
        smsSent,
        smsError,
        pushSent,
        pushError,
        message: messageText,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[CapacityWarning] Server error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
