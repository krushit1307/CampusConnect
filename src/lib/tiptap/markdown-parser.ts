/**
 * Frontend utility to interact with the Markdown to Tiptap Edge Function.
 */

import { supabase } from '../supabase/client';

export interface TiptapParseResponse {
  success: boolean;
  data?: any;
  error?: string;
  fileName?: string;
}

/**
 * Uploads a Markdown file to the Edge Function and returns the parsed Tiptap JSON.
 * 
 * @param file - The File object selected by the user.
 * @returns A promise resolving to the Tiptap JSON structure or an error.
 */
export async function parseMarkdownToTiptap(file: File): Promise<TiptapParseResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    // Invoke the Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('markdown-to-tiptap', {
      body: formData,
      // Do not set Content-Type header manually; the browser will set it with the correct boundary
    });

    if (error) {
      console.error('Edge function invocation error:', error);
      return { success: false, error: error.message };
    }

    if (!data.success) {
      return { success: false, error: data.error || 'Unknown parsing error' };
    }

    return { success: true, data: data.data, fileName: data.fileName };
  } catch (err: any) {
    console.error('Unexpected error in parseMarkdownToTiptap:', err);
    return { success: false, error: err.message || 'Network error' };
  }
}
