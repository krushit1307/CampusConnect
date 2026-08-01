/**
 * Upload a file to Supabase Storage via XHR with progress tracking.
 *
 * Previously duplicated inside `src/routes/settings.tsx` and
 * `src/components/CreateClubDialog.tsx`. Centralised here so every
 * upload flow can share the same implementation.
 */
export function uploadFileWithProgress(
  supabaseUrl: string,
  accessToken: string,
  bucket: string,
  path: string,
  file: File,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${supabaseUrl}/storage/v1/object/${bucket}/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onProgress(Math.round((event.loaded / event.total) * 100));
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
