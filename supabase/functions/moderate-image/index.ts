import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

serve(async (req) => {
  try {
    const payload = await req.json();

    // Check if it's an INSERT webhook
    if (payload.type !== "INSERT" || payload.table !== "event_photos") {
      return new Response("Not an event_photos INSERT webhook", { status: 400 });
    }

    const record = payload.record;
    if (!record || !record.id || !record.url) {
      return new Response("Missing record data", { status: 400 });
    }

    const photoId = record.id;
    const photoUrl = record.url;
    const userId = record.user_id;

    console.log(`Processing image ${photoId} from ${photoUrl}`);

    // Download the image
    const imageResponse = await fetch(photoUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
    }
    
    const imageBuffer = await imageResponse.arrayBuffer();
    // Convert to base64
    const base64Image = btoa(
      new Uint8Array(imageBuffer).reduce(
        (data, byte) => data + String.fromCharCode(byte),
        ""
      )
    );

    const apiKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");
    if (!apiKey) {
      console.warn("GOOGLE_CLOUD_VISION_API_KEY is missing. Skipping moderation.");
      return new Response("Skipped moderation - API key missing", { status: 200 });
    }

    // Call Google Cloud Vision API
    const visionApiUrl = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;
    const visionResponse = await fetch(visionApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        requests: [
          {
            image: {
              content: base64Image,
            },
            features: [
              {
                type: "SAFE_SEARCH_DETECTION",
              },
            ],
          },
        ],
      }),
    });

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text();
      throw new Error(`Vision API error: ${errorText}`);
    }

    const visionData = await visionResponse.json();
    const safeSearch = visionData.responses?.[0]?.safeSearchAnnotation;

    if (!safeSearch) {
      console.log("No SafeSearch data found for image.");
      return new Response("Success", { status: 200 });
    }

    const isExplicit =
      safeSearch.adult === "LIKELY" ||
      safeSearch.adult === "VERY_LIKELY" ||
      safeSearch.violence === "LIKELY" ||
      safeSearch.violence === "VERY_LIKELY";

    if (isExplicit) {
      console.log(`Image ${photoId} flagged as explicit/violent. Quarantining...`);

      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      // Update status to quarantined
      const { error: updateError } = await supabaseClient
        .from("event_photos")
        .update({ status: "quarantined" })
        .eq("id", photoId);

      if (updateError) {
        throw updateError;
      }

      // In a real system, you would also trigger an alert to Admins here (e.g. via Slack/Discord Webhook or database insert)
      console.log(`Alert: User ${userId} uploaded flagged content. Image ID: ${photoId}.`);
    }

    return new Response("Success", {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing moderation webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
