// =============================================================================
// Hook: useVideoUpload
// Issue: #2402 - Async generation of looping video previews via FFmpeg
// Description: Handles video file upload to Supabase Storage and triggers
// the background job for preview generation.
// =============================================================================

import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

interface UseVideoUploadReturn {
  uploadVideo: (file: File, eventId: string) => Promise<string | null>;
  isUploading: boolean;
  progress: number;
  error: string | null;
}

export function useVideoUpload(): UseVideoUploadReturn {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadVideo = async (file: File, eventId: string): Promise<string | null> => {
    setIsUploading(true);
    setError(null);
    setProgress(0);

    try {
      // Validate file type
      if (!file.type.startsWith("video/")) {
        throw new Error("Please select a valid video file");
      }

      // Validate file size (max 500MB)
      const maxSize = 500 * 1024 * 1024;
      if (file.size > maxSize) {
        throw new Error("Video file size must be less than 500MB");
      }

      // Generate unique file name
      const fileExt = file.name.split(".").pop();
      const fileName = `${eventId}_${Date.now()}.${fileExt}`;
      const filePath = `videos/${fileName}`;

      // Upload to Supabase Storage with progress tracking
      const { data, error: uploadError } = await supabase.storage
        .from("event-banners")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          onUploadProgress: (progressEvent) => {
            const percent = (progressEvent.loaded / progressEvent.total) * 100;
            setProgress(Math.round(percent));
          },
        });

      if (uploadError) throw uploadError;

      // Get public URL of the uploaded video
      const {
        data: { publicUrl },
      } = supabase.storage.from("event-banners").getPublicUrl(filePath);

      // Trigger background job for preview generation
      // In production, this would push to BullMQ via an Edge Function or DB webhook
      const { error: jobError } = await supabase.from("background_jobs").insert({
        queue_name: "video-preview-queue",
        payload: {
          eventId,
          videoUrl: publicUrl,
          userId: (await supabase.auth.getUser()).data.user?.id,
        },
      });

      if (jobError) {
        console.warn("Failed to queue preview generation job:", jobError);
        // Don't fail the entire upload if job queue fails
      }

      setProgress(100);
      return publicUrl;
    } catch (err: any) {
      setError(err.message || "Failed to upload video");
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return { uploadVideo, isUploading, progress, error };
}
