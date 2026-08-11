import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { rateLimiter } from "../shared/rateLimiter.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  // Rate limit: 20 requests/minute (external translation API)
  const limited = await rateLimiter(req, "translate-message", 20, 60);
  if (limited) return limited;

  try {
    const { message_id, target_language, text } = await req.json();

    if (!message_id || !target_language || !text) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check if translation exists
    const { data: existing } = await supabase
      .from("message_translations")
      .select("translated_text")
      .eq("message_id", message_id)
      .eq("target_language", target_language)
      .single();

    if (existing) {
      return new Response(JSON.stringify({ translated_text: existing.translated_text }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Invoke Translation API (Mocked for this implementation)
    // In production, this would be: await fetch(`https://translation.googleapis.com/language/translate/v2?key=${API_KEY}`, { ... })
    const translated_text = `[Translated to ${target_language}]: ${text}`;

    // 3. Cache the translation
    await supabase.from("message_translations").insert({
      message_id,
      target_language,
      translated_text,
    });

    return new Response(JSON.stringify({ translated_text }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
