// supabase/functions/meilisearch-dlq-retry/index.ts
//
// Edge Function: Meilisearch DLQ Retry (Issue #2686 edge case)
//
// Scheduled function that retries failed Meilisearch syncs from the
// dead-letter queue. The issue calls out: "Ensuring the webhook
// synchronization does not fail silently, leading to stale search
// results. Implement a retry queue or dead-letter queue."
//
// Scheduled via Supabase Cron (see migration
// 20260816000002_meilisearch_dlq.sql). Runs every 5 minutes.
//
// Retry policy:
//   - Max retries: 10
//   - Exponential backoff: 1min, 2min, 4min, 8min, 16min, 32min, ...
//   - After max retries, the DLQ row is marked `exhausted=true` for
//     manual inspection.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MAX_RETRIES = 10;
const BATCH_SIZE = 50;

interface DlqRow {
  id: string;
  table_name: string;
  record_id: string;
  operation: string;
  sync_version: number | null;
  payload: {    type: string;
    table: string;
    record: Record<string, unknown> | null;
    old_record: Record<string, unknown> | null;
  };
  error_message: string;
  retry_count: number;
  next_retry_at: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const meiliHost = Deno.env.get("MEILI_HOST") ?? "";
  const meiliApiKey = Deno.env.get("MEILI_API_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !meiliHost || !meiliApiKey) {
    return new Response(JSON.stringify({ error: "Missing env vars" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Fetch up to BATCH_SIZE DLQ rows whose next_retry_at has passed.
  const { data: dlqRows, error: fetchError } = await supabase
    .from("meilisearch_dlq")
    .select("*")
    .eq("exhausted", false)
    .lte("next_retry_at", new Date().toISOString())
    .order("next_retry_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    return new Response(
      JSON.stringify({ error: "Failed to fetch DLQ rows", detail: fetchError.message }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  if (!dlqRows || dlqRows.length === 0) {
    return new Response(
      JSON.stringify({ success: true, retried: 0, message: "No pending DLQ rows" }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  let succeeded = 0;
  let failed = 0;
  let exhausted = 0;

  for (const row of dlqRows as DlqRow[]) {
const payload = row.payload;
let success = false;

if (row.table_name === "events" && row.sync_version !== null) {
  const { data: currentEvent, error: currentEventError } =
    await supabase
      .from("events")
      .select("version, search_sync_version")
      .eq("id", row.record_id)
      .maybeSingle();

  if (currentEventError) {
    throw new Error(
      `Unable to verify current event version: ${currentEventError.message}`,
    );
  }

  if (currentEvent) {
    const currentVersion = Number(
      currentEvent.search_sync_version ??
        currentEvent.version ??
        1,
    );

    if (row.sync_version < currentVersion) {
      await supabase
        .from("meilisearch_dlq")
        .delete()
        .eq("id", row.id);

      continue;
    }
  }
}
    try {
      if (payload.type === "DELETE") {
        const recordId = payload.old_record?.id;
        if (recordId) {
          const url = `${meiliHost}/indexes/${row.table_name}/documents/delete-batch`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${meiliApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([String(recordId)]),
          });
          success = response.ok;
        }
      } else if (payload.record) {
        const document = transformRecord(row.table_name, payload.record);
        if (document) {
          const url = `${meiliHost}/indexes/${row.table_name}/documents?primaryKey=id`;
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${meiliApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify([document]),
          });
          success = response.ok;
        }
      }

      if (success) {
        // Delete the DLQ row on success.
        await supabase.from("meilisearch_dlq").delete().eq("id", row.id);
        succeeded++;
      } else {
        throw new Error("Meilisearch push returned non-ok status");
      }
    } catch (err) {
      failed++;
      const errorMessage = err instanceof Error ? err.message : String(err);
      const newRetryCount = row.retry_count + 1;

      if (newRetryCount >= MAX_RETRIES) {
        // Mark as exhausted for manual inspection.
        await supabase
          .from("meilisearch_dlq")
          .update({
            retry_count: newRetryCount,
            error_message: errorMessage,
            exhausted: true,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
        exhausted++;
      } else {
        // Exponential backoff: 2^retry_count minutes.
        const backoffMs = Math.pow(2, newRetryCount) * 60_000;
        const nextRetry = new Date(Date.now() + backoffMs).toISOString();
        await supabase
          .from("meilisearch_dlq")
          .update({
            retry_count: newRetryCount,
            error_message: errorMessage,
            next_retry_at: nextRetry,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      processed: dlqRows.length,
      succeeded,
      failed,
      exhausted,
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});

function transformRecord(
  table: string,
  record: Record<string, unknown>,
): Record<string, unknown> | null {
  switch (table) {
    case "events":
      return {
        id: String(record.id),
        title: String(record.title ?? ""),
        description: String(record.description ?? ""),
        location: String(record.location ?? ""),
        event_date: String(record.event_date ?? ""),
        start_date: String(record.start_date ?? ""),
        end_date: String(record.end_date ?? ""),
        club_id: String(record.club_id ?? ""),
        banner_url: String(record.banner_url ?? ""),
        short_id: String(record.short_id ?? ""),
        max_attendees: Number(record.max_attendees ?? 0),
        status: String(record.status ?? "scheduled"),
        created_at: String(record.created_at ?? ""),
      };
    case "clubs":
      return {
        id: String(record.id),
        name: String(record.name ?? ""),
        slug: String(record.slug ?? ""),
        description: String(record.description ?? ""),
        category: String(record.category ?? ""),
        member_count: Number(record.member_count ?? 0),
        logo_url: String(record.logo_url ?? ""),
        created_at: String(record.created_at ?? ""),
      };
    case "profiles":
      return {
        id: String(record.id),
        first_name: String(record.first_name ?? ""),
        last_name: String(record.last_name ?? ""),
        handle: String(record.handle ?? ""),
        email: String(record.email ?? ""),
        bio: String(record.bio ?? ""),
        avatar_url: String(record.avatar_url ?? ""),
        full_name: `${record.first_name ?? ""} ${record.last_name ?? ""}`.trim(),
      };
    default:
      return null;
  }
}
