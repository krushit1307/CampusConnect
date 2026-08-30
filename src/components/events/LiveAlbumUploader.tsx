import { useState, useRef } from "react";
import { uploadFileWithProgress } from "../../lib/supabase/uploadFileWithProgress";
// Adjust the import below based on where the supabase client is initialized in CampusConnect
import { supabase } from "../../lib/supabase/client"; 

interface LiveAlbumUploaderProps {
  eventId: string;
  onUploadComplete: (imageUrl: string) => void; // We will use this next for Supabase Realtime!
}

export function LiveAlbumUploader({ eventId, onUploadComplete }: LiveAlbumUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoCapture = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setProgress(0);

    try {
      // 1. Get the current user's session token
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // 2. Generate a unique file path: eventId/timestamp-filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `events/${eventId}/${fileName}`;
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL; // Assuming standard Vite env vars
      const bucketName = "live-album-photos"; // Make sure to create this bucket in Supabase!

      // 3. Upload using their utility
      await uploadFileWithProgress(
        supabaseUrl,
        session.access_token,
        bucketName,
        filePath,
        file,
        (percent) => setProgress(percent)
      );

      // 4. Get the public URL to display on the projector
      const { data: publicUrlData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath);

      // Pass the URL up to be broadcasted
      onUploadComplete(publicUrlData.publicUrl);

    } catch (error) {
      console.error("Failed to upload photo:", error);
      alert("Failed to upload photo. Please try again.");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-50 dark:bg-slate-900 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700">
      {isUploading ? (
        <div className="w-full space-y-3">
          <p className="text-center font-medium text-slate-700 dark:text-slate-200">
            Uploading to Projector... {progress}%
          </p>
          <div className="w-full bg-slate-200 rounded-full h-2.5 dark:bg-slate-700">
            <div 
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-300" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      ) : (
        <>
          <label 
            htmlFor="camera-input" 
            className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-full shadow-lg transition-transform transform active:scale-95 flex items-center gap-3"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            Tap to Snap
          </label>
          {/* capture="environment" forces the back camera on mobile devices! */}
          <input
            id="camera-input"
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            ref={fileInputRef}
            onChange={handlePhotoCapture}
          />
        </>
      )}
    </div>
  );
}
