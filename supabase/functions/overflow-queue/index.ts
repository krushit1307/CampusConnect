// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// @ts-ignore: Deno imports
import { z } from "https://esm.sh/zod@3.24.2";
import { parseJsonBody } from "../_shared/validation.ts";

/**
 * Edge Function: overflow-queue
 *
 * Handles the real-time event capacity overflow queue system.
 *
 * Actions:
 *   - join:           Join the virtual overflow queue for a full event
 *   - checkout:       Process a physical checkout (door scan-out) and notify next in virtual queue
 *   - claim:          Virtual attendee claims a seat at the door within deadline
 *   - status:         Get current overflow queue status for an event
 *   - expire-stale:   Expire stale notification windows (cron-triggered)
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const joinSchema = z.object({
  action: z.literal("join"),
  event_id: z.string().uuid(),
});

const checkoutSchema = z.object({
  action: z.literal("checkout"),
  event_id: z.string().uuid(),
  checked_out_user_id: z.string().uuid(),
});

const claimSchema = z.object({
  action: z.literal("claim"),
  event_id: z.string().uuid(),
});

const statusSchema = z.object({
  action: z.literal("status"),
  event_id: z.string().uuid(),
});

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action;

    // ── JOIN Virtual Queue ──
    if (action === "join") {
      const parsed = await parseJsonBody(joinSchema, req);
      if (!parsed.ok) return parsed.response;
      const { event_id } = parsed.data;

      // Verify event exists and is at capacity
      const { data: event } = await supabase
        .from("events")
        .select("id, max_attendees, overflow_stream_url")
        .eq("id", event_id)
        .single();

      if (!event) {
        return new Response(
          JSON.stringify({ error: "Event not found" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Check current RSVP count
      const { count: rsvpCount } = await supabase
        .from("event_rsvps")
        .select("id", { count: "exact", head: true })
        .eq("event_id", event_id);

      if (event.max_attendees && (rsvpCount ?? 0) < event.max_attendees) {
        return new Response(
          JSON.stringify({
            error: "Event is not at capacity. You can RSVP normally.",
            at_capacity: false,
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Join virtual queue via RPC
      const { data: queueResult, error: queueError } = await supabase.rpc(
        "join_virtual_queue",
        { p_event_id: event_id, p_user_id: user.id }
      );

      if (queueError) {
        throw queueError;
      }

      return new Response(JSON.stringify(queueResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── PHYSICAL CHECKOUT (notify next in virtual queue) ──
    if (action === "checkout") {
      const parsed = await parseJsonBody(checkoutSchema, req);
      if (!parsed.ok) return parsed.response;
      const { event_id, checked_out_user_id } = parsed.data;

      // Process checkout and notify next virtual attendee
      const { data: checkoutResult, error: checkoutError } = await supabase.rpc(
        "process_physical_checkout",
        {
          p_event_id: event_id,
          p_checked_out_user_id: checked_out_user_id,
        }
      );

      if (checkoutError) {
        throw checkoutError;
      }

      // If someone was notified, send push notification
      if (checkoutResult?.notified_user) {
        const { data: userProfile } = await supabase
          .from("profiles")
          .select("first_name, last_name")
          .eq("id", checkoutResult.notified_user)
          .single();

        const displayName = userProfile
          ? `${userProfile.first_name} ${userProfile.last_name}`
          : "A student";

        // Send push notification (fire-and-forget)
        supabase.functions.invoke("send-push-notification", {
          body: {
            user_id: checkoutResult.notified_user,
            title: "A Seat Just Opened Up!",
            message: `A seat just opened up at the event! You have 2 minutes to claim it at the door.`,
            type: "overflow_seat_available",
            url: `/events/${event_id}`,
            priority: "urgent",
          },
        }).catch(() => {}); // Fire and forget
      }

      return new Response(JSON.stringify(checkoutResult), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── CLAIM SEAT (virtual attendee arrives at door) ──
    if (action === "claim") {
      const parsed = await parseJsonBody(claimSchema, req);
      if (!parsed.ok) return parsed.response;
      const { event_id } = parsed.data;

      const { data: claimResult, error: claimError } = await supabase.rpc(
        "claim_seat",
        { p_event_id: event_id, p_user_id: user.id }
      );

      if (claimError) {
        throw claimError;
      }

      return new Response(JSON.stringify(claimResult), {
        status: claimResult?.success ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── GET STATUS ──
    if (action === "status") {
      const parsed = await parseJsonBody(statusSchema, req);
      if (!parsed.ok) return parsed.response;
      const { event_id } = parsed.data;

      const { data: statusResult, error: statusError } = await supabase.rpc(
        "get_overflow_queue_status",
        { p_event_id: event_id }
      );

      if (statusError) {
        throw statusError;
      }

      // Also get the user's position if they're in the queue
      const { data: userPosition } = await supabase
        .from("virtual_attendees")
        .select("queue_position, status, claim_deadline")
        .eq("event_id", event_id)
        .eq("user_id", user.id)
        .single();

      return new Response(
        JSON.stringify({
          ...statusResult,
          user_position: userPosition || null,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // ── EXPIRE STALE (cron) ──
    if (action === "expire-stale") {
      const { data: expiredCount, error: expireError } = await supabase.rpc(
        "expire_stale_virtual_queue"
      );

      if (expireError) {
        throw expireError;
      }

      return new Response(
        JSON.stringify({ expired_count: expiredCount }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Overflow queue error:", error);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
