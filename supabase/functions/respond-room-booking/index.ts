import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceKey) {
    return new Response("Missing database configuration", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const action = url.searchParams.get("action");

  if (!token || !action) {
    return new Response("Missing token or action parameters", { status: 400 });
  }

  // 1. Fetch booking request
  const { data: request, error: reqErr } = await supabase
    .from("room_booking_requests")
    .select("*, events(*)")
    .eq("token", token)
    .maybeSingle();

  if (reqErr || !request) {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error - CampusConnect</title>
        <style>
          body { font-family: monospace; text-align: center; padding: 50px; background: #fff1f2; color: #9f1239; }
          .card { border: 4px solid #000; background: #fff; padding: 40px; display: inline-block; box-shadow: 4px 4px 0px 0px #000; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✗ Request Not Found</h1>
          <p>Invalid or expired room booking request token.</p>
        </div>
      </body>
      </html>
      `,
      { status: 404, headers: { "Content-Type": "text/html" } }
    );
  }

  const event = request.events;

  // 2. Check if already processed
  if (request.status !== "pending") {
    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Processed - CampusConnect</title>
        <style>
          body { font-family: monospace; text-align: center; padding: 50px; background: #fef3c7; color: #92400e; }
          .card { border: 4px solid #000; background: #fff; padding: 40px; display: inline-block; box-shadow: 4px 4px 0px 0px #000; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>ℹ Request Already Processed</h1>
          <p>This room booking request has already been marked as <strong>${request.status.toUpperCase()}</strong>.</p>
        </div>
      </body>
      </html>
      `,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  // 3. Process action
  if (action === "approve") {
    // Update request
    const { error: requestUpdateError } = await supabase
      .from("room_booking_requests")
      .update({
        status: "approved",
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestUpdateError) {
      return new Response("Failed to approve request", { status: 500 });
    }

    // Publish event
    const { error: eventUpdateError } = await supabase
      .from("events")
      .update({ status: "published" })
      .eq("id", event.id);

    if (eventUpdateError) {
      return new Response("Failed to publish event", { status: 500 });
    }

    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Approved - CampusConnect</title>
        <style>
          body { font-family: monospace; text-align: center; padding: 50px; background: #f0fdf4; color: #166534; }
          .card { border: 4px solid #000; background: #fff; padding: 40px; display: inline-block; box-shadow: 4px 4px 0px 0px #000; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✓ Booking Approved</h1>
          <p>The room booking has been approved. The event "<strong>${event.title}</strong>" is now officially published on CampusConnect.</p>
        </div>
      </body>
      </html>
      `,
      { headers: { "Content-Type": "text/html" } }
    );
  } else if (action === "reject") {
    // Update request
    const { error: requestUpdateError } = await supabase
      .from("room_booking_requests")
      .update({
        status: "rejected",
        responded_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    if (requestUpdateError) {
      return new Response("Failed to reject request", { status: 500 });
    }

    // Cancel event
    const { error: eventUpdateError } = await supabase
      .from("events")
      .update({ status: "canceled" })
      .eq("id", event.id);

    if (eventUpdateError) {
      return new Response("Failed to cancel event", { status: 500 });
    }

    return new Response(
      `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Rejected - CampusConnect</title>
        <style>
          body { font-family: monospace; text-align: center; padding: 50px; background: #fef2f2; color: #991b1b; }
          .card { border: 4px solid #000; background: #fff; padding: 40px; display: inline-block; box-shadow: 4px 4px 0px 0px #000; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>✗ Booking Rejected</h1>
          <p>The room booking was rejected. Organizers have been notified, and the event "<strong>${event.title}</strong>" status has been set to canceled.</p>
        </div>
      </body>
      </html>
      `,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  return new Response("Invalid action parameter", { status: 400 });
});
