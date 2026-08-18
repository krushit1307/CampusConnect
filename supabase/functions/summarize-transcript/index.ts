// =============================================================================
// Edge Function: Summarize Transcript (Map-Reduce)
// Issue: #3539 - Implement 'Real-Time Event Transcript Summarizer (TL;DR)'
// Description: Triggered when a VTT transcript is finalized. Chunks the text 
// to fit context windows, summarizes each chunk(Map), and then synthesizes
// the final 5 bullet points(Reduce) using GPT-4o.
    // =============================================================================

    import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

// Simple chunking utility for Edge Function
function chunkText(text: string, maxTokens: number = 3000): string[] {
    const words = text.split(" ");
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    // Rough estimate: 1 word = 1.3 tokens. We'll use 2500 words per chunk to be safe.
    const maxWords = Math.floor(maxTokens / 1.3);

    for (const word of words) {
        currentChunk.push(word);
        if (currentChunk.length >= maxWords) {
            chunks.push(currentChunk.join(" "));
            currentChunk = [];
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }
    return chunks;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { event_id, transcript_text } = await req.json();
        if (!event_id || !transcript_text) throw new Error("Missing event_id or transcript_text");

        // 1. Map Phase: Summarize chunks
        const chunks = chunkText(transcript_text);
        const mapPromises = chunks.map(async (chunk) => {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Summarize the following transcript chunk into a concise paragraph highlighting key technical concepts and discussions." },
                    { role: "user", content: chunk }
                ],
                temperature: 0.3,
            });
            return response.choices[0].message.content;
        });

        const chunkSummaries = await Promise.all(mapPromises);
        const combinedSummaries = chunkSummaries.join("\n\n// -\n\n");

        // 2. Reduce Phase: Synthesize final 5 bullet points
        const reduceResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are an expert academic summarizer. Return exactly 5 bullet points summarizing the core technical concepts and key takeaways discussed. Do not include introductory text. Format as a JSON array of strings." },
                { role: "user", content: combinedSummaries }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        const reduceContent = reduceResponse.choices[0].message.content;
        const parsed = JSON.parse(reduceContent || "{}");
        const bulletPoints = parsed.bullet_points || parsed.points || parsed || [];

        // Ensure we have an array of strings
        const finalPoints = Array.isArray(bulletPoints) ? bulletPoints.map(String).slice(0, 5) : [];

        if (finalPoints.length === 0) throw new Error("LLM failed to generate bullet points.");

        // 3. Save to Database
        const { error: insertError } = await supabaseAdmin
            .from("event_summaries")
            .upsert({
                event_id,
                summary_points: finalPoints,
                model_used: "gpt-4o",
                token_count: transcript_text.split(" ").length // Rough token estimate
            }, { onConflict: "event_id" });

        if (insertError) throw insertError;

        return new Response(
            JSON.stringify({ success: true, points: finalPoints.length }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[SummarizeTranscript] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});// =============================================================================
// Edge Function: Summarize Transcript (Map-Reduce)
// Issue: #3539 - Implement 'Real-Time Event Transcript Summarizer (TL;DR)'
// Description: Triggered when a VTT transcript is finalized. Chunks the text 
// to fit context windows, summarizes each chunk(Map), and then synthesizes
// the final 5 bullet points(Reduce) using GPT-4o.
    // =============================================================================

    import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import OpenAI from "https://esm.sh/openai@4.20.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const openai = new OpenAI({ apiKey: Deno.env.get("OPENAI_API_KEY") });

// Simple chunking utility for Edge Function
function chunkText(text: string, maxTokens: number = 3000): string[] {
    const words = text.split(" ");
    const chunks: string[] = [];
    let currentChunk: string[] = [];

    // Rough estimate: 1 word = 1.3 tokens. We'll use 2500 words per chunk to be safe.
    const maxWords = Math.floor(maxTokens / 1.3);

    for (const word of words) {
        currentChunk.push(word);
        if (currentChunk.length >= maxWords) {
            chunks.push(currentChunk.join(" "));
            currentChunk = [];
        }
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(" "));
    }
    return chunks;
}

serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const authHeader = req.headers.get("Authorization")!;
        const supabaseAdmin = createClient(
            Deno.env.get("SUPABASE_URL") ?? "",
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
            { global: { headers: { Authorization: authHeader } } }
        );

        const { event_id, transcript_text } = await req.json();
        if (!event_id || !transcript_text) throw new Error("Missing event_id or transcript_text");

        // 1. Map Phase: Summarize chunks
        const chunks = chunkText(transcript_text);
        const mapPromises = chunks.map(async (chunk) => {
            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: "Summarize the following transcript chunk into a concise paragraph highlighting key technical concepts and discussions." },
                    { role: "user", content: chunk }
                ],
                temperature: 0.3,
            });
            return response.choices[0].message.content;
        });

        const chunkSummaries = await Promise.all(mapPromises);
        const combinedSummaries = chunkSummaries.join("\n\n// -\n\n");

        // 2. Reduce Phase: Synthesize final 5 bullet points
        const reduceResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                { role: "system", content: "You are an expert academic summarizer. Return exactly 5 bullet points summarizing the core technical concepts and key takeaways discussed. Do not include introductory text. Format as a JSON array of strings." },
                { role: "user", content: combinedSummaries }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2,
        });

        const reduceContent = reduceResponse.choices[0].message.content;
        const parsed = JSON.parse(reduceContent || "{}");
        const bulletPoints = parsed.bullet_points || parsed.points || parsed || [];

        // Ensure we have an array of strings
        const finalPoints = Array.isArray(bulletPoints) ? bulletPoints.map(String).slice(0, 5) : [];

        if (finalPoints.length === 0) throw new Error("LLM failed to generate bullet points.");

        // 3. Save to Database
        const { error: insertError } = await supabaseAdmin
            .from("event_summaries")
            .upsert({
                event_id,
                summary_points: finalPoints,
                model_used: "gpt-4o",
                token_count: transcript_text.split(" ").length // Rough token estimate
            }, { onConflict: "event_id" });

        if (insertError) throw insertError;

        return new Response(
            JSON.stringify({ success: true, points: finalPoints.length }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );

    } catch (error: any) {
        console.error("[SummarizeTranscript] Error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
        );
    }
});
