import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { Image, decode } from "jsr:@matmen/imagescript";
import { parseJsonBody } from "../_shared/validation.ts";

// Storage webhook payload — may be wrapped in { record: {...} } or sent
// with the record fields at the top level.
const storageRecordSchema = z
  .object({
    bucket_id: z.string().min(1),
    name: z.string().min(1),
  })
  .strict();

const imageOptimizerSchema = z
  .object({
    record: storageRecordSchema.optional(),
    bucket_id: z.string().optional(),
    name: z.string().optional(),
  })
  .strict();

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders,
    });
  }

  try {
    const parsed = await parseJsonBody(imageOptimizerSchema, req);
    if (!parsed.ok) return parsed.response;

    const payload = parsed.data;
    const record = payload.record ?? payload;

    const bucket = record.bucket_id;
    const objectPath = record.name;

    if (!bucket || !objectPath) {
      return new Response(
        JSON.stringify({
          error: "Missing bucket or object path",
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Skip thumbnails
    if (objectPath.includes("-thumb.")) {
      return new Response(
        JSON.stringify({
          skipped: true,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const extension = objectPath.split(".").pop()?.toLowerCase();

    if (!extension || !["jpg", "jpeg", "png", "webp"].includes(extension)) {
      return new Response(
        JSON.stringify({
          skipped: true,
        }),
        {
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        },
      );
    }

    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!url || !key) {
      throw new Error("Missing Supabase environment variables.");
    }

    const supabase = createClient(url, key);

    // Download original image
    const { data: originalImage, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(objectPath);

    if (downloadError) {
      throw downloadError;
    }

    const buffer = new Uint8Array(await originalImage.arrayBuffer());

    // Decode image
    const image = await decode(buffer);

    // Resize
    image.resize(400, Image.RESIZE_AUTO);

    // Encode JPG
    const thumbnailBytes = await image.encodeJPEG(85);

    const thumbnail = new Blob([thumbnailBytes], {
      type: "image/jpeg",
    });

    const thumbPath = objectPath.replace(/(\.[^.]+)$/, "-thumb.jpg");

    // Upload thumbnail
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(thumbPath, thumbnail, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      throw uploadError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        thumbnail: thumbPath,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
        status: 200,
      },
    );
  } catch (err) {
    console.error(err);

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      },
    );
  }
});
