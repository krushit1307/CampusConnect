import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, CircleDot, LoaderCircle, Radio, Wifi, WifiOff } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  clampSlideIndex,
  isValidSlideIndex,
  presentationChannelName,
} from "@/lib/eventPresentation";

type MediaItem = { id: string; media_url: string; created_at: string };

type LaserPointer = { x: number; y: number; active: boolean };

export default function EventSpeakerRemote({ eventId }: { eventId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [slides, setSlides] = useState<MediaItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [connectionState, setConnectionState] = useState("CONNECTING");
  const [laserEnabled, setLaserEnabled] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    const loadSlides = async () => {
      const { data, error: queryError } = await supabase
        .from("event_live_stream_media")
        .select("id, media_url, created_at")
        .eq("event_id", eventId)
        .eq("status", "approved")
        .order("created_at", { ascending: true })
        .limit(100);

      if (!mounted) return;
      if (queryError) {
        setError("Unable to load the presentation.");
        return;
      }
      setSlides((data ?? []) as MediaItem[]);
    };

    void loadSlides();
    return () => {
      mounted = false;
    };
  }, [eventId, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(presentationChannelName(eventId))
      .on("broadcast", { event: "presentation_state" }, ({ payload }) => {
        if (isValidSlideIndex(payload?.index, slides.length)) setCurrentIndex(payload.index);
      })
      .subscribe((status) => {
        setConnectionState(status.toUpperCase());
      });

    channelRef.current = channel;
    void channel.track({ role: "speaker-remote", eventId });

    return () => {
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, [eventId, slides.length, supabase]);

  const broadcast = async (event: "slide_change" | "laser_pointer", payload: object) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({ type: "broadcast", event, payload });
  };

  const changeSlide = (delta: number) => {
    if (!slides.length) return;
    const nextIndex = clampSlideIndex(currentIndex + delta, slides.length);
    setCurrentIndex(nextIndex);
    void broadcast("slide_change", { index: nextIndex });
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!laserEnabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((event.clientY - rect.top) / rect.height, 0), 1);
    void broadcast("laser_pointer", { x, y, active: true });
  };

  const stopLaser = () => {
    if (laserEnabled) void broadcast("laser_pointer", { x: 0, y: 0, active: false });
  };

  const isConnected = connectionState === "SUBSCRIBED";
  const disabled = !slides.length || !isConnected;

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-5 text-white select-none">
      <section className="mx-auto flex min-h-[calc(100vh-2.5rem)] max-w-xl flex-col gap-5">
        <header className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-indigo-300">
              CampusConnect
            </p>
            <h1 className="text-2xl font-black tracking-tight">Presentation Remote</h1>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs font-semibold">
            {isConnected ? (
              <Wifi className="h-4 w-4 text-emerald-400" />
            ) : (
              <WifiOff className="h-4 w-4 text-amber-400" />
            )}
            {connectionState}
          </div>
        </header>

        <div className="rounded-3xl border border-white/10 bg-white/5 p-4 text-center backdrop-blur">
          <p className="text-sm text-white/60">Live slide</p>
          <p className="mt-1 text-5xl font-black tabular-nums">
            {slides.length ? currentIndex + 1 : "—"}
            <span className="text-2xl text-white/35">/{slides.length || "—"}</span>
          </p>
        </div>

        {error && <p className="rounded-2xl bg-red-500/15 p-4 text-sm text-red-200">{error}</p>}

        <div className="grid flex-1 grid-cols-2 gap-4">
          <button
            type="button"
            aria-label="Previous slide"
            disabled={disabled || currentIndex === 0}
            onClick={() => changeSlide(-1)}
            className="flex min-h-52 touch-manipulation flex-col items-center justify-center gap-4 rounded-3xl bg-white text-slate-950 shadow-xl transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowLeft className="h-16 w-16" strokeWidth={3} />
            <span className="text-xl font-black uppercase tracking-wide">Previous</span>
          </button>
          <button
            type="button"
            aria-label="Next slide"
            disabled={disabled || currentIndex >= slides.length - 1}
            onClick={() => changeSlide(1)}
            className="flex min-h-52 touch-manipulation flex-col items-center justify-center gap-4 rounded-3xl bg-indigo-500 text-white shadow-xl transition active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ArrowRight className="h-16 w-16" strokeWidth={3} />
            <span className="text-xl font-black uppercase tracking-wide">Next</span>
          </button>
        </div>

        <button
          type="button"
          aria-pressed={laserEnabled}
          disabled={!isConnected}
          onClick={() => {
            const next = !laserEnabled;
            setLaserEnabled(next);
            if (!next) stopLaser();
          }}
          className={`min-h-20 touch-manipulation rounded-3xl border-2 text-lg font-black uppercase tracking-wide transition active:scale-[0.98] disabled:opacity-40 ${
            laserEnabled
              ? "border-red-400 bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.35)]"
              : "border-white/15 bg-white/5 text-white"
          }`}
        >
          <span className="inline-flex items-center gap-3">
            <CircleDot className="h-6 w-6" />
            {laserEnabled ? "Laser pointer on" : "Laser pointer"}
          </span>
        </button>

        <div
          role="application"
          aria-label="Laser pointer touch surface"
          onPointerMove={handlePointerMove}
          onPointerDown={handlePointerMove}
          onPointerUp={stopLaser}
          onPointerCancel={stopLaser}
          onPointerLeave={stopLaser}
          className={`relative min-h-36 touch-none overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-5 ${
            laserEnabled ? "cursor-crosshair" : "cursor-default opacity-50"
          }`}
        >
          <div className="flex h-full items-center justify-center text-center text-sm text-white/45">
            {laserEnabled
              ? "Drag here to point on the projector"
              : "Enable the laser pointer to use this surface"}
          </div>
        </div>

        {!slides.length && !error && (
          <div className="flex items-center justify-center gap-2 text-sm text-white/50">
            <LoaderCircle className="h-4 w-4 animate-spin" /> Loading presentation…
          </div>
        )}

        <p className="pb-2 text-center text-xs text-white/35">
          Event {eventId} · Keep this screen open while presenting
        </p>
      </section>
    </main>
  );
}
