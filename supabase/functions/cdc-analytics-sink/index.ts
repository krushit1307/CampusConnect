import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { redactPII, sanitizeRow } from "./pii.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  const webhookSecret = Deno.env.get("CDC_WEBHOOK_SECRET");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Accept the configured webhook secret or the service role key.
  const isAuthorized =
    (webhookSecret && authHeader === `Bearer ${webhookSecret}`) ||
    (serviceKey && authHeader === `Bearer ${serviceKey}`);

  if (!isAuthorized) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const payload = await req.json();

    const operation = String(payload.type ?? payload.eventType ?? "").toUpperCase();
    const table = payload.table ?? req.headers.get("x-supabase-realtime-table");
    const schema = payload.schema ?? req.headers.get("x-supabase-realtime-schema") ?? "public";

    if (!["INSERT", "UPDATE", "DELETE"].includes(operation) || !table) {
      return json({ error: "Invalid or missing type/table in payload" }, 400);
    }

    // commit_timestamp (from the replication slot) is the source of truth for
    // chronological ordering, even when webhooks arrive out of order.
    const commitTimestamp =
      req.headers.get("x-supabase-realtime-commit") ?? payload.commit_timestamp;

    if (!commitTimestamp) {
      return json({ error: "Missing commit_timestamp header or field" }, 400);
    }

    const parsedCommit = new Date(commitTimestamp);
    if (Number.isNaN(parsedCommit.getTime())) {
      return json({ error: `Invalid commit_timestamp: ${commitTimestamp}` }, 400);
    }

    const newRecord = sanitizeRow(payload.record ?? payload.new);
    const oldRecord = sanitizeRow(payload.old_record ?? payload.old);
    const recordId = String(
      (payload.record ?? payload.new ?? {})?.id ??
        (payload.old_record ?? payload.old ?? {})?.id ??
        "",
    );

    // Store the full payload too, but PII-stripped, for downstream warehouse ETL.
    const sanitizedPayload = redactPII(payload) as Record<string, unknown>;

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    if (!supabaseUrl || !serviceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY configuration.");
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { error } = await supabase.from("analytics_events").upsert(
      {
        commit_timestamp: parsedCommit.toISOString(),
        table_name: `${schema}.${table}`,
        operation,
        record_id: recordId || null,
        payload: sanitizedPayload,
        new_record: newRecord,
        old_record: oldRecord,
      },
      {
        onConflict: "commit_timestamp,table_name,operation,record_id",
        ignoreDuplicates: true,
      },
    );

    if (error) {
      throw error;
    }

    console.log(
      `[cdc-analytics-sink] Stored ${operation} on ${schema}.${table} at ${parsedCommit.toISOString()}`,
    );

    return json({ success: true, operation, table: `${schema}.${table}` });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[cdc-analytics-sink] Error:", errorMsg);
    return json({ error: errorMsg }, 500);
  }
});
