import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const MAX_DESCRIPTION_LENGTH = 20_000;
const LANGUAGE_CODE = /^[a-z]{2,3}(?:-[a-z]{2})?$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function hash(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const limited = await rateLimiter(req, "translate-event-description", 10, 60);
  if (limited) return limited;

  try {
    const { event_id: eventId, target_language: targetLanguage } = await req.json();
    if (typeof eventId !== "string" || typeof targetLanguage !== "string") {
      return json({ error: "event_id and target_language are required" }, 400);
    }

    const language = targetLanguage.trim().toLowerCase();
    if (!LANGUAGE_CODE.test(language)) return json({ error: "Invalid target language" }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !serviceRoleKey)
      return json({ error: "Translation service is unavailable" }, 503);

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await verifyAuth(req, supabase);

    const { data: event, error: eventError } = await supabase
      .from("events")
      .select("description")
      .eq("id", eventId)
      .single();
    if (eventError || !event?.description)
      return json({ error: "Event description not found" }, 404);
    if (event.description.length > MAX_DESCRIPTION_LENGTH) {
      return json({ error: "Event description is too large to translate" }, 413);
    }

    const sourceHash = await hash(event.description);
    const { data: cached } = await supabase
      .from("content_translations")
      .select("translated_text")
      .eq("entity_type", "event")
      .eq("entity_id", eventId)
      .eq("language", language)
      .eq("source_hash", sourceHash)
      .maybeSingle();
    if (cached) return json({ translated_text: cached.translated_text, cached: true });

    const deepLKey = Deno.env.get("DEEPL_API_KEY");
    if (!deepLKey) return json({ error: "Translation service is not configured" }, 503);
    const deepLEndpoint =
      Deno.env.get("DEEPL_API_URL") ?? "https://api-free.deepl.com/v2/translate";
    const response = await fetch(deepLEndpoint, {
      method: "POST",
      headers: { Authorization: `DeepL-Auth-Key ${deepLKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: [event.description],
        target_lang: language.toUpperCase(),
        tag_handling: "html",
        preserve_formatting: true,
      }),
    });
    if (!response.ok) {
      console.error("DeepL request failed", response.status);
      return json({ error: "Translation provider request failed" }, 502);
    }
    const providerData = await response.json();
    const translatedText = providerData?.translations?.[0]?.text;
    if (typeof translatedText !== "string")
      return json({ error: "Translation provider returned invalid data" }, 502);

    await supabase.from("content_translations").upsert(
      {
        entity_type: "event",
        entity_id: eventId,
        language,
        source_hash: sourceHash,
        translated_text: translatedText,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "entity_type,entity_id,language" },
    );
    return json({ translated_text: translatedText, cached: false });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized")
      return json({ error: "Unauthorized" }, 401);
    console.error("Event description translation failed", error);
    return json({ error: "Unable to translate event description" }, 500);
  }
});
