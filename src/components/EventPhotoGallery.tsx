import React, { useState, useRef } from "react";
import { useQuery, useMutation } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Camera, X, Loader2, Trash2 } from "lucide-react";

interface EventPhotoGalleryProps {
  eventId: string;
  user: User | null;
}

export function EventPhotoGallery({ eventId, user }: EventPhotoGalleryProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);

  const {
    data: photos,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["event_photos", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_photos")
        .select("id, url, user_id, created_at, profiles(full_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Must be logged in to upload");

      const fileExt = file.name.split(".").pop();
      const fileName = `${eventId}/${user.id}-${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("event-galleries")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from("event-galleries")
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase.from("event_photos").insert({
        event_id: eventId,
        user_id: user.id,
        url: publicUrlData.publicUrl,
      });

      if (dbError) throw dbError;
    },
    onSuccess: () => {
      toast.success("Photo uploaded successfully!");
      refetch();
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to upload photo");
    },
    onSettled: () => {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ photoId, url }: { photoId: string; url: string }) => {
      if (!user) throw new Error("Must be logged in");

      // Extract file path from public URL
      const pathParts = url.split("/event-galleries/");
      if (pathParts.length > 1) {
        const filePath = pathParts[1];
        await supabase.storage.from("event-galleries").remove([filePath]);
      }

      const { error } = await supabase
        .from("event_photos")
        .delete()
        .eq("id", photoId)
        .eq("user_id", user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Photo deleted");
      refetch();
      setSelectedPhoto(null);
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete photo"),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be under 5MB");
      return;
    }
    setUploading(true);
    uploadMutation.mutate(file);
  };

  if (isLoading) {
    return <div className="animate-pulse h-64 bg-gray-200 w-full mb-8" />;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display text-2xl font-bold uppercase text-blue-900">
          Attendee Gallery
        </h3>

        {user && (
          <div>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileChange}
              disabled={uploading}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="neu-border neu-press flex items-center gap-2 bg-[#FFD166] px-4 py-2 font-mono text-sm font-bold uppercase transition-transform hover:-translate-y-1 disabled:opacity-50"
            >
              {uploading ? <Loader2 className="animate-spin" size={18} /> : <Camera size={18} />}
              {uploading ? "Uploading..." : "Add Photo"}
            </button>
          </div>
        )}
      </div>

      {!photos || photos.length === 0 ? (
        <div className="neu-border bg-gray-50 p-8 text-center font-mono text-sm text-gray-500">
          No photos yet. Be the first to add one!
        </div>
      ) : (
        <div className="columns-2 sm:columns-3 md:columns-4 gap-4 space-y-4">
          {photos.map(
            (photo: {
              id: string;
              url: string;
              user_id: string;
              profiles: { full_name: string } | { full_name: string }[];
            }) => (
              <div
                key={photo.id}
                className="break-inside-avoid cursor-pointer group relative"
                onClick={() => setSelectedPhoto(photo.url)}
              >
                <img
                  src={photo.url}
                  alt="Event memory"
                  className="w-full h-auto object-cover neu-border transition-transform hover:scale-[1.02]"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2 pointer-events-none">
                  <span className="text-white font-mono text-xs truncate drop-shadow-md">
                    {Array.isArray(photo.profiles)
                      ? photo.profiles[0]?.full_name
                      : (photo.profiles as { full_name: string })?.full_name || "Anonymous"}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      )}

      {/* Lightbox */}
      {selectedPhoto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setSelectedPhoto(null)}
          >
            <X size={32} />
          </button>

          <img
            src={selectedPhoto}
            alt="Expanded view"
            className="max-w-full max-h-[90vh] object-contain neu-border"
          />

          {user &&
            photos?.find((p: { url: string; user_id: string }) => p.url === selectedPhoto)
              ?.user_id === user.id && (
              <button
                onClick={() => {
                  const p = photos?.find(
                    (ph: { url: string; id: string }) => ph.url === selectedPhoto,
                  );
                  if (p) deleteMutation.mutate({ photoId: p.id, url: p.url });
                }}
                className="absolute bottom-6 right-6 neu-border flex items-center gap-2 bg-red-500 text-white px-4 py-2 font-mono text-sm font-bold uppercase hover:bg-red-600 transition-colors"
              >
                <Trash2 size={16} /> Delete My Photo
              </button>
            )}
        </div>
      )}
    </div>
  );
}
