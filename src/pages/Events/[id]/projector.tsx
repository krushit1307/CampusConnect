import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/utils/supabaseClient";

interface MediaItem {
  id: string;
  media_url: string;
  created_at: string;
}

export default function ProjectorPage() {
  const router = useRouter();
  const { id: eventId } = router.query;
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);

  useEffect(() => {
    if (!eventId) return;

    // Fetch initial approved media
    const fetchInitialMedia = async () => {
      const { data } = await supabase
        .from("event_live_stream_media")
        .select("id, media_url, created_at")
        .eq("event_id", eventId)
        .eq("status", "approved")
        .order("created_at", { ascending: false })
        .limit(30);

      if (data) setMediaList(data);
    };

    fetchInitialMedia();

    // Subscribe to real-time additions for approved media
    const channel = supabase
      .channel(`projector:${eventId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "event_live_stream_media",
          filter: `event_id=eq.${eventId}`,
        },
        (payload) => {
          const newRecord = payload.new as MediaItem & { status: string };
          if (newRecord.status === "approved") {
            setMediaList((prev) => [newRecord, ...prev]);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [eventId]);

  return (
    <div className="min-h-screen bg-black text-white p-6 overflow-hidden">
      <header className="mb-6 flex justify-between items-center border-b border-gray-800 pb-4">
        <h1 className="text-2xl font-black tracking-wider uppercase text-indigo-400">
          Live Event Photo Stream
        </h1>
        <div className="flex items-center space-x-2 text-xs text-green-400">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-ping"></span>
          <span>LIVE REALTIME FEED</span>
        </div>
      </header>

      <div className="columns-2 sm:columns-3 md:columns-4 lg:columns-5 gap-4 space-y-4">
        {mediaList.map((item, index) => (
          <div
            key={item.id}
            className={`break-inside-avoid rounded-xl overflow-hidden shadow-2xl transition-all duration-700 ease-out transform ${
              index === 0 ? "scale-105 ring-4 ring-indigo-500 animate-bounce-short" : ""
            }`}
          >
            <img
              src={item.media_url}
              alt="Live Concert Upload"
              className="w-full h-auto object-cover rounded-xl"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
