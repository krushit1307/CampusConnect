/**
 * Resumable upload helper using Supabase Storage TUS endpoint.
 * This allows streaming transcoded output chunks directly to Supabase storage.
 */

interface UploadProgressCallback {
  (progress: number): void;
}

/**
 * Uploads a file/buffer to Supabase Storage using TUS resumable protocol in 5MB chunks.
 *
 * @param supabaseUrl The base Supabase project URL.
 * @param accessToken User's JWT session access token for authentication.
 * @param bucketName Target storage bucket (e.g. 'club-promotions').
 * @param objectPath Location path inside the bucket (e.g. 'club_uuid/promo.mp4').
 * @param fileData File content as ArrayBuffer or Blob.
 * @param contentType MIME type of the file.
 * @param onProgress Progress callback returning percentage (0 to 100).
 * @returns {Promise<string>} The public URL of the uploaded video.
 */
export async function uploadFileResumable(
  supabaseUrl: string,
  accessToken: string,
  bucketName: string,
  objectPath: string,
  fileData: ArrayBuffer | Blob,
  contentType: string,
  onProgress?: UploadProgressCallback,
): Promise<string> {
  const size = fileData instanceof ArrayBuffer ? fileData.byteLength : fileData.size;

  // Base64 encoding helper safe for browser environment
  const toBase64 = (str: string) => {
    return btoa(unescape(encodeURIComponent(str)));
  };

  // Build the TUS upload metadata (required keys for Supabase storage)
  const uploadMetadata = [
    `bucketName ${toBase64(bucketName)}`,
    `objectName ${toBase64(objectPath)}`,
    `contentType ${toBase64(contentType)}`,
  ].join(",");

  console.log(
    `[Resumable Upload] Starting session for ${bucketName}/${objectPath} (${size} bytes)`,
  );

  // 1. Create a TUS upload session
  const initRes = await fetch(`${supabaseUrl}/storage/v1/upload/resumable`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Tus-Resumable": "1.0.0",
      "Upload-Length": size.toString(),
      "Upload-Metadata": uploadMetadata,
    },
  });

  if (!initRes.ok) {
    const errorText = await initRes.text();
    throw new Error(`Failed to initialize resumable upload: ${initRes.status} - ${errorText}`);
  }

  let uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) {
    throw new Error("No upload session Location header returned by Supabase resumable API");
  }

  // Resolve relative URLs returned in local development or custom domains
  if (uploadUrl.startsWith("/")) {
    const parsedSupabase = new URL(supabaseUrl);
    uploadUrl = `${parsedSupabase.origin}${uploadUrl}`;
  }

  // 2. Stream chunk uploads (5MB chunks)
  const chunkSize = 5 * 1024 * 1024;
  let offset = 0;

  while (offset < size) {
    const end = Math.min(offset + chunkSize, size);
    let chunk: ArrayBuffer;

    if (fileData instanceof ArrayBuffer) {
      chunk = fileData.slice(offset, end);
    } else {
      chunk = await fileData.slice(offset, end).arrayBuffer();
    }

    const chunkRes = await fetch(uploadUrl, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": offset.toString(),
        "Content-Type": "application/offset+octet-stream",
      },
      body: chunk,
    });

    if (!chunkRes.ok) {
      const errorText = await chunkRes.text();
      throw new Error(
        `Failed to upload chunk at offset ${offset}: ${chunkRes.status} - ${errorText}`,
      );
    }

    offset = end;
    if (onProgress) {
      onProgress(Math.round((offset / size) * 100));
    }
  }

  console.log(`[Resumable Upload] Upload complete for ${bucketName}/${objectPath}`);

  // Return the public URL of the uploaded object
  return `${supabaseUrl}/storage/v1/object/public/${bucketName}/${objectPath}`;
}
