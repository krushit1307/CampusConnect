// =============================================================================
// Edge Function: Rewrite Professional
// Issue: #3557 - Implement 'Automated Event Description "Tone" Analyzer'
// Description: Uses an LLM to automatically translate informal event
// descriptions into a corporate, academic tone aligned with university
// brand guidelines.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabase = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_ANON_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Unauthorized");

        const { text } = await req.json();
        if (!text) throw new Error("Missing text to rewrite");

        // 1. Call OpenAI to rewrite the text professionally
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Cost-effective for rewriting tasks
            messages: [
                {
                    role: "system",
                    content: `You are a professional university communications editor. 
          Your task is to rewrite event descriptions to align with official university brand guidelines.
          Rules:
          1. Remove all slang, excessive emojis, and informal language.
          2. Maintain a professional, academic, and welcoming tone.
          3. Keep the core information (dates, times, locations, requirements) intact.
          4. Use proper grammar and complete sentences.
          5. Do not add new information that wasn't in the original text.
          Return ONLY the rewritten text, no introductory or concluding remarks.`
                },
                {
                    role: "user",
                    content: `Rewrite this event description professionally:\n\n"${text}"`
                }
            ],
            temperature: 0.3, // Low temperature for deterministic, consistent rewrites
            max_tokens: 1000,
        });

        const rewrittenText = completion.choices[0].message.content?.trim() || text;

        return new Response(
            JSON.stringify({ success: true, rewritten_text: rewrittenText }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[RewriteProfessional] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
