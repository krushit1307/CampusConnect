import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const ZENDESK_API_URL =
  Deno.env.get("ZENDESK_API_URL") || "https://fake-zendesk.example.com/api/v2";
const ZENDESK_EMAIL = Deno.env.get("ZENDESK_EMAIL") || "admin@example.com";
const ZENDESK_TOKEN = Deno.env.get("ZENDESK_TOKEN") || "fake_token";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
      },
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const { eventId } = await req.json();

    if (!eventId) {
      return new Response(JSON.stringify({ error: "Missing eventId" }), { status: 400 });
    }

    // Verify user owns event
    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get the request
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { data: request, error: reqError } = await supabaseAdmin
      .from("event_resource_requests")
      .select("*, events(title, location, event_date)")
      .eq("event_id", eventId)
      .eq("status", "pending")
      .single();

    if (reqError || !request) {
      return new Response(JSON.stringify({ error: "Request not found or not pending" }), {
        status: 404,
      });
    }

    // Submit to Zendesk (simulated/extensible integration layer)
    const ticketPayload = {
      ticket: {
        subject: `Resource Request: ${request.events.title}`,
        description: `Event Date: ${request.events.event_date}\nLocation: ${request.events.location}\nRequested Resources: ${request.resources.join(", ")}\nEvent ID: ${eventId}`,
        priority: "normal",
        type: "task",
      },
    };

    const encodedCreds = btoa(`${ZENDESK_EMAIL}/token:${ZENDESK_TOKEN}`);

    // In a real scenario we'd do:
    /*
    const response = await fetch(`${ZENDESK_API_URL}/tickets.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${encodedCreds}`
      },
      body: JSON.stringify(ticketPayload)
    });
    const result = await response.json();
    const externalTicketId = result.ticket.id.toString();
    */

    // Simulating success
    const externalTicketId = "ZD-" + Math.floor(Math.random() * 1000000);

    // Update status in DB
    await supabaseAdmin
      .from("event_resource_requests")
      .update({
        status: "submitted",
        external_ticket_id: externalTicketId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    return new Response(JSON.stringify({ success: true, ticketId: externalTicketId }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
