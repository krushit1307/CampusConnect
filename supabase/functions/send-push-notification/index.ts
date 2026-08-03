<<<<<<< HEAD
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import webpush from "npm:web-push@3.6.7";

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  // Handle CORS Preflight
=======
/**
 * Supabase Edge Function: Send Push Notification
 *
 * Triggered by the backend (e.g., via Database Webhooks or RPC) when a new direct message is created.
 * It fetches the recipient's push subscriptions and sends the web push payload to each endpoint.
 */

// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore: Deno imports
import webpush from "https://esm.sh/web-push@3.6.0";
// @ts-ignore: Deno imports
import { z } from "https://esm.sh/zod@3.24.2";
import { parseJsonBody } from "../_shared/validation.ts";

declare const Deno: any;

// Expecting payload: { user_id: string, message: string, sender_name?: string }
const sendPushSchema = z
  .object({
    user_id: z.string().min(1, "user_id is required"),
    message: z.string().min(1, "message is required").max(2000),
    sender_name: z.string().max(100).optional(),
  })
  .strict();

// Initialize Supabase client with service role key for admin access
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Configure web-push with VAPID details
const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY")!;
const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY")!;

webpush.setVapidDetails("mailto:admin@campusconnect.com", vapidPublicKey, vapidPrivateKey);

serve(async (req: Request) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

>>>>>>> upstream/main
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
<<<<<<< HEAD
    const body = await req.json().catch(() => ({}));
    const { title, message, url } = body;

    if (!title || !message) {
      return new Response(JSON.stringify({ error: "Missing title or message" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    // Authorize admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    
    // Verify JWT
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
    const jwt = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(jwt);

    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if the user is an admin (assuming we have a profiles table with role)
    // Here we query profiles for role 'admin'
    const { data: profile, error: profileError } = await supabaseClient
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

    // Setup web-push
    const vapidPublic = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
    const vapidPrivate = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";
    const vapidSubject = Deno.env.get("VAPID_SUBJECT") ?? "mailto:admin@campusconnect.app";

    if (!vapidPublic || !vapidPrivate) {
      return new Response(JSON.stringify({ error: "Server missing VAPID keys" }), {
=======
    const parsed = await parseJsonBody(sendPushSchema, req);
    if (!parsed.ok) return parsed.response;
    const { user_id, message, sender_name } = parsed.data;

    // 1. Fetch all push subscriptions for the target user
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", user_id);

    if (fetchError || !subscriptions) {
      console.error("Error fetching subscriptions:", fetchError);
      return new Response(JSON.stringify({ error: "Failed to fetch user subscriptions" }), {
>>>>>>> upstream/main
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

<<<<<<< HEAD
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);

    // Fetch all push subscriptions
    const { data: subscriptions, error: subError } = await supabaseClient
      .from("push_subscriptions")
      .select("*");

    if (subError) {
      throw new Error(`Failed to fetch subscriptions: ${subError.message}`);
    }

    const payload = JSON.stringify({
      title,
      message,
      url: url || "/dashboard",
    });

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        try {
          await webpush.sendNotification(pushSubscription, payload);
          return { status: "success", endpoint: sub.endpoint };
        } catch (error: any) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription has expired or is no longer valid
            await supabaseClient
              .from("push_subscriptions")
              .delete()
              .eq("endpoint", sub.endpoint);
            return { status: "removed", endpoint: sub.endpoint };
          }
          console.error("Push Error for", sub.endpoint, error);
          return { status: "error", endpoint: sub.endpoint, error: error.message };
        }
      })
    );

    const successCount = results.filter((r) => r.status === "fulfilled" && r.value.status === "success").length;
    const removedCount = results.filter((r) => r.status === "fulfilled" && r.value.status === "removed").length;
    const errorCount = results.filter((r) => r.status === "fulfilled" && r.value.status === "error").length;

    return new Response(
      JSON.stringify({
        message: "Push notifications processed",
        successCount,
        removedCount,
        errorCount,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("send-push-notification error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
=======
    if (subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No subscriptions found for user" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Construct the push payload
    const payload = JSON.stringify({
      title: `New message from ${sender_name || "CampusConnect"}`,
      body: message,
      icon: "/icon-192x192.png",
      data: { url: "/messages" },
      tag: "campusconnect-dm",
    });

    // 3. Send push notification to all active endpoints
    const sendPromises = subscriptions.map(async (sub: any) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth,
        },
      };

      try {
        await webpush.sendNotification(pushSubscription as any, payload);
        return { success: true, endpoint: sub.endpoint };
      } catch (err: any) {
        // If the subscription is expired or invalid (e.g., 410 Gone), we should ideally clean it up
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
        }
        console.error(`Failed to send push to ${sub.endpoint}:`, err);
        return { success: false, endpoint: sub.endpoint, error: err.message };
      }
    });

    const results = await Promise.all(sendPromises);
    const successCount = results.filter((r: any) => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sent to ${successCount} of ${subscriptions.length} devices`,
        details: results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Internal server error in send-push-notification:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
>>>>>>> upstream/main
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
