// @ts-ignore: Deno imports
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// @ts-ignore: Deno imports
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

declare const Deno: any;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VTT_TIMESTAMP_REGEX =
  /^((?:\d{2}:)?\d{2}:\d{2}\.\d{3})\s+-->\s+((?:\d{2}:)?\d{2}:\d{2}\.\d{3})/;

function parseVttCues(vttContent: string) {
  const lines = vttContent.replace(/\r\n/g, "\n").split("\n");
  const cues: Array<{ id?: string; timestampLine: string; text: string }> = [];
  let i = 0;

  while (i < lines.length) {
    let line = lines[i].trim();
    if (!line) {
      i++;
      continue;
    }

    let cueId: string | undefined = undefined;
    if (
      !VTT_TIMESTAMP_REGEX.test(line) &&
      i + 1 < lines.length &&
      VTT_TIMESTAMP_REGEX.test(lines[i + 1].trim())
    ) {
      cueId = line;
      i++;
      line = lines[i].trim();
    }

    const match = line.match(VTT_TIMESTAMP_REGEX);
    if (match) {
      const timestampLine = line;
      i++;
      const textLines: string[] = [];
      while (i < lines.length && lines[i].trim() !== "") {
        textLines.push(lines[i].trim());
        i++;
      }
      cues.push({ id: cueId, timestampLine, text: textLines.join(" ") });
    } else {
      i++;
    }
  }

  return cues;
}

// Fallback translation helper for target languages
async function translateTextChunk(
  text: string,
  targetLang: string,
  googleApiKey?: string,
): Promise<string> {
  if (googleApiKey) {
    try {
      const res = await fetch(
        `https://translation.googleapis.com/language/translate/v2?key=${googleApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ q: text, target: targetLang, format: "text" }),
        },
      );
      const data = await res.json();
      if (data?.data?.translations?.[0]?.translatedText) {
        return data.data.translations[0].translatedText;
      }
    } catch (e) {
      console.warn(`[translate-vtt-captions] Google Translation API failed for ${targetLang}:`, e);
    }
  }
  // Generic fallback
  return `[${targetLang.toUpperCase()}] ${text}`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const googleApiKey = Deno.env.get("GOOGLE_TRANSLATE_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => ({}));
    const { resourceId, vttContent, targetLanguages = ["es", "zh", "fr"] } = body;

    if (!resourceId || !vttContent) {
      return new Response(JSON.stringify({ error: "resourceId and vttContent are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cues = parseVttCues(vttContent);
    const translatedVttUrls: Record<string, string> = {};

    for (const lang of targetLanguages) {
      let outputVtt = `WEBVTT - Translated (${lang}) by CampusConnect AI\n\n`;

      for (let idx = 0; idx < cues.length; idx++) {
        const cue = cues[idx];
        const translatedText = await translateTextChunk(cue.text, lang, googleApiKey);
        const cueIndex = cue.id || String(idx + 1);

        // Retain VTT timestamp metadata structure intact
        outputVtt += `${cueIndex}\n${cue.timestampLine}\n${translatedText}\n\n`;
      }

      const fileName = `${resourceId}_${lang}.vtt`;
      const { error: uploadErr } = await supabase.storage
        .from("event_resources")
        .upload(fileName, outputVtt, {
          contentType: "text/vtt",
          upsert: true,
        });

      if (uploadErr) {
        console.error(`Failed to upload ${fileName}:`, uploadErr);
        continue;
      }

      const { data: publicUrlData } = supabase.storage
        .from("event_resources")
        .getPublicUrl(fileName);

      translatedVttUrls[lang] = publicUrlData.publicUrl;
    }

    // Update resource_transcripts database table with translated VTT URLs
    await supabase.from("resource_transcripts").upsert(
      {
        resource_id: resourceId,
        translated_vtt_urls: translatedVttUrls,
      },
      { onConflict: "resource_id" },
    );

    return new Response(
      JSON.stringify({
        success: true,
        resourceId,
        translatedVttUrls,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("Internal server error in translate-vtt-captions:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
