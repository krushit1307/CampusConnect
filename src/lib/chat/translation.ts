// =============================================================================
// Edge Function: Translate Chat
// Issue: #3699 - Implement 'Real-Time "Translation" for Live Chat'
// Description: Intercepts a chat message, detects its language, translates it
// to English (cached pivot) via Google Cloud Translation, and returns the
// enriched payload { original, translated_en, source_lang } for broadcast.
// =============================================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TRANSLATE_KEY = Deno.env.get("GOOGLE_TRANSLATE_API_KEY") || "";

// Lightweight language hints for the fast path (no API round-trip)
const LANG_HINTS: { code: string; pattern: RegExp }[] = [
    { code: 'zh', pattern: /[\u4e00-\u9fff]/ },
    { code: 'ja', pattern: /[\u3040-\u30ff]/ },
    { code: 'ar', pattern: /[\u0600-\u06ff]/ },
    { code: 'hi', pattern: /[\u0900-\u097f]/ },
];

function quickDetect(text: string): string | null {
    for (const hint of LANG_HINTS) if (hint.pattern.test(text)) return hint.code;
    return null;
}

serve(async (req) => {
    if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

    try {
        const { message_id, content } = await req.json();
        if (!content) throw new Error("Missing content");

        // 1. Detect language (fast regex hint, else let Google detect)
        let sourceLang = quickDetect(content);

        // 2. Translate to English pivot (with graceful fallback)
        let translatedEn = content;
        if (TRANSLATE_KEY) {
            const res = await fetch(
                `https://translation.googleapis.com/language/translate/v2?key=${TRANSLATE_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ q: content, target: "en", format: "text" }),
                }
            );
            if (res.ok) {
                const json = await res.json();
                const t = json.data?.translations?.[0];
                if (t) {
                    translatedEn = t.translatedText;
                    if (!sourceLang && t.detectedSourceLanguage) sourceLang = t.detectedSourceLanguage;
                }
            }
        }
        sourceLang = sourceLang || "en";

        // 3. Persist the cached translation for future viewers
        if (message_id) {
            const supabaseAdmin = createClient(
                Deno.env.get("SUPABASE_URL") ?? "",
                Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
            );
            await supabaseAdmin
                .from("event_chat_messages")
                .update({ source_lang: sourceLang, translated_en: translatedEn })
                .eq("id", message_id);
        }

        // 4. Return enriched payload for Realtime broadcast
        return new Response(
            JSON.stringify({ original: content, translated_en: translatedEn, source_lang: sourceLang }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
    } catch (error: any) {
        console.error("[TranslateChat] Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { headers: corsHeaders, status: 500 });
    }
});
