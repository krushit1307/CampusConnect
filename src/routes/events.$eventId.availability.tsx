import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { SiteShell } from "@/components/site/SiteShell";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { useEventAvailability } from "@/hooks/useEventAvailability";
import { HeatmapCalendar } from "@/components/Availability/HeatmapCalendar";
import ArrowLeft from "lucide-react/dist/esm/icons/arrow-left";
import Users from "lucide-react/dist/esm/icons/users";

export default function EventAvailabilityPage() {
  const { eventId = "" } = useParams();
  const navigate = useNavigate();
  const supabase = createClient();

  const { data: eventData } = useQuery({
    queryKey: ["event_details_availability", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, club_id")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  const { ownSlots, popularity, isLoading, saveAvailability, isSaving } =
    useEventAvailability(eventId);

  const mostPopular = popularity.length
    ? popularity.reduce((best, s) => (s.count > best.count ? s : best))
    : null;

  return (
    <SiteShell>
      <div className="min-h-screen bg-cream px-4 py-8 md:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 font-mono text-sm font-bold uppercase hover:underline"
          >
            <ArrowLeft size={16} /> Back to Event
          </button>

          <div>
            <h1 className="font-display text-2xl md:text-4xl font-bold tracking-tight text-slate-900">
              {eventData?.title ? `${eventData.title} — Availability` : "Committee Availability"}
            </h1>
            <p className="font-mono text-xs text-gray-600 mt-1">
              Drag across the grid to mark when you're free. Everyone's picks are combined so the
              organizer can find the best time to meet.
            </p>
          </div>

          {mostPopular && (
            <div className="flex items-center gap-2 text-sm font-mono bg-white neu-border px-3 py-2 w-fit">
              <Users className="w-4 h-4" />
              Best overlap: {mostPopular.count} {mostPopular.count === 1 ? "person" : "people"} free
              at {new Date(mostPopular.slot_start).toLocaleString()}
            </div>
          )}

          {isLoading ? (
            <div className="flex h-64 w-full items-center justify-center neu-border bg-white p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-black border-t-transparent" />
            </div>
          ) : (
            <HeatmapCalendar
              initialSelected={ownSlots}
              onSubmit={(slots) => saveAvailability(slots)}
              isSaving={isSaving}
            />
          )}
        </div>
      </div>
    </SiteShell>
  );
}
