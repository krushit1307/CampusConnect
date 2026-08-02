// supabase/functions/generate-thumbnail/index.ts
//
// Triggered by a Storage -> Database Webhook on storage.objects INSERT
// (filtered to bucket_id = 'avatars'). Generates a small square thumbnail
// for newly-uploaded avatars/club logos and writes the thumbnail URL back
// onto whichever row (profiles or clubs) references the original image.
//
// Issue #1448: [REFACTOR] Move Heavy Image Processing to Supabase Edge Functions

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.24.2";
import { decode, Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { parseJsonBody } from "../_shared/validation.ts";

const THUMB_SIZE = 128;
const THUMB_SUFFIX = "_thumb";
const SOURCE_BUCKET = "avatars";

interface StorageWebhookPayload {
  type: string;
  table: string;
  record: {
    bucket_id: string;
    name: string; // e.g. "<user_id>/<uuid>.jpg"
  };
}

const storageWebhookSchema = z
  .object({
    type: z.string().optional(),
    table: z.string().optional(),
    record: z
      .object({
        bucket_id: z.string().min(1),
        name: z.string().min(1),
      })
      .strict(),
  })
  .strict();

Deno.serve(async (req) => {
  try {
    // Verify this is actually coming from our configured webhook, not a
    // stranger poking the public function URL.
    const webhookSecret = Deno.env.get("STORAGE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("[generate-thumbnail] STORAGE_WEBHOOK_SECRET is not configured");
      return new Response("Server misconfigured", { status: 500 });
    }
    const provided = req.headers.get("x-webhook-secret");
    if (provided !== webhookSecret) {
      return new Response("Unauthorized", { status: 401 });
    }

    const parsed = await parseJsonBody(storageWebhookSchema, req);
    if (!parsed.ok) return parsed.response;
    const payload = parsed.data as StorageWebhookPayload;
    const { bucket_id, name: objectPath } = payload.record ?? {};

    if (!bucket_id || !objectPath) {
      return new Response("Missing bucket_id/name in payload", { status: 400 });
    }

    // Guard against infinite recursion: don't generate a thumbnail of a thumbnail.
    // Parse the filename (not the full object key) so a directory or user id
    // that happens to contain "_thumb" doesn't cause valid uploads to be skipped.
    const lastSlash = objectPath.lastIndexOf("/");
    const filename = lastSlash === -1 ? objectPath : objectPath.slice(lastSlash + 1);
    if (bucket_id !== SOURCE_BUCKET || filename.endsWith(`${THUMB_SUFFIX}.jpg`)) {
      return new Response("Skipped", { status: 200 });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Download the original that was just uploaded.
    const { data: original, error: downloadError } = await supabase.storage
      .from(bucket_id)
      .download(objectPath);

    if (downloadError || !original) {
      console.error("[generate-thumbnail] download failed:", downloadError);
      return new Response("Failed to download source image", { status: 500 });
    }

    const sourceBytes = new Uint8Array(await original.arrayBuffer());

    // Resize with ImageScript (pure WASM/JS, no native deps needed in the
    // Edge Function runtime).
    const image = await decode(sourceBytes);
    if (image instanceof Image === false) {
      // decode() can return a GIF/animated frame set; bail on anything
      // that isn't a plain still image.
      return new Response("Unsupported image type for thumbnailing", { status: 200 });
    }
    const thumbnail = image.cover(THUMB_SIZE, THUMB_SIZE);
    const thumbBytes = await thumbnail.encodeJPEG(80);

    // Build the thumbnail path alongside the original: "<dir>/<name>_thumb.jpg"
    const dir = lastSlash === -1 ? "" : objectPath.slice(0, lastSlash + 1);
    const lastDot = filename.lastIndexOf(".");
    const filenameWithoutExt = lastDot === -1 ? filename : filename.slice(0, lastDot);
    const thumbPath = `${dir}${filenameWithoutExt}${THUMB_SUFFIX}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from(bucket_id)
      .upload(thumbPath, thumbBytes, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      console.error("[generate-thumbnail] thumbnail upload failed:", uploadError);
      return new Response("Failed to upload thumbnail", { status: 500 });
    }

    const {
      data: { publicUrl: originalUrl },
    } = supabase.storage.from(bucket_id).getPublicUrl(objectPath);
    const {
      data: { publicUrl: thumbUrl },
    } = supabase.storage.from(bucket_id).getPublicUrl(thumbPath);

    // We don't know upfront whether this upload was a user avatar or a
    // club logo (both share the "avatars" bucket) — match by URL on both
    // tables. Exactly one of these will affect a row in practice.
    const [profileUpdate, clubUpdate] = await Promise.all([
      supabase
        .from("profiles")
        .update({ avatar_thumbnail_url: thumbUrl })
        .eq("avatar_url", originalUrl),
      supabase.from("clubs").update({ logo_thumbnail_url: thumbUrl }).eq("logo_url", originalUrl),
    ]);

    if (profileUpdate.error) {
      console.error("[generate-thumbnail] profiles update failed:", profileUpdate.error);
    }
    if (clubUpdate.error) {
      console.error("[generate-thumbnail] clubs update failed:", clubUpdate.error);
    }

    if (profileUpdate.error || clubUpdate.error) {
      // Storage upload succeeded (idempotent via upsert), so a retry from
      // the webhook is safe and won't duplicate the thumbnail file.
      return new Response("Thumbnail generated but DB update failed", { status: 500 });
    }

    return new Response(JSON.stringify({ thumbUrl }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[generate-thumbnail] unhandled error:", err);
    return new Response("Internal error", { status: 500 });
  }
});
