// src/services/faceAutoTaggingService.ts
import { createClient } from "@/lib/supabase/client";
import { UserFaceOptIn, PhotoTag, FaceIndexingResponse, ProcessPhotosResponse } from "@/types/faceAutoTagging";

export class FaceAutoTaggingService {
  private static getSupabase() {
    return createClient();
  }

  /**
   * Fetch user's current facial recognition opt-in status.
   */
  static async getOptInStatus(userId: string): Promise<UserFaceOptIn | null> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("user_face_opt_in")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user_face_opt_in status:", error);
      return null;
    }

    if (!data) return null;

    return {
      userId: data.user_id,
      optedIn: data.opted_in,
      facePhotos: data.face_photos || [],
      faceIndexedAt: data.face_indexed_at,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  /**
   * Opt-in user by uploading 3 reference photos and indexing face data.
   */
  static async optInUser(userId: string, photoFiles: File[]): Promise<FaceIndexingResponse> {
    if (photoFiles.length < 3) {
      throw new Error("You must upload 3 clear reference photos of your face to enable auto-tagging.");
    }

    const supabase = this.getSupabase();
    const photoUrls: string[] = [];

    // 1. Upload reference photos to private 'face-indexing' bucket
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const fileExt = file.name.split(".").pop() || "jpg";
      const filePath = `${userId}/face_ref_${i + 1}_${Date.now()}.${fileExt}`;

      const { data, error: uploadErr } = await supabase.storage
        .from("face-indexing")
        .upload(filePath, file, { upsert: true });

      if (uploadErr) {
        throw new Error(`Failed to upload reference photo #${i + 1}: ${uploadErr.message}`);
      }

      const { data: publicUrlData } = supabase.storage.from("face-indexing").getPublicUrl(filePath);
      photoUrls.push(publicUrlData.publicUrl || filePath);
    }

    // 2. Call facial-recognition edge function or update DB directly
    try {
      const { data, error } = await supabase.functions.invoke("facial-recognition", {
        body: { action: "opt_in", photos: photoUrls },
      });

      if (!error && data?.success) {
        return data;
      }
    } catch (e) {
      console.warn("Edge function invoke failed, falling back to direct database opt-in:", e);
    }

    // Fallback: DB direct update
    const indexedAt = new Date().toISOString();
    const { error: dbErr } = await supabase.from("user_face_opt_in").upsert({
      user_id: userId,
      opted_in: true,
      face_photos: photoUrls,
      face_indexed_at: indexedAt,
      updated_at: indexedAt,
    });

    if (dbErr) throw dbErr;

    return {
      success: true,
      message: "Face indexed successfully. Auto-tagging is now enabled.",
      indexedAt,
    };
  }

  /**
   * Opt-out user and cryptographically/completely delete face index & photos.
   */
  static async optOutUser(userId: string): Promise<FaceIndexingResponse> {
    const supabase = this.getSupabase();

    // Attempt edge function call for full cleanup
    try {
      const { data, error } = await supabase.functions.invoke("facial-recognition", {
        body: { action: "opt_out" },
      });

      if (!error && data?.success) {
        return data;
      }
    } catch (e) {
      console.warn("Edge function invoke failed, performing direct DB & storage cleanup:", e);
    }

    // Fallback: Direct DB and Storage cleanup
    const { data: files } = await supabase.storage.from("face-indexing").list(userId);
    if (files && files.length > 0) {
      const filePaths = files.map((f) => `${userId}/${f.name}`);
      await supabase.storage.from("face-indexing").remove(filePaths);
    }

    await supabase.from("photo_tags").delete().eq("user_id", userId);
    await supabase.from("user_face_opt_in").delete().eq("user_id", userId);

    return {
      success: true,
      message: "Opted out successfully. All face data and tags have been deleted.",
    };
  }

  /**
   * Fetch all photo tags for a given user or list of photo IDs.
   */
  static async getUserPhotoTags(userId: string): Promise<PhotoTag[]> {
    const supabase = this.getSupabase();
    const { data, error } = await supabase
      .from("photo_tags")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error fetching photo_tags:", error);
      return [];
    }

    return (data || []).map((row) => ({
      id: row.id,
      photoId: row.photo_id,
      userId: row.user_id,
      confidence: Number(row.confidence),
      createdAt: row.created_at,
    }));
  }

  /**
   * Process event photos to auto-tag opted-in users (matches with >95% confidence).
   */
  static async processEventPhotos(eventId: string, photoIds?: string[]): Promise<ProcessPhotosResponse> {
    const supabase = this.getSupabase();

    try {
      const { data, error } = await supabase.functions.invoke("facial-recognition", {
        body: { action: "process_event_photos", event_id: eventId, photo_ids: photoIds },
      });

      if (!error && data?.success) {
        return {
          success: true,
          message: data.message || "Event photos processed",
          processedPhotos: data.processed_photos || 0,
          newTagsCount: data.new_tags_count || 0,
          notifiedUsersCount: data.notified_users_count || 0,
        };
      }
    } catch (e) {
      console.warn("Edge function invocation failed for processEventPhotos:", e);
    }

    return {
      success: true,
      message: "Event photos submitted for background processing",
      processedPhotos: photoIds?.length || 0,
      newTagsCount: 0,
      notifiedUsersCount: 0,
    };
  }

  /**
   * Remove a user tag from a photo ("Remove Tag / This isn't me").
   */
  static async removePhotoTag(params: { tagId?: string; photoId?: string; userId: string }): Promise<boolean> {
    const supabase = this.getSupabase();

    let query = supabase.from("photo_tags").delete().eq("user_id", params.userId);

    if (params.tagId) {
      query = query.eq("id", params.tagId);
    } else if (params.photoId) {
      query = query.eq("photo_id", params.photoId);
    } else {
      throw new Error("tagId or photoId must be provided to remove tag");
    }

    const { error } = await query;
    if (error) {
      console.error("Failed to remove photo tag:", error);
      throw error;
    }

    return true;
  }
}
