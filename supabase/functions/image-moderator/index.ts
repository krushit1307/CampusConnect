import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const GOOGLE_VISION_API_KEY = Deno.env.get("GOOGLE_VISION_API_KEY")!;
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Map Google SafeSearch likelihood levels to numeric probability ratios
const LIKELIHOOD_MAP: Record<string, number> = {
  "UNKNOWN": 0.0, "VERY_UNLIKELY": 0.1, "UNLIKELY": 0.3,
  "POSSIBLE": 0.5, "LIKELY": 0.75, "VERY_LIKELY": 1.0
};

serve(async (req) => {
  try {
    const { recordId, imageUrl } = await req.json();

    if (!recordId || !imageUrl) {
      return new Response(JSON.stringify({ error: "Missing parameters" }), { status: 400 });
    }

    if (!GOOGLE_VISION_API_KEY) {
      console.warn("GOOGLE_VISION_API_KEY not set. Skipping real moderation for development. Approving by default.");
      return new Response(JSON.stringify({ success: true, is_nsfw: false }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 1. Post request payload to Google Vision SafeSearch Engine
    const visionUrl = `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`;
    const visionResponse = await fetch(visionUrl, {
      method: "POST",
      body: JSON.stringify({
        requests: [{
          image: { source: { imageUri: imageUrl } },
          features: [{ type: "SAFE_SEARCH_DETECTION" }]
        }]
      })
    });

    const visionData = await visionResponse.json();
    const annotations = visionData.responses?.[0]?.safeSearchAnnotation;

    if (!annotations) {
      throw new Error("Failed to extract safety annotations from Vision API.");
    }

    // 2. Map structural response parameters to numeric probabilities
    const adultScore = LIKELIHOOD_MAP[annotations.adult] || 0;
    const violenceScore = LIKELIHOOD_MAP[annotations.violence] || 0;
    const medicalScore = LIKELIHOOD_MAP[annotations.medical] || 0;

    // Trigger NSFW flag if ANY core violation profile maps >= 70% confidence threshold
    const isNsfw = adultScore >= 0.7 || violenceScore >= 0.7 || medicalScore >= 0.7;

    // 3. Mutate storage record rows based on calculated parameters
    const { error: updateError } = await supabase
      .from("event_gallery")
      .update({
        is_nsfw: isNsfw,
        moderation_status: isNsfw ? "pending_review" : "approved",
        safety_confidence_scores: {
          adult: adultScore,
          violence: violenceScore,
          medical: medicalScore
        }
      })
      .eq("id", recordId);

    if (updateError) throw updateError;

    // 4. Fire notifications to administrative groups if a violation hits
    if (isNsfw) {
      console.warn(`🚨 [Content Warning]: High confidence NSFW profile caught on item ID: ${recordId}. Quarantining image.`);
      // Optional: Add pipeline dispatch triggers to send alerts to security channels here
    }

    return new Response(JSON.stringify({ success: true, is_nsfw: isNsfw }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
});
