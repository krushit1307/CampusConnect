// supabase/functions/meilisearch-search/index.ts
//
// Edge Function: Meilisearch Search Proxy (Issue #2686)
//
// Proxies search requests from the frontend to Meilisearch's
// /multi-search endpoint. This keeps the Meilisearch API key on
// the server side (the browser only sees the Supabase anon key).
//
// Request body:
//   { "query": "tech symposium", "limitPerIndex": 5 }
//
// Response:
//   {
//     "events": [{ "id": "...", "title": "...", ... }],
//     "clubs": [{ "id": "...", "name": "...", ... }],
//     "profiles": [{ "id": "...", "first_name": "...", ... }],
//     "totalHits": 12,
//     "processingTimeMs": 3
//   }

import { rateLimiter } from "../shared/rateLimiter.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchRequest {
  query: string;
  limitPerIndex?: number;
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

  const limited = await rateLimiter(req, "meilisearch-search", 60, 60);
  if (limited) return limited;

  const meiliHost = Deno.env.get("MEILI_HOST");
  const meiliApiKey = Deno.env.get("MEILI_SEARCH_KEY") ?? Deno.env.get("MEILI_API_KEY");

  if (!meiliHost || !meiliApiKey) {
    return new Response(JSON.stringify({ error: "Meilisearch not configured" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body: SearchRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const query = body.query?.trim();
  if (!query) {
    return new Response(
      JSON.stringify({ events: [], clubs: [], profiles: [], totalHits: 0, processingTimeMs: 0 }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  }

  const limit = body.limitPerIndex ?? 5;

  // Use Meilisearch's /multi-search endpoint for a single round-trip.
const multiSearchBody = {
  queries: [
    {
      indexUid: "events",
      q: query,
      limit,
      filter:
        "deleted_at IS NULL AND status NOT IN [cancelled, canceled, archived]",
    },
    { indexUid: "clubs", q: query, limit },
    { indexUid: "profiles", q: query, limit },
  ],
};
  try {
    const response = await fetch(`${meiliHost}/multi-search`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${meiliApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(multiSearchBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[meilisearch-search] Meili error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Search failed", detail: errorText }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();

    // Meilisearch /multi-search returns { results: [{ hits, processingTimeMs }, ...] }
    const results = data.results ?? [];
    const events = results[0]?.hits ?? [];
    const clubs = results[1]?.hits ?? [];
    const profiles = results[2]?.hits ?? [];

    return new Response(
      JSON.stringify({
        events,
        clubs,
        profiles,
        totalHits: events.length + clubs.length + profiles.length,
        processingTimeMs: Math.max(
          ...results.map((r: { processingTimeMs: number }) => r.processingTimeMs ?? 0),
          0,
        ),
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[meilisearch-search] Network error:", err);
    return new Response(JSON.stringify({ error: "Network error", detail: String(err) }), {
      status: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
