// =============================================================================
// Edge Function: Normalize Tags
// Issue: #3711 - Implement 'Automated "Event Tag" Standardization'
// Description: Server-side normalization during draft save. Fuzzy-matches tags
// against the canonical dictionary, silently replaces confident matches, and
// queues novel tags for admin review.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Fuse from "https://esm.sh/fuse.js@7.0.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MATCH_THRESHOLD = 0.8;

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { tags, event_id, user_id } = await req.json();
        if (!Array.isArray(tags)) throw new Error("tags must be an array");

        // 1. Load the canonical dictionary
        const { data: dict } = await supabase.from("canonical_tags").select("id, tag_name, aliases");
        const docs: { label: string; canonical: string }[] = [];
        for (const tag of dict || []) {
            docs.push({ label: tag.tag_name.toLowerCase(), canonical: tag.tag_name });
            for (const alias of tag.aliases) docs.push({ label: alias.toLowerCase(), canonical: tag.tag_name });
        }

        const fuse = new Fuse(docs, { keys: ['label'], includeScore: true, threshold: 0.4, ignoreLocation: true });

        const standardized = new Set<string>();
        const novel: string[] = [];

        // 2. Normalize each tag
        for (const raw of tags) {
            const lower = String(raw).trim().toLowerCase();
            if (!lower) continue;

            const exact = docs.find(d => d.label === lower);
            if (exact) { standardized.add(exact.canonical); continue; }

            const results = fuse.search(lower);
            const top = results[0];
            const confidence = top ? 1 - (top.score ?? 1) : 0;

            if (confidence >= MATCH_THRESHOLD && top) {
                standardized.add(top.item.canonical);   // silent replacement
            } else {
                novel.push(String(raw).trim());          // queue for admin review
            }
        }

        // 3. Queue novel tags for admin review (dedupe via UNIQUE raw_tag)
        for (const n of novel) {
            await supabase.from("pending_tags").upsert(
                { raw_tag: n, suggested_by: user_id || null, context_event_id: event_id || null, status: 'pending' },
                { onConflict: 'raw_tag' }
            );
        }

        return new Response(
            JSON.stringify({ standardized: Array.from(standardized), novel }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error: any) {
        console.error("[NormalizeTags] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
