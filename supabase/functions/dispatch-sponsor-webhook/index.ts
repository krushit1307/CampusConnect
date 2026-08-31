import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { lead_id } = await req.json();

    if (!lead_id) {
      throw new Error("Missing lead_id");
    }

    // 1. Fetch Lead
    const { data: lead, error: leadError } = await supabase
      .from("sponsor_leads")
      .select(
        `
        id, event_id, sponsor_id, user_id, notes, created_at,
        profiles ( id, first_name, last_name, email, major, graduation_year, gpa, bio )
      `,
      )
      .eq("id", lead_id)
      .single();

    if (leadError || !lead) {
      throw new Error("Lead not found");
    }

    // 2. Fetch Webhook Config
    const { data: webhook, error: webhookError } = await supabase
      .from("sponsor_crm_webhooks")
      .select("*")
      .eq("event_id", lead.event_id)
      .eq("sponsor_id", lead.sponsor_id)
      .eq("is_active", true)
      .single();

    if (webhookError || !webhook) {
      // No active webhook, just return silently
      return new Response(JSON.stringify({ message: "No active webhook found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // SSRF Check - Basic validation to prevent internal network requests
    const urlPattern =
      /^https?:\/\/(?!localhost)(?!127\.0\.0\.1)(?!10\.)(?!172\.(1[6-9]|2[0-9]|3[0-1])\.)(?!192\.168\.)[a-zA-Z0-9.-]+(\:[0-9]+)?(\/.*)?$/;
    if (!urlPattern.test(webhook.webhook_url)) {
      await logWebhookResult(
        supabase,
        webhook.id,
        lead.id,
        null,
        0,
        "",
        "Invalid webhook URL (SSRF prevention)",
      );
      throw new Error("Invalid webhook URL.");
    }

    // 3. Construct Payload based on mappings
    const defaultData: Record<string, any> = {
      lead_id: lead.id,
      notes: lead.notes,
      scanned_at: lead.created_at,
      ...lead.profiles,
    };

    const payload: Record<string, any> = {};
    const mappings = webhook.field_mappings || {};

    // If mappings is empty, send the whole default data
    if (Object.keys(mappings).length === 0) {
      Object.assign(payload, defaultData);
    } else {
      for (const [crmField, campusField] of Object.entries(mappings)) {
        payload[crmField] = defaultData[campusField as string] ?? null;
      }
    }

    // 4. Dispatch Request
    let responseStatus = 0;
    let responseBody = "";
    let errorMessage = null;

    try {
      // Setup timeout via AbortController
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const res = await fetch(webhook.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      responseStatus = res.status;
      responseBody = await res.text();

      if (!res.ok) {
        errorMessage = `HTTP Error: ${res.status}`;
      }
    } catch (err: any) {
      if (err.name === "AbortError") {
        errorMessage = "Request timed out after 10s";
      } else {
        errorMessage = err.message || "Network Error";
      }
    }

    // 5. Log Result
    await logWebhookResult(
      supabase,
      webhook.id,
      lead.id,
      payload,
      responseStatus,
      responseBody,
      errorMessage,
    );

    return new Response(JSON.stringify({ success: !errorMessage, responseStatus }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

async function logWebhookResult(
  supabase: any,
  webhook_id: string,
  lead_id: string,
  payload: any,
  response_status: number,
  response_body: string,
  error_message: string | null,
) {
  await supabase.from("sponsor_crm_webhook_logs").insert({
    webhook_id,
    lead_id,
    payload,
    response_status,
    response_body: response_body.substring(0, 1000), // truncate if too long
    error_message,
  });
}
