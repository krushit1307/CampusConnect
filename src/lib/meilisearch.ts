// src/lib/meilisearch.ts
//
// Frontend Meilisearch client wrapper (Issue #2686).
//
// Wraps the raw Meilisearch REST API calls so the frontend doesn't
// need the `meilisearch` npm package (keeps the bundle small).
// All calls go through the Edge Function proxy at
// /functions/v1/meilisearch-search to avoid exposing the Meilisearch
// API key to the browser.

/**
 * A single search result from Meilisearch.
 */
export interface MeiliSearchHit {
  id: string;
  [key: string]: unknown;
}

/**
 * The response from a Meilisearch multi-search call.
 */
export interface MeiliMultiSearchResult {
  events: MeiliSearchHit[];
  clubs: MeiliSearchHit[];
  profiles: MeiliSearchHit[];
}

/**
 * The categorised results returned to the Omnibar component.
 */
export interface UnifiedSearchResults {
  events: MeiliSearchHit[];
  clubs: MeiliSearchHit[];
  profiles: MeiliSearchHit[];
  totalHits: number;
  processingTimeMs: number;
}

/**
 * Search across all three indexes (events, clubs, profiles) in a
 * single round-trip via the meilisearch-search Edge Function.
 *
 * The Edge Function proxies the request to Meilisearch's /multi-search
 * endpoint so the browser never sees the API key.
 *
 * @param query The search query string.
 * @param limitPerIndex Max results per index (default 5).
 * @param signal Optional AbortSignal for debouncing.
 */
export async function unifiedSearch(
  query: string,
  limitPerIndex: number = 5,
  signal?: AbortSignal,
): Promise<UnifiedSearchResults> {
  if (!query.trim()) {
    return { events: [], clubs: [], profiles: [], totalHits: 0, processingTimeMs: 0 };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

  const response = await fetch(`${supabaseUrl}/functions/v1/meilisearch-search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ query, limitPerIndex }),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[meilisearch] Search failed:", response.status, errorText);
    return { events: [], clubs: [], profiles: [], totalHits: 0, processingTimeMs: 0 };
  }

  const data = await response.json();
  return {
    events: data.events ?? [],
    clubs: data.clubs ?? [],
    profiles: data.profiles ?? [],
    totalHits: data.totalHits ?? 0,
    processingTimeMs: data.processingTimeMs ?? 0,
  };
}
