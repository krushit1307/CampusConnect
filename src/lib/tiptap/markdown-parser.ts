/**
 * Frontend utility to interact with the Markdown to Tiptap Edge Function.
 */

import { supabase } from "../supabase/client";

export interface TiptapParseResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
  fileName?: string;
}

/**
 * Uploads a Markdown file to the Edge Function and returns the parsed Tiptap JSON.
 *
 * @param file - The File object selected by the user.
 * @param onProgress - Optional callback for upload progress.
 * @returns A promise resolving to the Tiptap JSON structure or an error.
 */
export async function parseMarkdownToTiptap(
  file: File,
  onProgress?: (percent: number) => void
): Promise<TiptapParseResponse> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not logged in");

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `${supabaseUrl}/functions/v1/markdown-to-tiptap`);
      xhr.setRequestHeader("Authorization", `Bearer ${session.access_token}`);
      
      const formData = new FormData();
      formData.append("file", file);

      if (onProgress) {
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        };
      }

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            if (!data.success) {
              resolve({ success: false, error: data.error || "Unknown parsing error" });
            } else {
              resolve({ success: true, data: data.data, fileName: data.fileName });
            }
          } catch (e) {
            resolve({ success: false, error: "Invalid JSON response" });
          }
        } else {
          resolve({ success: false, error: `Error ${xhr.status}: ${xhr.statusText}` });
        }
      };

      xhr.onerror = () => {
        resolve({ success: false, error: "Network error during upload" });
      };

      xhr.send(formData);
    });
  } catch (err: any) {
    console.error("Unexpected error in parseMarkdownToTiptap:", err);
    return { success: false, error: err.message || "Network error" };
  }
}
