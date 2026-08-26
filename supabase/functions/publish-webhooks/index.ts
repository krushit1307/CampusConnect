import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import { buildPayload } from "./payload.ts";
import { publishWebhook } from "./publisher.ts";
import { Webhook } from "./types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  try {
    const { type, record } = await req.json();

    if (!type || !record || !record.club_id) {
      return new Response("Invalid request payload", { status: 400 });
    }

    // 1. Fetch active webhooks subscribed to this event
    const { data: webhooks, error } = await supabase
      .from("webhooks")
      .select("*")
      .eq("club_id", record.club_id)
      .eq("is_active", true)
      .contains("events_subscribed", [type]);

    if (error) {
      console.error("Error fetching webhooks:", error);
      return new Response("Internal Server Error", { status: 500 });
    }

    if (!webhooks || webhooks.length === 0) {
      return new Response("No webhooks to process", { status: 200 });
    }

    // 2. Build standard payload
    const payloadObject = buildPayload(type, record.club_id, record);
    const payloadString = JSON.stringify(payloadObject);

    // 3. Process webhooks in parallel but independently (don't fail all if one fails)
    const publishPromises = webhooks.map((webhook: Webhook) =>
      publishWebhook(supabase, webhook, payloadString),
    );

    await Promise.allSettled(publishPromises);

    return new Response("Webhooks processed successfully", { status: 200 });
  } catch (error) {
    console.error("Unhandled error processing webhooks:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
});
