// @ts-ignore
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload = await req.json();

    // Expecting payload from pg_net trigger on INSERT to posts table
    if (payload.type !== "INSERT" || payload.table !== "posts") {
      return new Response(JSON.stringify({ message: "Ignored: not a new post insert." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { id, content } = payload.record;
    if (!content) {
      return new Response(JSON.stringify({ message: "No content to moderate." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
    if (!openaiApiKey) {
      console.warn("Missing OPENAI_API_KEY environment variable. Moderation skipped.");
      return new Response(JSON.stringify({ error: "Missing OpenAI API key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Generate an embedding for the post content via OpenAI
    const openaiRes = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: "text-embedding-ada-002",
        input: content,
      }),
    });

    if (!openaiRes.ok) {
      const errText = await openaiRes.text();
      throw new Error(`OpenAI API error: ${errText}`);
    }

    const openaiData = await openaiRes.json();
    const embedding = openaiData.data[0].embedding;

    // 2. Query Supabase for toxic patterns using the generated embedding
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: matches, error: matchError } = await supabase.rpc("match_toxic_patterns", {
      query_embedding: embedding,
      match_threshold: 0.85, // Flag if similarity > 0.85
      match_count: 1,
    });

    if (matchError) {
      throw new Error(`Supabase match error: ${matchError.message}`);
    }

    // 3. If a match is found, flag the post
    if (matches && matches.length > 0) {
      const match = matches[0];
      console.log(
        `Flagging post ${id} due to similarity with toxic pattern: ${match.pattern_text}`,
      );

      const { error: updateError } = await supabase
        .from("posts")
        .update({
          is_flagged: true,
          flagged_reason: `AI Moderation: Semantic similarity of ${Math.round(match.similarity * 100)}% to known toxic pattern.`,
        })
        .eq("id", id);

      if (updateError) {
        throw new Error(`Failed to update post flag: ${updateError.message}`);
      }

      return new Response(JSON.stringify({ message: "Post flagged successfully", match }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ message: "Post content is safe." }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Function error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
