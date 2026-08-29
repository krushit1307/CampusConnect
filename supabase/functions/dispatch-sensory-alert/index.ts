import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webpush from "https://esm.sh/web-push@3.6.0";
import { verifyAuth } from "../shared/auth-middleware.ts";

const SENSORY_ALERT_TITLE = "Sensory Alert";
const SENSORY_ALERT_MESSAGE =
  "The Main Hall is very loud right now. Click here for routing to the Quiet Room.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return json({ error: "Unauthorized" }, 401);
    }

    const { eventId, decibels } = (await req.json().catch(() => ({}))) as {
      eventId?: string;
      decibels?: number;
    };
    if (!eventId) return json({ error: "Missing eventId" }, 400);

    const { data: isOrganizer } = await supabase.rpc("is_event_organizer", {
      p_event_id: eventId,
      p_user_id: user.id,
    });
    if (!isOrganizer) {
      return json({ error: "Forbidden" }, 403);
    }

    const { data: recent } = await supabase
      .from("sensory_alerts")
      .select("id")
      .eq("event_id", eventId)
      .gte("created_at", new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .limit(1)
      .maybeSingle();
    if (recent?.id) {
      return json({ success: true, skipped: "already_alerted" });
    }

    const { data: alertRow, error: insertError } = await supabase
      .from("sensory_alerts")
      .insert({
        event_id: eventId,
        decibels: Math.round(Number(decibels) || 0),
        duration_minutes: 5,
        message: SENSORY_ALERT_MESSAGE,
      })
      .select("id")
      .single();
    if (insertError) {
      console.error("[dispatch-sensory-alert] insert failed:", insertError);
      return json({ error: "Failed to record sensory alert" }, 500);
    }

    const route = `/events/${eventId}?quietRoute=1`;
    const { data: rsvps } = await supabase
      .from("event_rsvps")
      .select("user_id")
      .eq("event_id", eventId)
      .in("status", ["attending", "approved", "going", "confirmed", "PAID"]);

    const userIds = [...new Set((rsvps || []).map((r) => r.user_id).filter(Boolean))];
    let pushed = 0;

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@campusconnect.app";

    if (vapidPublicKey && vapidPrivateKey && userIds.length > 0) {
      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("user_id, endpoint, p256dh, auth, subscription")
        .in("user_id", userIds);

      const payload = JSON.stringify({
        title: SENSORY_ALERT_TITLE,
        body: SENSORY_ALERT_MESSAGE,
        message: SENSORY_ALERT_MESSAGE,
        url: route,
        target_route: route,
        data: { url: route, target_route: route },
      });

      for (const sub of subscriptions || []) {
        const keys = sub.p256dh
          ? { p256dh: sub.p256dh, auth: sub.auth }
          : (sub.subscription as { keys?: { p256dh: string; auth: string } } | null)?.keys;
        const endpoint =
          sub.endpoint || (sub.subscription as { endpoint?: string } | null)?.endpoint;
        if (!endpoint || !keys?.p256dh || !keys?.auth) continue;
        try {
          await webpush.sendNotification({ endpoint, keys } as never, payload);
          pushed += 1;
        } catch (err: unknown) {
          console.error("[dispatch-sensory-alert] push failed:", err);
        }
      }
    }

    return json({
      success: true,
      alert_id: alertRow.id,
      attendees: userIds.length,
      pushed,
      route,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sensory alert failed";
    console.error("[dispatch-sensory-alert] Error:", error);
    return json({ error: message }, 500);
  }
});
