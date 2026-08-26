// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore: Deno imports
import webpush from "https://esm.sh/web-push@3.6.0";
// @ts-ignore: Deno imports
import { z } from "https://esm.sh/zod@3.24.2";
import { parseJsonBody } from "../_shared/validation.ts";
import { outboundCommunicationLimiter } from "../_shared/rateLimiter.ts";

declare const Deno: any;

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

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@campusconnect.app";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(JSON.stringify({ error: "Server missing VAPID keys" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const body = await req.json().catch(() => ({}));
    const { user_id, title, message, url, sender_name, type, payload: customPayload } = body;

    let targetSubscriptions: any[] = [];

    // Determine context: Broadcast vs Direct Message
    if (user_id) {
      const priority = body.priority || "normal";
      const isEmergency =
        priority === "emergency" || priority === "urgent" || type === "emergency_broadcast";

      // Check DND Quiet Hours preferences if not an emergency
      if (!isEmergency) {
        const { data: prefs } = await supabase
          .from("user_preferences")
          .select("dnd_start_time, dnd_end_time, quiet_hours_start, quiet_hours_end, timezone")
          .eq("user_id", user_id)
          .maybeSingle();

        const dndStart = prefs?.dnd_start_time || prefs?.quiet_hours_start;
        const dndEnd = prefs?.dnd_end_time || prefs?.quiet_hours_end;
        const userTz = prefs?.timezone || "UTC";

        if (dndStart && dndEnd) {
          const now = new Date();
          const startParts = dndStart.split(":");
          const endParts = dndEnd.split(":");
          const startMin = parseInt(startParts[0], 10) * 60 + parseInt(startParts[1] || "0", 10);
          const endMin = parseInt(endParts[0], 10) * 60 + parseInt(endParts[1] || "0", 10);

          let currentMin = now.getUTCHours() * 60 + now.getUTCMinutes();
          try {
            const fmt = new Intl.DateTimeFormat("en-US", {
              timeZone: userTz,
              hour: "numeric",
              minute: "numeric",
              hour12: false,
            });
            const parts = fmt.formatToParts(now);
            let h = 0,
              m = 0;
            for (const p of parts) {
              if (p.type === "hour") h = parseInt(p.value, 10) % 24;
              if (p.type === "minute") m = parseInt(p.value, 10);
            }
            currentMin = h * 60 + m;
          } catch {
            // Keep UTC fallback
          }

          const inDND =
            startMin <= endMin
              ? currentMin >= startMin && currentMin < endMin
              : currentMin >= startMin || currentMin < endMin;

          if (inDND) {
            // Queue in delayed_notifications table for execution at dnd_end_time
            await supabase.from("delayed_notifications").insert({
              user_id,
              type: "push",
              payload: body,
            });

            return new Response(
              JSON.stringify({
                success: true,
                delayed: true,
                message: `User is in Quiet Hours DND (${dndStart} - ${dndEnd}). Notification queued for batch delivery.`,
              }),
              { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
            );
          }
        }
      }

      // Direct message push
      const { data: subscriptions, error: fetchError } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth")
        .eq("user_id", user_id);

      if (fetchError || !subscriptions) {
        return new Response(JSON.stringify({ error: "Failed to fetch user subscriptions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetSubscriptions = subscriptions;
    } else {
      // Broadcast - requires admin
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const jwt = authHeader.replace("Bearer ", "");
      const { data: userData, error: userError } = await supabase.auth.getUser(jwt);
      if (userError || !userData.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userData.user.id)
        .single();
      if (profileError || profile?.role !== "admin") {
        return new Response(JSON.stringify({ error: "Forbidden: Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: subscriptions, error: subError } = await supabase
        .from("push_subscriptions")
        .select("endpoint, p256dh, auth");

      if (subError || !subscriptions) {
        return new Response(JSON.stringify({ error: "Failed to fetch subscriptions" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetSubscriptions = subscriptions;
    }

    if (targetSubscriptions.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No subscriptions found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const pushPayload = JSON.stringify({
      title: title || (sender_name ? `New message from ${sender_name}` : "CampusConnect"),
      body: message,
      type: type,
      payload: customPayload,
      icon: "/favicon.png",
      data: { url: url || "/messages" },
      tag: user_id ? "campusconnect-dm" : "campusconnect-broadcast",
    });

    const sendPromises = targetSubscriptions.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth },
      };

      try {
        await webpush.sendNotification(pushSubscription as any, pushPayload);
        return { success: true, endpoint: sub.endpoint };
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        return { success: false, endpoint: sub.endpoint, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter((r: any) => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent to ${successCount} of ${targetSubscriptions.length} devices`,
        details: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error: any) {
    console.error("Internal server error in send-push-notification:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
