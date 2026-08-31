// supabase/functions/meilisearch-sync/index.ts
//
// Edge Function: Meilisearch Sync (Issue #2686)
//
// Receives Supabase Database Webhook payloads for INSERT/UPDATE/DELETE
// on the events, clubs, and profiles tables, transforms them into
// Meilisearch document format, and pushes them to the corresponding
// Meilisearch index.
//
// Webhook payload shape (Supabase Database Webhooks):
//   {
//     "type": "INSERT" | "UPDATE" | "DELETE",
//     "table": "events" | "clubs" | "profiles",
//     "schema": "public",
//     "old_record": { ... } | null,
//     "record": { ... } | null
//   }
//
// Environment variables:
//   MEILI_HOST      — e.g. http://localhost:7700 or https://xxx.meilisearch.io
//   MEILI_API_KEY   — the Meilisearch API key (write permission)
//
// Dead-letter queue:
//   If the Meilisearch push fails (network, 5xx, timeout), the
//   document is written to a `meilisearch_dlq` Postgres table for
//   retry by the `meilisearch-dlq-retry` scheduled function. This
//   prevents silent sync failures (issue edge case: "stale search
//   results").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  schema: string;
  old_record: Record<string, unknown> | null;
  record: Record<string, unknown> | null;
}

interface MeiliDocument {
  id: string;
  [key: string]: unknown;
}

interface TransformResult {
  indexName: string;
  documents: MeiliDocument[];
  documentIds: string[];
}

/**
 * Transform a database row into a Meilisearch document.
 * Each entity type has its own transformer that flattens nested
 * fields and selects the searchable attributes.
 */
function transformRecord(table: string, record: Record<string, unknown>): MeiliDocument | null {
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
  deleted_at: record.deleted_at
    ? String(record.deleted_at)
    : null,
  _sync_version: Number(
    record.search_sync_version ?? record.version ?? 1,
  ),
  created_at: String(record.created_at ?? ""),        // Meilisearch doesn't have a separate "boost" field, but
        // we can weight by including the title twice in a
        // `_search_boost` field if needed. For now, the searchable
        // attributes order in the index settings handles ranking.
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

/**
 * Push documents to a Meilisearch index via the REST API.
 * Uses the /indexes/:uid/documents endpoint with the PUT method
 * (which replaces documents by primary key).
 */
async function pushToMeili(
  indexName: string,
  documents: MeiliDocument[],
  primaryKey: string = "id",
): Promise<void> {
  const host = Deno.env.get("MEILI_HOST");
  const apiKey = Deno.env.get("MEILI_API_KEY");

  if (!host || !apiKey) {
    throw new Error("MEILI_HOST or MEILI_API_KEY not set");
  }

  const url = `${host}/indexes/${indexName}/documents?primaryKey=${primaryKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(documents),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Meilisearch push failed for index ${indexName}: ${response.status} ${errorText}`,
    );
  }
}

/**
 * Delete documents from a Meilisearch index by primary key.
 */
async function deleteFromMeili(indexName: string, documentIds: string[]): Promise<void> {
  const host = Deno.env.get("MEILI_HOST");
  const apiKey = Deno.env.get("MEILI_API_KEY");

  if (!host || !apiKey) {
    throw new Error("MEILI_HOST or MEILI_API_KEY not set");
  }

  const url = `${host}/indexes/${indexName}/documents/delete-batch`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(documentIds),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Meilisearch delete failed for index ${indexName}: ${response.status} ${errorText}`,
    );
  }
}
async function isStaleEventUpdate(
  supabase: ReturnType<typeof createClient>,
  payload: WebhookPayload,
): Promise<boolean> {
  if (payload.table !== "events") {
    return false;
  }

  const record = payload.record ?? payload.old_record;
  const recordId = record?.id;

  if (!recordId) {
    return false;
  }

  const incomingVersion = Number(
    record?.search_sync_version ?? record?.version ?? 1,
  );

  const { data: currentEvent, error } = await supabase
    .from("events")
    .select("version, search_sync_version")
    .eq("id", String(recordId))
    .maybeSingle();

  if (error) {
    throw new Error(
      `Unable to verify event search version: ${error.message}`,
    );
  }

  -- If the event was hard-deleted, the DELETE operation is still
  -- valid because there is no newer database row to protect.
  if (!currentEvent) {
    return false;
  }

  const currentVersion = Number(
    currentEvent.search_sync_version ??
      currentEvent.version ??
      1,
  );

  return incomingVersion < currentVersion;
}
/**
 * Write a failed sync to the dead-letter queue table so the
 * meilisearch-dlq-retry scheduled function can pick it up.
 */
async function writeToDlq(
  supabase: ReturnType<typeof createClient>,
  payload: WebhookPayload,
  error: string,
): Promise<void> {
const record = payload.record ?? payload.old_record;

const { error: insertError } = await supabase
  .from("meilisearch_dlq")
  .insert({
    table_name: payload.table,
    record_id: record?.id ?? "unknown",
    operation: payload.type,
    sync_version:
      payload.table === "events"
        ? Number(
            record?.search_sync_version ??
              record?.version ??
              1,
          )
        : null,
    payload: payload as unknown as Record<string, unknown>,
    error_message: error,
    retry_count: 0,
    created_at: new Date().toISOString(),
    next_retry_at: new Date(Date.now() + 60_000).toISOString(),
  });
  if (insertError) {
    console.error("[meilisearch-sync] Failed to write to DLQ:", insertError);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: "Invalid JSON body", detail: String(err) }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Validate payload.
  if (!payload.type || !payload.table) {
    return new Response(
      JSON.stringify({ error: "Invalid webhook payload: missing type or table" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  // Only sync the three entity tables.
  const supportedTables = ["events", "clubs", "profiles"];
  if (!supportedTables.includes(payload.table)) {
    return new Response(
      JSON.stringify({
        success: true,
        skipped: true,
        reason: `Table ${payload.table} not supported`,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const indexName = payload.table; // index name = table name

try {
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  if (await isStaleEventUpdate(supabase, payload)) {
    return new Response(
      JSON.stringify({
        success: true,
        synced: false,
        skipped: true,
        reason: "stale_event_version",
      }),
      {
        headers: {
          ...CORS_HEADERS,
          "Content-Type": "application/json",
        },
      },
    );
  }

  if (payload.type === "DELETE") {
    const recordId = payload.old_record?.id;

    if (recordId) {
      await deleteFromMeili(indexName, [String(recordId)]);
    }
  } else {
    if (!payload.record) {
      return new Response(
        JSON.stringify({
          error: "Missing record for INSERT/UPDATE",
        }),
        {
          status: 400,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const document = transformRecord(
      payload.table,
      payload.record,
    );

    if (!document) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: "No transformer for table",
        }),
        {
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
          },
        },
      );
    }

    await pushToMeili(indexName, [document]);
  }
    return new Response(
      JSON.stringify({
        success: true,
        synced: true,
        table: payload.table,
        operation: payload.type,
        index: indexName,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("[meilisearch-sync] Sync failed, writing to DLQ:", errorMessage);

    // Write to the dead-letter queue for retry.
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (supabaseUrl && serviceRoleKey) {
      const supabase = createClient(supabaseUrl, serviceRoleKey);
      await writeToDlq(supabase, payload, errorMessage);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
        dlq: true,
      }),
      { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }
});
