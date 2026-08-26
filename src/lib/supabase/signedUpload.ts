/**
 * Signed-URL image upload helper (issue #1999).
 *
 * Upload flow:
 *  1. Call the `generate-upload-url` edge function to obtain a temporary,
 *     pre-signed upload URL (generated server-side with the Supabase Admin SDK).
 *  2. PUT the raw file bytes straight to Supabase Storage using that URL,
 *     completely bypassing our Node.js server.
 *  3. Return the object's public URL for the caller to persist in the DB.
 */
import { createClient } from "@/lib/supabase/client";

export interface SignedUploadUrl {
  uploadUrl: string;
  token: string;
  path: string;
  bucket: string;
}

export interface SignedUploadResult {
  uploadUrl: string;
  token: string;
  path: string;
  bucket: string;
}

/**
 * Request a temporary signed upload URL from the backend edge function.
 * The edge function authenticates the caller and validates bucket/path/size.
 */
export async function getSignedUploadUrl(
  bucket: string,
  path: string,
  contentType: string,
  size: number,
): Promise<SignedUploadUrl> {
  const supabase = createClient();

  const { data, error } = await supabase.functions.invoke<SignedUploadResult>(
    "generate-upload-url",
    {
      body: { bucket, path, contentType, size },
    },
  );

  if (error) {
    throw new Error(`Failed to create upload URL: ${error.message}`);
  }
  if (!data?.uploadUrl) {
    throw new Error("Failed to create upload URL: backend returned no URL.");
  }

  return {
    uploadUrl: data.uploadUrl,
    token: data.token,
    path: data.path,
    bucket: data.bucket,
  };
}

/**
 * PUT the raw file body to the pre-signed Supabase storage URL via XHR so we
 * get upload-progress events. Nothing is proxied through our own server.
 */
export function uploadToSignedUrl(
  uploadUrl: string,
  file: Blob,
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "true");

    if (abortSignal) {
      abortSignal.addEventListener("abort", () => {
        xhr.abort();
        reject(new Error("Upload cancelled"));
      });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error("Upload failed due to a network error"));
    };

    xhr.send(file);
  });
}

/**
 * End-to-end image upload: request a signed URL, PUT the file, then resolve
 * with the object's public URL (ready to store in the database).
 */
export async function uploadImageWithSignedUrl(
  bucket: string,
  path: string,
  file: Blob,
  onProgress?: (percent: number) => void,
  abortSignal?: AbortSignal,
): Promise<string> {
  const contentType = file.type || "application/octet-stream";
  const { uploadUrl } = await getSignedUploadUrl(bucket, path, contentType, file.size);

  await uploadToSignedUrl(uploadUrl, file, onProgress, abortSignal);

  const supabase = createClient();
  const {
    data: { publicUrl },
  } = supabase.storage.from(bucket).getPublicUrl(path);

  return publicUrl;
}
