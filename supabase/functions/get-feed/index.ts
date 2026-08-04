// @ts-ignore
declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

// @ts-ignore
declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void;
};

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../shared/headers.ts";
import { getFeedCacheKey, getCachedPage, setCachedPage } from "../_shared/feedCache.ts";

const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

// Service-role client: this function reads a public feed, so RLS bypass here
// only ever returns the same rows the RPC already grants to `anon`/`authenticated`.
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
);

async function fetchPage(after: string | null, first: number) {
  const { data, error } = await supabase.rpc("get_posts_relay", {
    p_after: after,
    p_first: first,
  });
  if (error) throw error;
  return data;
}

/** Fetches a page and caches it, ignoring errors (used for background prefetch). */
async function prefetchAndCache(after: string | null, first: number) {
  try {
    const key = getFeedCacheKey(after);
    const existing = await getCachedPage(key);
    if (existing) return; // already warm
    const page = await fetchPage(after, first);
    await setCachedPage(key, page);
  } catch (err) {
    console.warn("[get-feed] background prefetch failed:", err);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const after = url.searchParams.get("after") || null;
    const first = Number(url.searchParams.get("first")) || 10;

    const cacheKey = getFeedCacheKey(after);
    const cached = await getCachedPage<{ pageInfo?: { endCursor?: string | null } }>(cacheKey);

    if (cached) {
      // Cache hit: return immediately, then warm the *next* page in the
      // background so it's likely to be ready before the user asks for it.
      const nextCursor = cached.pageInfo?.endCursor ?? null;
      if (nextCursor) {
        EdgeRuntime.waitUntil(prefetchAndCache(nextCursor, first));
      }
      return new Response(JSON.stringify(cached), { headers: jsonHeaders });
    }

    // Cache miss: fall back to a normal query, then cache it for next time.
    const page = await fetchPage(after, first);
    await setCachedPage(cacheKey, page);

    const nextCursor =
      (page as { pageInfo?: { endCursor?: string | null } })?.pageInfo?.endCursor ?? null;
    if (nextCursor) {
      EdgeRuntime.waitUntil(prefetchAndCache(nextCursor, first));
    }

    return new Response(JSON.stringify(page), { headers: jsonHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: jsonHeaders,
      status: 400,
    });
  }
});
