// src/lib/imageTagger.ts
//
// Frontend client for the Lost & Found image auto-tagger (Issue #2912).
//
// Compresses an uploaded image to a small WebP thumbnail, sends it
// to the `lost-found-auto-tag` Edge Function, and returns the
// resulting tags + PII status.

const MAX_THUMBNAIL_WIDTH = 512;
const WEBP_QUALITY = 0.7;
const MAX_BASE64_LENGTH = 1_500_000; // ~1.1 MB binary after base64 inflation

export interface AutoTagResult {
  tags: string[];
  hasPii: boolean;
  piiReason?: string;
}

export interface AutoTagError {
  error: string;
  detail?: string;
}

/**
 * Compress an image File to a WebP thumbnail via the browser's
 * Canvas API. Returns a base64 string + MIME type.
 *
 * This drastically reduces the image size before sending to the
 * Vision API — e.g. a 4 MB iPhone photo becomes a ~50 KB WebP
 * thumbnail, cutting the OpenAI token cost by ~99%.
 */
async function compressImage(file: File): Promise<{ base64: string; mimeType: string }> {
  // Read the file into an HTMLImageElement.
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const el = new Image();
    el.onload = () => {
      URL.revokeObjectURL(url);
      resolve(el);
    };
    el.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image. The file may be corrupted."));
    };
    el.src = url;
  });

  // Scale down so the longest side is MAX_THUMBNAIL_WIDTH.
  const scale = Math.min(1, MAX_THUMBNAIL_WIDTH / Math.max(img.width, img.height));
  const targetWidth = Math.round(img.width * scale);
  const targetHeight = Math.round(img.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not get canvas context for image compression.");
  }
  ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

  // Try WebP first; fall back to JPEG for older Safari.
  let mimeType = "image/webp";
  let dataUrl = canvas.toDataURL(mimeType, WEBP_QUALITY);
  if (dataUrl === "data:,") {
    // WebP not supported — fall back to JPEG.
    mimeType = "image/jpeg";
    dataUrl = canvas.toDataURL(mimeType, WEBP_QUALITY);
  }

  const base64 = dataUrl.split(",")[1];
  if (!base64) {
    throw new Error("Failed to encode compressed image.");
  }

  // If the compressed base64 is still too large, reduce quality further.
  let finalBase64 = base64;
  let finalMimeType = mimeType;
  if (base64.length > MAX_BASE64_LENGTH) {
    finalMimeType = "image/jpeg";
    const reduced = canvas.toDataURL(finalMimeType, 0.4);
    finalBase64 = reduced.split(",")[1];
  }

  return { base64: finalBase64, mimeType: finalMimeType };
}

/**
 * Send an image File to the lost-found-auto-tag Edge Function
 * and get back auto-generated tags + PII status.
 *
 * The function:
 *   1. Compresses the image to a ~512px WebP thumbnail.
 *   2. Sends the base64 thumbnail to the Edge Function.
 *   3. The Edge Function calls OpenAI GPT-4o Vision and returns
 *      { tags: string[], hasPii: boolean, piiReason?: string }.
 *
 * If `hasPii` is true, the caller MUST reject the image and warn
 * the user to blur sensitive data before re-uploading.
 */
export async function autoTagImage(
  file: File,
): Promise<{ ok: true; result: AutoTagResult } | { ok: false; error: AutoTagError }> {
  let compressed: { base64: string; mimeType: string };
  try {
    compressed = await compressImage(file);
  } catch (err) {
    return {
      ok: false,
      error: {
        error: err instanceof Error ? err.message : "Image compression failed.",
      },
    };
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !anonKey) {
    return {
      ok: false,
      error: { error: "Supabase URL or anon key not configured." },
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/lost-found-auto-tag`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({
        imageBase64: compressed.base64,
        mimeType: compressed.mimeType,
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      return {
        ok: false,
        error: {
          error: errBody.error ?? `Server returned ${response.status}`,
          detail: errBody.detail,
        },
      };
    }

    const data: AutoTagResult = await response.json();
    return {
      ok: true,
      result: {
        tags: data.tags ?? [],
        hasPii: Boolean(data.hasPii),
        piiReason: data.piiReason,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        error: "Network error while contacting the auto-tag service.",
        detail: err instanceof Error ? err.message : String(err),
      },
    };
  }
}
