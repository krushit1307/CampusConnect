import React, { useEffect, useState } from "react";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import { useParams } from "react-router-dom";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { EventSocialProofToasts } from "@/components/events/EventSocialProofToasts";
import { useBannerColor } from "@/hooks/useBannerColor";
import { EventFeedbackSurvey } from "@/components/events/EventFeedbackSurvey";
import VolunteerShifts from "@/components/VolunteerShifts";
import { EventDualClockTime } from "@/components/EventDualClockTime";
import { useEventDualClock } from "@/hooks/useEventDualClock";
import type { TimezoneAwareEvent } from "@/lib/venueTimezone";
import { User } from "@supabase/supabase-js";

interface EventDetailRecord extends TimezoneAwareEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date: string | null;
  end_date: string | null;
  venue_id: string | null;
  venue_timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  location: string | null;
  banner_url: string | null;
  clubs: { name: string } | { name: string }[] | null;
  venues: { name: string; timezone: string | null } | null;
}

export default function EventDetail() {
  const { eventId } = useParams();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
  }, [supabase]);

  const { data: event, isLoading } = useQuery<EventDetailRecord | null>({
    queryKey: ["event-detail", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from("events")
        .select(
          "id, title, description, event_date, start_date, end_date, " +
            "venue_id, venue_timezone, latitude, longitude, location, " +
            "banner_url, clubs(name), venues(name, timezone)",
        )
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as EventDetailRecord | null;
    },
  });

  const { data: dualClock } = useEventDualClock(event ?? null);

  if (isLoading) return <SkeletonEventDetails />;
  if (!event) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center p-8 text-center">
        <div className="neu-border bg-white p-6">
          <h2 className="font-display text-2xl font-bold">Event not found</h2>
          <p className="mt-2 font-mono text-sm text-gray-600">
            This event may have been removed or is no longer available.
          </p>
        </div>
      </div>
    );
  }

  const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;
  const { gradientStyle } = useBannerColor(event.banner_url);
  const venueLabel = event.venues?.name || event.location;

  return (
    <article className="relative min-h-full bg-white transition-colors duration-700">
      {event.banner_url && (
        <div
          data-testid="banner-dynamic-gradient"
          className="absolute inset-0 pointer-events-none h-96 transition-all duration-700 opacity-90"
          style={{ background: gradientStyle }}
        />
      )}
      {event.banner_url && (
        <img
          src={event.banner_url}
          alt=""
          crossOrigin="anonymous"
          className="relative z-10 h-64 w-full border-b-2 border-black object-cover"
        />
      )}
      <div className="relative z-10 space-y-6 p-6 md:p-8">
        {clubName && <p className="eyebrow font-bold">{clubName}</p>}
        <h1 className="font-display text-4xl font-bold">{event.title}</h1>

        <div className="flex flex-wrap gap-x-8 gap-y-4 font-mono text-sm text-gray-700">
          {/* ── NEW: dual-clock time display (Issue #3680) ── */}
          <div className="min-w-[260px]">
            <EventDualClockTime
              data={dualClock}
              venueLabel={venueLabel}
              variant="full"
            />
          </div>

          {event.location && (
            <span className="flex items-center gap-2">
              <MapPin size={18} aria-hidden="true" />
              {event.location}
            </span>
          )}
        </div>

        {event.description && (
          <p className="whitespace-pre-wrap leading-7">{event.description}</p>
        )}

        {user && event.id && (
          <div className="pt-6">
            <VolunteerShifts eventId={event.id} userId={user.id} />
          </div>
        )}
      </div>

      <EventFeedbackSurvey eventId={event.id} />
      <EventSocialProofToasts eventId={event.id} />
    </article>
  );
}
