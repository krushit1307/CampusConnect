// src/services/eventSubmissionService.ts
import { createClient } from "@/lib/supabase/client";
import {
  EventSubmission,
  UploadSubmissionOptions,
  isValidSubmissionFileType,
} from "@/types/eventSubmission";

export class EventSubmissionService {
  private static getSupabase() {
    return createClient();
  }

  /**
   * Fetch a user's submission for a given event.
   */
  static async getUserSubmission(
    eventId: string,
    userId: string
  ): Promise<EventSubmission | null> {
    if (!eventId || !userId) return null;
    const supabase = this.getSupabase();

    const { data, error } = await supabase
      .from("event_submissions")
      .select("*")
      .eq("event_id", eventId)
      .eq("user_id", userId)
      .maybeSingle();

    if (error && error.code !== "PGRST116") {
      console.error("Error fetching user submission:", error);
      throw error;
    }

    return data as EventSubmission | null;
  }

  /**
   * Fetch all submissions for an event (Organizer view).
   */
  static async getEventSubmissions(eventId: string): Promise<EventSubmission[]> {
    if (!eventId) return [];
    const supabase = this.getSupabase();

    const { data, error } = await supabase
      .from("event_submissions")
      .select(`
        *,
        profiles ( first_name, last_name, handle, avatar_url )
      `)
      .eq("event_id", eventId)
      .order("submitted_at", { ascending: false });

    if (error) {
      console.error("Error fetching event submissions:", error);
      throw error;
    }

    return (data || []) as EventSubmission[];
  }

  /**
   * Upload or replace a file submission for an event.
   * Handles deleting previous file if resubmitting.
   */
  static async uploadSubmission(options: UploadSubmissionOptions): Promise<EventSubmission> {
    const { eventId, userId, file, teamName, onProgress } = options;

    if (!isValidSubmissionFileType(file)) {
      throw new Error("Invalid file type. Only .pdf, .zip, and .pptx files are allowed.");
    }

    const supabase = this.getSupabase();

    // 1. Check if an existing submission exists
    const existing = await this.getUserSubmission(eventId, userId);

    // 2. If resubmitting, delete the previous file from storage first
    if (existing && existing.storage_path) {
      try {
        await supabase.storage.from("event-submissions").remove([existing.storage_path]);
      } catch (err) {
        console.warn("Failed to delete previous submission file from storage:", err);
      }
    }

    // 3. Upload file to Supabase Storage bucket 'event-submissions'
    const sanitizeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const storagePath = `${eventId}/${userId}/${Date.now()}_${sanitizeName}`;

    // Simulate progress updates if callback provided
    if (onProgress) onProgress(15);

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("event-submissions")
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      throw new Error(`Failed to upload file: ${uploadError.message}`);
    }

    if (onProgress) onProgress(60);

    // 4. Get file URL
    const { data: urlData } = supabase.storage
      .from("event-submissions")
      .getPublicUrl(uploadData.path);

    const fileUrl = urlData?.publicUrl || uploadData.path;

    if (onProgress) onProgress(85);

    // 5. Insert or Update event_submissions database record
    const payload = {
      event_id: eventId,
      user_id: userId,
      team_name: teamName?.trim() || null,
      file_url: fileUrl,
      storage_path: uploadData.path,
      file_name: file.name,
      file_size: file.size,
      file_type: file.type || "application/octet-stream",
      updated_at: new Date().toISOString(),
    };

    const { data: dbData, error: dbError } = await supabase
      .from("event_submissions")
      .upsert(payload, { onConflict: "event_id,user_id" })
      .select()
      .single();

    if (dbError) {
      // Clean up uploaded file if DB insert fails
      await supabase.storage.from("event-submissions").remove([uploadData.path]);
      console.error("Database submission error:", dbError);
      throw new Error(dbError.message || "Failed to record submission in database.");
    }

    if (onProgress) onProgress(100);

    return dbData as EventSubmission;
  }

  /**
   * Delete a submission and its associated storage file.
   */
  static async deleteSubmission(submissionId: string, storagePath: string): Promise<void> {
    const supabase = this.getSupabase();

    if (storagePath) {
      await supabase.storage.from("event-submissions").remove([storagePath]);
    }

    const { error } = await supabase
      .from("event_submissions")
      .delete()
      .eq("id", submissionId);

    if (error) {
      throw error;
    }
  }

  /**
   * Generate a signed download URL for a submission file.
   */
  static async getDownloadUrl(storagePath: string): Promise<string> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase.storage
      .from("event-submissions")
      .createSignedUrl(storagePath, 3600);

    if (error || !data?.signedUrl) {
      throw new Error(error?.message || "Failed to generate download link");
    }

    return data.signedUrl;
  }

  /**
   * Download all submissions for an event as a ZIP archive using the Edge Function.
   */
  static async downloadAllSubmissionsZip(eventId: string): Promise<void> {
    const supabase = this.getSupabase();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    if (!token) {
      throw new Error("You must be logged in to download submissions.");
    }

    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL || ""}/functions/v1/bulk-download-submissions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId }),
      }
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error || "Failed to generate submissions ZIP archive.");
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Event_Submissions_${eventId.slice(0, 8)}.zip`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }
}
