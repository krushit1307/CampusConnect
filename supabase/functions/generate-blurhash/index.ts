import { createClient } from "@supabase/supabase-js";
import { encode } from "https://deno.land/x/blurhash@v0.1.0/mod.ts";
import { decode as decodeImage } from "https://deno.land/x/imagescript@1.2.16/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface StorageWebhookPayload {
  bucket_id: string;
  name: string;
}

// Blurhash encoding works best on small images — downscale before encoding
// so the function stays fast and cheap regardless of the original upload size.
const BLURHASH_SAMPLE_WIDTH = 32;
const BLURHASH_COMPONENTS_X = 4;
const BLURHASH_COMPONENTS_Y = 3;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify this call actually came from our own Postgres trigger, not
    // an arbitrary caller — same convention as this project's other
    // webhook-triggered functions.
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    const providedSecret = req.headers.get("x-webhook-secret");
    if (expectedSecret && providedSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { bucket_id, name }: StorageWebhookPayload = await req.json();

    if (!bucket_id || !name) {
      return new Response(JSON.stringify({ error: "Missing bucket_id or name" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download the uploaded image
    const { data: fileBlob, error: downloadError } = await supabase.storage
      .from(bucket_id)
      .download(name);

    if (downloadError || !fileBlob) {
      console.error("Failed to download uploaded image:", downloadError);
      return new Response(JSON.stringify({ error: "Failed to download image" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode + downscale for cheap, fast blurhash encoding
    const buffer = new Uint8Array(await fileBlob.arrayBuffer());
    const image = await decodeImage(buffer);
    const scaledHeight = Math.round((image.height / image.width) * BLURHASH_SAMPLE_WIDTH);
    image.resize(BLURHASH_SAMPLE_WIDTH, scaledHeight);

    const pixels = new Uint8ClampedArray(image.bitmap);
    const hash = encode(
      pixels,
      image.width,
      image.height,
      BLURHASH_COMPONENTS_X,
      BLURHASH_COMPONENTS_Y,
    );

    // Persist the blurhash to the correct table based on the source bucket.
    if (bucket_id === "post-attachments") {
      // Find the post whose image_url references this uploaded file and store
      // the generated blurhash.  image_url is expected to contain the storage
      // object path (or a public URL ending in it).
      const { error: updateError } = await supabase
        .from("posts")
        .update({ blurhash: hash })
        .ilike("image_url", `%${name}%`);

      if (updateError) {
        console.error("Failed to save blurhash to post:", updateError);
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else {
      // Default: event-banners bucket — update the matching event row.
      // Find the event row whose banner_url references this uploaded file and
      // attach the generated blurhash. banner_url is expected to contain the
      // storage object path (or a URL ending in it).
      const { error: updateError } = await supabase
        .from("events")
        .update({ blurhash: hash })
        .ilike("banner_url", `%${name}%`);

      if (updateError) {
        console.error("Failed to save blurhash to event:", updateError);
        return new Response(JSON.stringify({ error: updateError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ blurhash: hash }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("generate-blurhash function error:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
