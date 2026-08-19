import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_TRANSLATE_API_KEY = Deno.env.get("GOOGLE_TRANSLATE_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Define CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { message, senderId, senderName } = await req.json();

    if (!message || !senderId || !senderName) {
      throw new Error("Missing required fields: message, senderId, senderName");
    }

    // 1. Query the Translation API to analyze source text structures
    const detectUrl = `https://translation.googleapis.com/language/translate/v2/detect?key=${GOOGLE_TRANSLATE_API_KEY}`;
    const detectResponse = await fetch(detectUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: message }),
    });
    
    if (!detectResponse.ok) {
      console.error("Detect API error:", await detectResponse.text());
      throw new Error("Failed to detect language");
    }

    const detectData = await detectResponse.json();
    const sourceLang = detectData.data.detections[0][0].language;

    let englishTranslation = message;

    // 2. Compute translation mappings only if the source isn't already English
    if (sourceLang !== "en") {
      const translateUrl = `https://translation.googleapis.com/language/translate/v2?key=${GOOGLE_TRANSLATE_API_KEY}`;
      const translateResponse = await fetch(translateUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: message,
          target: "en",
          format: "text"
        }),
      });
      
      if (!translateResponse.ok) {
        console.error("Translate API error:", await translateResponse.text());
        throw new Error("Failed to translate text");
      }

      const translateData = await translateResponse.json();
      englishTranslation = translateData.data.translations[0].translatedText;
    }

    // 3. Commit structured variables into the database
    const { data: savedMsg, error: dbError } = await supabase
      .from("chat_messages")
      .insert({
        sender_id: senderId,
        sender_name: senderName,
        original_text: message,
        detected_source_lang: sourceLang,
        translated_text_en: englishTranslation
      })
      .select()
      .single();

    if (dbError) throw dbError;

    // 4. Return the calculated model data payload back to client pipelines smoothly
    return new Response(JSON.stringify({ success: true, messagePayload: savedMsg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("Chat Translator Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
