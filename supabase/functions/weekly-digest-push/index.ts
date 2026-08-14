import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const token = authHeader.replace("Bearer ", "");

    // Allow service key OR cron secret
    const cronSecret = Deno.env.get("CRON_SECRET");
    if (token !== supabaseServiceKey && token !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized: Invalid service token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Get eligible users for this hour's timezone digest
    const { data: users, error: userError } = await supabase.rpc("get_push_digest_subscribers");
    if (userError) throw userError;

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({ message: "No eligible users for push digest this hour." }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const results = [];

    // 2. Process each user
    for (const user of users) {
      try {
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);

        // Fetch user's RSVPs for next 7 days
        const { data: rsvps, error: rsvpError } = await supabase
          .from("event_rsvps")
          .select("events!inner(id, title, event_date, location, event_tags)")
          .eq("user_id", user.id)
          .gte("events.event_date", now.toISOString())
          .lt("events.event_date", nextWeek.toISOString())
          .order("events.event_date", { ascending: true });

        if (rsvpError) throw rsvpError;

        // Fetch 1 recommendation
        const rsvpEventIds = rsvps && rsvps.length > 0 ? rsvps.map((r: any) => r.events.id) : [];

        let recommendationQuery = supabase
          .from("events")
          .select("id, title")
          .gte("event_date", now.toISOString())
          .lt("event_date", nextWeek.toISOString());

        if (rsvpEventIds.length > 0) {
          // Skip events they are already going to
          // Use a filter string or simply fetch and filter since Edge function env supports it
          // Since we can't easily `not in` an array via JS client sometimes, we use `not.in`
          recommendationQuery = recommendationQuery.not("id", "in", `(${rsvpEventIds.join(",")})`);
        }

        // Very simple fallback recommendation: just get the soonest upcoming event they haven't RSVP'd to.
        const { data: recommended } = await recommendationQuery
          .order("event_date", { ascending: true })
          .limit(1)
          .maybeSingle();

        // 3. Construct Message
        const rsvpCount = rsvps ? rsvps.length : 0;
        const title = "Your Week Ahead";
        let body = "";

        if (rsvpCount === 0) {
          if (recommended) {
            body = `Quiet week? 🤫 Check out ${recommended.title} and other events this week!`;
          } else {
            body = `Quiet week? 🤫 Check out what's happening on CampusConnect this week!`;
          }
        } else if (rsvpCount === 1) {
          const firstEvent = (rsvps as any)[0].events;
          body = `You're heading to ${firstEvent.title}! 🚀 Tap to see what else is happening.`;
        } else {
          const firstEvent = (rsvps as any)[0].events;
          body = `Busy week ahead! 📅 You have ${rsvpCount} events, starting with ${firstEvent.title}.`;
        }

        // 4. Dispatch Push Notification via FCM
        const fcmServerKey = Deno.env.get("FCM_SERVER_KEY");
        if (fcmServerKey) {
          const fcmRes = await fetch("https://fcm.googleapis.com/fcm/send", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `key=${fcmServerKey}`,
            },
            body: JSON.stringify({
              to: user.fcm_token,
              notification: {
                title,
                body,
              },
              data: {
                url: "/my-schedule", // Deep link handling
              },
            }),
          });
          if (!fcmRes.ok) {
            throw new Error(`FCM error: ${await fcmRes.text()}`);
          }
        } else {
          console.log(`[Mock FCM] To: ${user.fcm_token} | Title: ${title} | Body: ${body}`);
        }

        // 5. Update last_weekly_digest_sent_at to ensure Idempotency (prevent duplicates if cron retries)
        await supabase
          .from("profiles")
          .update({ last_weekly_digest_sent_at: now.toISOString() })
          .eq("id", user.id);

        results.push({ user_id: user.id, status: "success" });
      } catch (err: any) {
        console.error(`Error processing user ${user.id}:`, err);
        // Continue processing others despite failure
        results.push({ user_id: user.id, status: "error", error: err.message });
      }
    }

    return new Response(JSON.stringify({ message: "Processed users", results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
