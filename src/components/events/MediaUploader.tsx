import React, { useState } from "react";
import { supabase } from "@/utils/supabaseClient";

interface MediaUploaderProps {
  eventId: string;
  userId: string;
}

export const MediaUploader: React.FC<MediaUploaderProps> = ({ eventId, userId }) => {
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setStatusMessage("Uploading and scanning photos...");

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = file.name.split(".").pop();
      const filePath = `${eventId}/${userId}_${Date.now()}_${i}.${fileExt}`;

      // 1. Upload to Supabase Storage bucket 'event-media'
      const { error: uploadErr } = await supabase.storage
        .from("event-media")
        .upload(filePath, file);

      if (uploadErr) {
        console.error("Storage upload failed:", uploadErr);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("event-media")
        .getPublicUrl(filePath);

      // 2. Invoke Edge Function for AI Moderation & Realtime Broadcast
      await supabase.functions.invoke("moderate-and-broadcast-media", {
        body: {
          event_id: eventId,
          user_id: userId,
          media_url: urlData.publicUrl,
        },
      });
    }

    setUploading(false);
    setStatusMessage("Photos beamed to the projector!");
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div className="p-4 bg-gray-900 text-white rounded-2xl shadow-lg border border-gray-800">
      <h3 className="text-lg font-bold mb-2">Beam Photos to Live Projector</h3>
      <p className="text-xs text-gray-400 mb-4">Select multiple concert photos from your camera roll.</p>

      <label className="flex items-center justify-center w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 font-semibold rounded-xl cursor-pointer transition">
        <span>{uploading ? "Beam in progress..." : "📷 Select / Take Photos"}</span>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
      </label>

      {statusMessage && (
        <div className="mt-3 text-center text-xs text-indigo-400 font-medium">
          {statusMessage}
        </div>
      )}
    </div>
  );
};
