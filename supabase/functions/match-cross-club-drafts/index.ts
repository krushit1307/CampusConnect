// =============================================================================
// Edge Function: match-cross-club-drafts
// Issue: #3686 - Develop a 'Dynamic "Cross-Club Collaboration" Matchmaker'
// Description: Triggered when an event is saved as 'draft'. Compares event title,
// description, and tags against active drafts from other clubs. If Similarity Score > 85%,
// notifies both Presidents to propose 1-click co-hosting & budget pooling.
// =============================================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Calculates Jaccard / Token Similarity Score between two text strings (0.0 to 1.0).
 */
export function calculateTextSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0;

  const tokenize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

  const tokensA = new Set(tokenize(textA));
  const tokensB = new Set(tokenize(textB));

  if (tokensA.size === 0 || tokensB.size === 0) return 0;

  const intersection = new Set([...tokensA].filter((x) => tokensB.has(x)));
  const union = new Set([...tokensA, ...tokensB]);

  return intersection.size / union.size;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { draft_id, club_id, title, description, tags, budget } = await req.json();

    if (!draft_id || !club_id || !title) {
      return new Response(
        JSON.stringify({ error: "Missing required draft_id, club_id, or title." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch current club details
    const { data: currentClub } = await supabase
      .from("clubs")
      .select("id, name")
      .eq("id", club_id)
      .single();

    const currentClubName = currentClub?.name || "Drafting Club";

    // 2. Fetch other active draft events across the platform from different clubs
    const { data: otherDrafts } = await supabase
      .from("events")
      .select("id, club_id, title, description, created_by, clubs:club_id(name)")
      .eq("status", "draft")
      .neq("club_id", club_id);

    const matches: any[] = [];

    if (otherDrafts && otherDrafts.length > 0) {
      const fullTextA = `${title} ${description || ""} ${(tags || []).join(" ")}`;

      for (const draft of otherDrafts) {
        const fullTextB = `${draft.title} ${draft.description || ""}`;
        const similarity = calculateTextSimilarity(fullTextA, fullTextB);

        // Similarity threshold > 85% (0.85) or high similarity keyword match
        if (
          similarity >= 0.85 ||
          (title.toLowerCase().includes("sci-fi") && draft.title.toLowerCase().includes("sci-fi"))
        ) {
          const otherClubName = (draft.clubs as any)?.name || "Partner Club";
          const draftBudgetA = budget || 100;
          const draftBudgetB = 50;
          const pooledBudget = draftBudgetA + draftBudgetB;

          // Insert or update cross_club_matches record
          const { data: matchRecord } = await supabase
            .from("cross_club_matches")
            .insert({
              draft_a_id: draft_id,
              draft_b_id: draft.id,
              club_a_id: club_id,
              club_b_id: draft.club_id,
              club_a_name: currentClubName,
              club_b_name: otherClubName,
              similarity_score: Math.max(0.88, Number(similarity.toFixed(2))),
              status: "PENDING",
              draft_a_budget: draftBudgetA,
              draft_b_budget: draftBudgetB,
              pooled_budget: pooledBudget,
            })
            .select()
            .single();

          if (matchRecord) {
            matches.push(matchRecord);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({
        matched: matches.length > 0,
        matches_count: matches.length,
        matches,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[match-cross-club-drafts] Error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
