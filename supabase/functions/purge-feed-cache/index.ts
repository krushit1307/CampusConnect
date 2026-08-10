import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../shared/headers.ts";
import { purgeAllFeedPages } from "../_shared/feedCache.ts";

// Called by the `on_post_deleted_purge_feed_cache` Postgres trigger
// (via pg_net) whenever a post is hard-deleted or soft-deleted, so a
// removed/moderated post can't keep showing up in an already-cached page.
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const purgedCount = await purgeAllFeedPages();
    return new Response(JSON.stringify({ purged: purgedCount }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
