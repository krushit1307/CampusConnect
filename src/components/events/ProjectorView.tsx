import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

interface ProjectorViewProps {
  eventId: string;
}

export function broadcastNewPhoto(eventId: string, imageUrl: string) {
  return supabase.channel(`event-projector-${eventId}`).send({
    type: "broadcast",
    event: "new-photo",
    payload: { imageUrl },
  });
}

export function ProjectorView({ eventId }: ProjectorViewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    const channel = supabase.channel(`event-projector-${eventId}`);
    channel
      .on("broadcast", { event: "new-photo" }, ({ payload }) => {
        setImageUrl(payload?.imageUrl ?? null);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [eventId]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6">
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Live event album"
          className="max-h-screen max-w-full object-contain"
        />
      ) : (
        <p className="text-xl font-bold text-white">Waiting for event photos...</p>
      )}
    </main>
  );
}
