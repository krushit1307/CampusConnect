// supabase/functions/meilisearch-bulk-sync/index.ts
//
// Edge Function: Meilisearch Bulk Sync (Issue #2686)
//
// Performs the initial bulk synchronization of existing database
// records into Meilisearch. This is the "edge case" from the issue:
// "Handling the initial bulk synchronization of existing database
// records into Meilisearch."
//
// Run once after deploying the meilisearch-sync Edge Function and
// configuring the Meilisearch index settings.
//
// Usage (via Supabase CLI):
//   supabase functions invoke meilisearch-bulk-sync --no-verify-jwt
//
// The function reads all rows from events, clubs, and profiles in
// batches of 1000 and pushes them to the corresponding Meilisearch
// indexes.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 1000;

const TABLES = [
  {
    name: "events",
columns:
  "id, title, description, location, event_date, start_date, end_date, club_id, banner_url, short_id, max_attendees, status, deleted_at, version, search_sync_version, created_at",  },
  {
    name: "clubs",
    columns: "id, name, slug, description, category, member_count, logo_url, created_at",
  },
  {
    name: "profiles",
    columns: "id, first_name, last_name, handle, email, bio, avatar_url",
  },
];

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const meiliHost = Deno.env.get("MEILI_HOST") ?? "";
  const meiliApiKey = Deno.env.get("MEILI_API_KEY") ?? "";

  if (!supabaseUrl || !serviceRoleKey || !meiliHost || !meiliApiKey) {
    return new Response(
      JSON.stringify({
        error:
          "Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MEILI_HOST, MEILI_API_KEY",
      }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const results: Record<string, { total: number; synced: number; errors: string[] }> = {};

  for (const table of TABLES) {
    results[table.name] = { total: 0, synced: 0, errors: [] };
    let offset = 0;

    while (true) {
      const { data, error } = await supabase
        .from(table.name)
        .select(table.columns)
        .range(offset, offset + BATCH_SIZE - 1);

      if (error) {
        results[table.name].errors.push(`Fetch error at offset ${offset}: ${error.message}`);
        break;
      }

      if (!data || data.length === 0) {
        break;
      }

      // Transform and push the batch to Meilisearch.
      const documents = data.map((row) => {
        if (table.name === "events") {
          return {
            id: String(row.id),
            title: String(row.title ?? ""),
            description: String(row.description ?? ""),
            location: String(row.location ?? ""),
            event_date: String(row.event_date ?? ""),
            start_date: String(row.start_date ?? ""),
            end_date: String(row.end_date ?? ""),
            club_id: String(row.club_id ?? ""),
            banner_url: String(row.banner_url ?? ""),
            short_id: String(row.short_id ?? ""),
            max_attendees: Number(row.max_attendees ?? 0),
status: String(row.status ?? "scheduled"),
deleted_at: row.deleted_at
  ? String(row.deleted_at)
  : null,
_sync_version: Number(
  row.search_sync_version ?? row.version ?? 1,
),
created_at: String(row.created_at ?? ""),          };
        }
        if (table.name === "clubs") {
          return {
            id: String(row.id),
            name: String(row.name ?? ""),
            slug: String(row.slug ?? ""),
            description: String(row.description ?? ""),
            category: String(row.category ?? ""),
            member_count: Number(row.member_count ?? 0),
            logo_url: String(row.logo_url ?? ""),
            created_at: String(row.created_at ?? ""),
          };
        }
        // profiles
        return {
          id: String(row.id),
          first_name: String(row.first_name ?? ""),
          last_name: String(row.last_name ?? ""),
          handle: String(row.handle ?? ""),
          email: String(row.email ?? ""),
          bio: String(row.bio ?? ""),
          avatar_url: String(row.avatar_url ?? ""),
          full_name: `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim(),
        };
      });

      try {
        const url = `${meiliHost}/indexes/${table.name}/documents?primaryKey=id`;
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${meiliApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(documents),
        });

        if (!response.ok) {
          const errText = await response.text();
          results[table.name].errors.push(
            `Meili push error at offset ${offset}: ${response.status} ${errText}`,
          );
        } else {
          results[table.name].synced += documents.length;
        }
      } catch (err) {
        results[table.name].errors.push(`Network error at offset ${offset}: ${String(err)}`);
      }

      results[table.name].total += documents.length;
      offset += BATCH_SIZE;

      if (data.length < BATCH_SIZE) {
        break;
      }
    }
  }

  return new Response(
    JSON.stringify({
      success: true,
      results,
    }),
    { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
  );
});
