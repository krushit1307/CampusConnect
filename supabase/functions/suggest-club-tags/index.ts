/**
 * Supabase Edge Function: suggest-club-tags
 *
 * Receives club mission statement/description, extracts keywords,
 * and queries the tag_ontology table to suggest relevant search tags.
 */

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Basic English stopwords to filter out before keyword matching
const STOP_WORDS = new Set([
  "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
  "any", "are", "arent", "as", "at", "be", "because", "been", "before", "being",
  "below", "between", "both", "but", "by", "cant", "cannot", "could", "couldnt",
  "did", "didnt", "do", "does", "doesnt", "doing", "dont", "down", "during",
  "each", "few", "for", "from", "further", "had", "hadnt", "has", "hasnt", "have",
  "havent", "having", "he", "hed", "hell", "hes", "her", "here", "heres", "hers",
  "herself", "him", "himself", "his", "how", "hows", "i", "id", "ill", "im",
  "ive", "if", "in", "into", "is", "isnt", "it", "its", "itself", "lets", "me",
  "more", "most", "mustnt", "my", "myself", "no", "nor", "not", "of", "off",
  "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
  "out", "over", "own", "same", "shant", "she", "shed", "shell", "shes", "should",
  "shouldnt", "so", "some", "such", "than", "that", "thats", "the", "their",
  "theirs", "them", "themselves", "then", "there", "theres", "these", "they",
  "theyd", "theyll", "theyre", "theyve", "this", "those", "through", "to", "too",
  "under", "until", "up", "very", "was", "wasnt", "we", "wed", "well", "were",
  "weve", "werent", "what", "whats", "when", "whens", "where", "wheres", "which",
  "while", "who", "whos", "whom", "why", "whys", "with", "wont", "would", "wouldnt",
  "you", "youd", "youll", "youre", "youve", "your", "yours", "yourself", "yourselves",
  "club", "organization", "group", "society", "association", "team"
]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body = await req.json();
    const { text } = body;

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ tags: [] }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Extract keywords by splitting on non-alphanumeric chars
    const tokens = text
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 2 && !STOP_WORDS.has(t));

    const uniqueTokens = Array.from(new Set(tokens)).slice(0, 20);

    if (uniqueTokens.length === 0) {
      return new Response(JSON.stringify({ tags: [] }), {
        status: 200,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // Match keywords against tag_ontology using our PostgreSQL similarity function
    const { data: suggestions, error: rpcError } = await supabaseClient.rpc(
      "suggest_ontology_tags",
      { p_keywords: uniqueTokens }
    );

    if (rpcError) {
      throw rpcError;
    }

    return new Response(JSON.stringify({ tags: suggestions || [] }), {
      status: 200,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[suggest-club-tags] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
});
