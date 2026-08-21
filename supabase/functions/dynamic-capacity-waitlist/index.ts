import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { create as createJwt, verify as verifyJwt } from "https://deno.land/x/djwt@v2.8/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const jwtSecret = Deno.env.get("JWT_SECRET") || "fallback-secret";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(jwtSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );

  const url = new URL(req.url);

  // 1. Handle Approval Link Click
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) {
      return new Response("Missing token", { status: 400 });
    }

    let payload;
    try {
      payload = await verifyJwt(token, cryptoKey);
    } catch (err) {
      return new Response("Invalid or expired token", { status: 400 });
    }

    const eventId = payload.eventId as string;
    const newCapacity = payload.newCapacity as number;

    const { data, error } = await supabase.rpc("increase_capacity_and_promote", {
      p_event_id: eventId,
      p_new_capacity: newCapacity
    });

    if (error) {
      console.error("[dynamic-capacity-waitlist] RPC error:", error);
      return new Response("Failed to increase capacity", { status: 500 });
    }

    if (!data.success) {
      return new Response(data.error || "Failed", { status: 400 });
    }

    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Capacity Increased - CampusConnect</title>
        <style>
          body { font-family: monospace; text-align: center; padding: 50px; background: #f0fdf4; color: #166534; }
          .card { border: 4px solid #000; background: #fff; padding: 40px; display: inline-block; box-shadow: 4px 4px 0px 0px #000; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✓ Capacity Increased</h1>
          <p>The event capacity has been updated to <strong>${newCapacity}</strong>.</p>
          <p><strong>${data.promoted_count}</strong> waitlisted users were promoted and notified.</p>
        </div>
      </body>
      </html>
      `,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // 2. Handle Cron Job Execution (POST)
  if (req.method === "POST") {
    try {
      const body = await req.json().catch(() => ({}));
      if (body.action !== "detect") {
        return new Response("Invalid action", { status: 400 });
      }

      // Query for events with high waitlist and capacity < venue capacity
      const { data: events, error: fetchError } = await supabase
        .from("events")
        .select(`
          id, 
          title, 
          max_attendees, 
          capacity_prompt_ignored_at, 
          club_id,
          clubs(name, created_by),
          venues(capacity)
        `)
        .neq("status", "cancelled")
        .gt("event_date", new Date().toISOString());

      if (fetchError || !events) {
        console.error("[dynamic-capacity-waitlist] Fetch error:", fetchError);
        return new Response("Database error", { status: 500 });
      }

      let emailsSent = 0;

      for (const event of events) {
        // Must have venue capacity
        if (!event.venues || !event.venues.capacity) continue;
        if (event.capacity_prompt_ignored_at !== null) continue;
        if (event.max_attendees >= event.venues.capacity) continue;

        // Get waitlist count
        const { count, error: countError } = await supabase
          .from("event_rsvps")
          .select("*", { count: "exact", head: true })
          .eq("event_id", event.id)
          .eq("status", "waitlisted");

        if (countError || count === null || count <= 10) continue;

        const clubPresidentId = event.clubs?.created_by;
        if (!clubPresidentId) continue;

        const { data: president } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", clubPresidentId)
          .single();

        if (!president?.email) continue;

        // Generate approval token
        const newCapacity = event.venues.capacity;
        const token = await createJwt(
          { alg: "HS256", typ: "JWT" },
          { eventId: event.id, newCapacity, exp: Math.floor(Date.now() / 1000) + 48 * 3600 }, // 48 hours
          cryptoKey
        );

        const approvalLink = \`\${supabaseUrl}/functions/v1/dynamic-capacity-waitlist?token=\${token}\`;

        const emailHtml = \`
          <p>Hi \${president.full_name || 'Organizer'},</p>
          <p>Your event "<strong>\${event.title}</strong>" currently has <strong>\${count}</strong> people on the waitlist!</p>
          <p>The venue has a maximum capacity of <strong>\${newCapacity}</strong> (currently set to \${event.max_attendees}).</p>
          <p>Would you like to increase your event capacity to let more people in?</p>
          <p><strong>Note:</strong> Increasing capacity does not automatically increase your catering order.</p>
          <p><a href="\${approvalLink}" style="padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">Increase Capacity to \${newCapacity}</a></p>
        \`;

        const resendApiKey = Deno.env.get("RESEND_API_KEY");
        const fromAddress = Deno.env.get("MAIL_FROM") ?? "CampusConnect <no-reply@campusconnect.app>";

        if (resendApiKey) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: \`Bearer \${resendApiKey}\`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromAddress,
              to: [president.email],
              subject: \`Action Required: Increase capacity for \${event.title}?\`,
              html: emailHtml,
            }),
          });
        } else {
          console.log("[dynamic-capacity-waitlist] Resend skipped. Email:", emailHtml);
        }

        emailsSent++;

        // Mark prompt as seen (to avoid spamming next hour)
        await supabase
          .from("events")
          .update({ capacity_prompt_ignored_at: new Date().toISOString() })
          .eq("id", event.id);
      }

      return new Response(JSON.stringify({ success: true, processed: emailsSent }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err: any) {
      return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
  }

  return new Response("Method Not Allowed", { status: 405 });
});
