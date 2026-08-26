// supabase/functions/generate-upload-url/index.ts
//
// Generates a temporary, pre-signed upload URL for a storage object using the
// Supabase Admin SDK (service-role client). The browser then PUTs the raw file
// straight to Supabase Storage, completely bypassing our Node.js server.
//
// Issue #1999: [FEATURE] Refactor image uploads to use signed multipart S3 uploads

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.110.0";
import { z } from "https://esm.sh/zod@3.24.2";
import { verifyAuth } from "../shared/auth-middleware.ts";
import { parseJsonBody, corsHeaders } from "../_shared/validation.ts";

const MAX_IMAGE_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB (see issue testing requirements)

const ALLOWED_IMAGE_BUCKETS = new Set(["avatars", "event-gallery", "event-galleries"]);

const ALLOWED_IMAGE_CONTENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

const generateUploadUrlSchema = z
  .object({
    bucket: z.string().min(1).max(64),
    path: z.string().min(1).max(512),
    contentType: z.string().min(1).max(128),
    size: z.number().int().positive().max(MAX_IMAGE_SIZE_BYTES),
  })
  .strict();

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Reject path traversal and absolute paths so clients can't escape the bucket.
function isSafePath(path: string): boolean {
  if (path.startsWith("/") || path.includes("\\")) return false;
  return !path.split("/").some((segment) => segment === ".." || segment === ".");
}

export async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[generate-upload-url] SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
      return jsonResponse({ error: "Server misconfigured" }, 500);
    }

    if (req.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    let user;
    try {
      user = await verifyAuth(req, supabase);
    } catch {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const parsed = await parseJsonBody(generateUploadUrlSchema, req);
    if (!parsed.ok) return parsed.response;
    const { bucket, path, contentType, size } = parsed.data;

    if (!ALLOWED_IMAGE_BUCKETS.has(bucket)) {
      return jsonResponse({ error: `Bucket '${bucket}' is not allowed for image uploads` }, 400);
    }
    if (!ALLOWED_IMAGE_CONTENT_TYPES.has(contentType.toLowerCase())) {
      return jsonResponse({ error: `Content type '${contentType}' is not allowed` }, 400);
    }
    if (!isSafePath(path)) {
      return jsonResponse({ error: "Invalid path" }, 400);
    }
    if (size > MAX_IMAGE_SIZE_BYTES) {
      return jsonResponse(
        { error: `File too large (max ${MAX_IMAGE_SIZE_BYTES / (1024 * 1024)} MB)` },
        400,
      );
    }

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path, { upsert: true });

    if (error || !data) {
      console.error("[generate-upload-url] createSignedUploadUrl failed:", error);
      return jsonResponse(
        { error: `Failed to create signed upload URL: ${error?.message ?? "unknown error"}` },
        500,
      );
    }

    return jsonResponse(
      {
        uploadUrl: data.signedUrl,
        token: data.token,
        path: data.path,
        bucket,
      },
      200,
    );
  } catch (err) {
    console.error("[generate-upload-url] unhandled error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
}

if (import.meta.main) {
  serve(handler);
}
