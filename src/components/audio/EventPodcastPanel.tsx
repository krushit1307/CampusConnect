import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Loader2, UploadCloud, Headphones, Play, Clock, Users, CheckCircle2 } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

const ALLOWED_AUDIO_TYPES = ["audio/mpeg", "audio/mp4", "audio/x-m4a"];
const ALLOWED_EXTENSIONS = [".mp3", ".m4a"];
const MAX_AUDIO_SIZE = 100 * 1024 * 1024; // 100MB

interface EventPodcastPanelProps {
  eventId: string;
}

export function EventPodcastPanel({ eventId }: EventPodcastPanelProps) {
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [eventData, setEventData] = useState<any>(null);
  const [analytics, setAnalytics] = useState({
    totalListens: 0,
    uniqueUsers: 0,
    avgTime: 0,
    completionRate: 0,
  });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const { playTrack, currentTrack, isPlaying } = useAudioStore();

  const fetchData = async () => {
    setLoading(true);
    // Get event and club info for track playback
    const { data: event } = await supabase
      .from("events")
      .select("*, clubs(name, logo_url)")
      .eq("id", eventId)
      .single();

    if (event) setEventData(event);

    // Get Analytics
    const { data: listens } = await supabase
      .from("event_audio_listens")
      .select("user_id, listened_seconds, completed")
      .eq("event_id", eventId);

    if (listens && listens.length > 0) {
      const total = listens.length;
      const unique = new Set(listens.map((l) => l.user_id)).size;
      const avg = listens.reduce((acc, l) => acc + l.listened_seconds, 0) / total;
      const completed = listens.filter((l) => l.completed).length;

      setAnalytics({
        totalListens: total,
        uniqueUsers: unique,
        avgTime: Math.round(avg),
        completionRate: Math.round((completed / total) * 100),
      });
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [eventId]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      const fileExtension = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();

      if (!ALLOWED_AUDIO_TYPES.includes(file.type) && !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        toast.error("Unsupported file type. Please upload .mp3 or .m4a files only.");
        return;
      }

      if (file.size > MAX_AUDIO_SIZE) {
        toast.error("File is too large. Maximum size is 100MB.");
        return;
      }

      await uploadAudio(file);
    }
  };

  const uploadAudio = async (file: File) => {
    setUploading(true);
    toast.info("Uploading recording...");

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${eventData?.club_id}/${eventId}/${Date.now()}.${fileExt}`;

      const { error: uploadError, data } = await supabase.storage
        .from("event_audio")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from("event_audio").getPublicUrl(filePath); // wait, event_audio is not public, we need signed url or download

      // Actually, since it's an audio player, it needs a valid URL to stream.
      // If public=false, we either have to use a signed URL that lasts for a long time,
      // or change the bucket to public. The prompt says bucket public=false, and RLS allows authenticated users to select.
      // To stream from a private bucket via HTML5 audio src, the browser needs the authorization header, which <audio> doesn't support easily.
      // A common workaround is using Supabase's `getPublicUrl` but wait, it's private.
      // Supabase supports downloading with token, or createSignedUrl.
      // For this implementation, we'll store the `filePath` in `audio_recording_url` and let the player component generate a signed URL, or we can use Supabase's `createSignedUrl` temporarily.
      // Let's store the `filePath` itself in the column.

      const { error: updateError } = await supabase
        .from("events")
        .update({
          audio_recording_url: filePath,
          audio_uploaded_at: new Date().toISOString(),
        })
        .eq("id", eventId);

      if (updateError) throw updateError;

      toast.success("Recording uploaded successfully!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to upload recording");
    } finally {
      setUploading(false);
    }
  };

  const handlePlay = async () => {
    if (!eventData?.audio_recording_url) return;

    try {
      // Generate a signed URL valid for 2 hours
      const { data, error } = await supabase.storage
        .from("event_audio")
        .createSignedUrl(eventData.audio_recording_url, 7200);

      if (error) throw error;

      playTrack({
        url: data.signedUrl,
        eventId: eventId,
        title: eventData.title,
        clubName: eventData.clubs?.name,
        clubLogo: eventData.clubs?.logo_url,
      });
    } catch (err: any) {
      toast.error("Could not play track");
    }
  };

  if (loading)
    return (
      <div className="p-8 flex justify-center">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );

  return (
    <div className="mt-8 border-2 border-black bg-blue-50 p-6 shadow-[4px_4px_0_0_#000]">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Headphones size={24} />
          <h2 className="font-display text-2xl font-black uppercase">Podcast Recording</h2>
        </div>

        {!eventData?.audio_recording_url && (
          <div>
            <Button
              className="gap-2 bg-black hover:bg-black/80"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <UploadCloud className="w-4 h-4" />
              )}
              {uploading ? "Uploading..." : "Upload .mp3"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".mp3,.m4a,audio/mpeg,audio/mp4,audio/x-m4a"
              onChange={handleFileChange}
            />
          </div>
        )}
      </div>

      {eventData?.audio_recording_url ? (
        <div className="space-y-6">
          {/* Player controls in dashboard */}
          <div className="bg-white p-4 border-2 border-black flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                size="icon"
                onClick={handlePlay}
                className="rounded-full w-12 h-12 bg-black hover:bg-black/80 text-white"
              >
                <Play className="w-6 h-6 ml-1" />
              </Button>
              <div>
                <p className="font-bold text-lg">{eventData.title}</p>
                <p className="text-sm text-gray-500">
                  Uploaded {new Date(eventData.audio_uploaded_at).toLocaleDateString()}
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Replace File"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".mp3,.m4a"
              onChange={handleFileChange}
            />
          </div>

          {/* Analytics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white p-4 border-2 border-black">
              <p className="font-mono text-xs font-bold uppercase text-gray-500">Total Plays</p>
              <p className="text-3xl font-black mt-2 flex items-center gap-2">
                <Headphones className="w-6 h-6 text-blue-500" />
                {analytics.totalListens}
              </p>
            </div>
            <div className="bg-white p-4 border-2 border-black">
              <p className="font-mono text-xs font-bold uppercase text-gray-500">
                Unique Listeners
              </p>
              <p className="text-3xl font-black mt-2 flex items-center gap-2">
                <Users className="w-6 h-6 text-green-500" />
                {analytics.uniqueUsers}
              </p>
            </div>
            <div className="bg-white p-4 border-2 border-black">
              <p className="font-mono text-xs font-bold uppercase text-gray-500">Avg Duration</p>
              <p className="text-3xl font-black mt-2 flex items-center gap-2">
                <Clock className="w-6 h-6 text-amber-500" />
                {Math.floor(analytics.avgTime / 60)}m {analytics.avgTime % 60}s
              </p>
            </div>
            <div className="bg-white p-4 border-2 border-black">
              <p className="font-mono text-xs font-bold uppercase text-gray-500">Completion</p>
              <p className="text-3xl font-black mt-2 flex items-center gap-2">
                <CheckCircle2 className="w-6 h-6 text-purple-500" />
                {analytics.completionRate}%
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-12 bg-white border-2 border-black border-dashed">
          <Headphones className="w-12 h-12 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-bold">No Recording Available</h3>
          <p className="text-gray-500 mt-2 max-w-sm mx-auto">
            Upload an .mp3 or .m4a recording of this event to allow students to listen to it as a
            podcast.
          </p>
        </div>
      )}
    </div>
  );
}
