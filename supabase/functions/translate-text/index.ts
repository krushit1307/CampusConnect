// =============================================================================
// Edge Function: Translate Text
// Issue: #3664 - Implement 'Real-Time "Translation Overlay" for Posters'
// Description: Batch-translates the extracted poster strings into the viewer's
// target language. Uses Google Translate (v2) when a key is configured and
// falls back to a deterministic passthrough otherwise.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRANSLATE_KEY = Deno.env.get("GOOGLE_TRANSLATE_API_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { texts, target, source } = await req.json();
    if (!Array.isArray(texts) || !target) throw new Error("Missing texts[] or target");

    // No provider configured: return originals so the overlay still renders
    if (!TRANSLATE_KEY) {
      return new Response(
        JSON.stringify({ translations: texts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const res = await fetch(
      `https://translation.googleapis.com/language/translate/v2?key=${TRANSLATE_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q: texts, target, source: source || "en", format: "text" }),
      }
    );

    if (!res.ok) throw new Error(`Translation API failure: ${res.status}`);
    const json = await res.json();

    const translations = (json.data?.translations || []).map((t: any) => t.translatedText);

    return new Response(
      JSON.stringify({ translations }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("[TranslateText] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
  }
});
