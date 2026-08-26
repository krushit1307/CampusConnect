import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  clampSlideIndex,
  isValidLaserPointerPayload,
  isValidSlideIndex,
  presentationChannelName,
} from "@/lib/eventPresentation";

type MediaItem = {
  id: string;
  media_url: string;
  created_at: string;
};

type LaserPointer = { x: number; y: number; active: boolean };

export default function EventProjectorPage({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [laserPointer, setLaserPointer] = useState<LaserPointer>({ x: 0, y: 0, active: false });
  const [connectionState, setConnectionState] = useState("CONNECTING");
  const currentIndexRef = useRef(0);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    let mounted = true;
    const fetchSlides = async () => {
      const { data } = await supabase
        .from("event_live_stream_media")
        .select("id, media_url, created_at")
        .eq("event_id", eventId)
        .eq("status", "approved")
        .order("created_at", { ascending: true })
        .limit(100);

      if (mounted && data) setMediaList(data as MediaItem[]);
    };

    void fetchSlides();
    return () => {
      mounted = false;
    };
  }, [eventId, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(presentationChannelName(eventId))
      .on("broadcast", { event: "slide_change" }, ({ payload }) => {
        if (isValidSlideIndex(payload?.index, mediaList.length)) {
          setCurrentIndex(payload.index);
        }
      })
      .on("broadcast", { event: "laser_pointer" }, ({ payload }) => {
        if (isValidLaserPointerPayload(payload)) setLaserPointer(payload);
      })
      .on("presence", { event: "sync" }, () => {
        void channel.send({
          type: "broadcast",
          event: "presentation_state",
          payload: { index: currentIndexRef.current },
        });
      })
      .subscribe((status) => setConnectionState(status.toUpperCase()));

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId, mediaList.length, supabase]);

  const currentSlide = mediaList[currentIndex];

  return (
    <main
      className="fixed inset-0 overflow-hidden bg-black text-white"
      aria-label="Event projector"
    >
      {currentSlide ? (
        <img
          src={currentSlide.media_url}
          alt={`Presentation slide ${currentIndex + 1}`}
          className="h-full w-full object-contain"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-2xl font-semibold text-white/70">
          Waiting for presentation slides…
        </div>
      )}

      <div className="pointer-events-none absolute left-6 top-6 rounded-full bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 backdrop-blur">
        {connectionState} · Slide{" "}
        {mediaList.length ? `${currentIndex + 1}/${mediaList.length}` : "—"}
      </div>

      {laserPointer.active && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500 shadow-[0_0_28px_12px_rgba(239,68,68,0.65)]"
          style={{ left: `${laserPointer.x * 100}%`, top: `${laserPointer.y * 100}%` }}
        />
      )}
    </main>
  );
}
