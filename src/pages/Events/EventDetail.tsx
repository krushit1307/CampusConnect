// =============================================================================
// PATCH: src/pages/Events/EventDetail.tsx
// Issue: #3678 — Real-Time "Micro-Volunteering" Task Board
//
// Three small edits:
//   1. Add the two new imports.
//   2. Add an `isOrganizer` state + a useEffect that resolves it.
//   3. Render the organizer panel + attendee popup inside the article.
//
// Everything else (banner, title, dual-clock, volunteer shifts,
// feedback survey, social proof) is preserved verbatim.
// =============================================================================

import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useParams } from "react-router-dom";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { EventSocialProofToasts } from "@/components/events/EventSocialProofToasts";
import { useBannerColor } from "@/hooks/useBannerColor";
import { EventFeedbackSurvey } from "@/components/events/EventFeedbackSurvey";
import VolunteerShifts from "@/components/VolunteerShifts";
// NEW (Issue #3678):
import { LiveTaskOrganizerPanel } from "@/components/events/LiveTaskOrganizerPanel";
import { LiveTaskAttendeePopup } from "@/components/events/LiveTaskAttendeePopup";
import { HelpQueueMentorDashboard } from "@/components/events/HelpQueueMentorDashboard";
import { HelpQueueAttendeeWidget } from "@/components/events/HelpQueueAttendeeWidget";
import { DietaryForecastPanel } from "@/components/events/DietaryForecastPanel";
import { User } from "@supabase/supabase-js";
import { SongRequestSection } from "@/components/events/SongRequestSection";
import { RealTimeEventParkingMap } from "@/components/events/RealTimeEventParkingMap";

interface EventDetailRecord {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  banner_url: string | null;
  clubs: { name: string; id: string } | { name: string; id: string }[] | null;
  venues: { name: string } | null;
}

export default function EventDetail() {
  const { eventId } = useParams();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  // NEW (Issue #3678): whether the current user is an admin of the
  // event's club, so we render the organizer panel.
  const [isOrganizer, setIsOrganizer] = useState(false);

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
          "id, title, description, event_date, location, banner_url, clubs(id, name), venues(name)",
        )
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as EventDetailRecord | null;
    },
  });

  // NEW (Issue #3678): resolve organizer status once event + user land.
  useEffect(() => {
    if (!event || !user) {
      setIsOrganizer(false);
      return;
    }
    const clubs = event.clubs;
    const clubId = Array.isArray(clubs) ? clubs[0]?.id : clubs?.id;
    if (!clubId) {
      setIsOrganizer(false);
      return;
    }
    supabase
      .from("club_members")
      .select("role")
      .eq("club_id", clubId)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setIsOrganizer(data?.role === "admin");
      });
  }, [event, user, supabase]);

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

        {event.event_date && (
          <p className="font-mono text-sm text-gray-700">
            {new Date(event.event_date).toLocaleString()}
          </p>
        )}
        {event.location && (
          <span className="flex items-center gap-2 font-mono text-sm text-gray-700">
            <MapPin size={18} aria-hidden="true" />
            {event.location}
          </span>
        )}

        {event.description && <p className="whitespace-pre-wrap leading-7">{event.description}</p>}

        {user && event.id && (
          <div className="pt-6">
            <VolunteerShifts eventId={event.id} userId={user.id} />
          </div>
        )}

        {/* ── NEW (Issue #3678): Live Task Board ────────────────── */}
        {/* Organizer sees the push panel; every signed-in user
            sees the attendee popup. */}
        {isOrganizer && event.id && (
          <div className="pt-6">
            <LiveTaskOrganizerPanel eventId={event.id} />
          </div>
        )}

        {/* ── NEW (Issue #3938): Help Desk Queue ────────────────── */}
        {isOrganizer && event.id && (
          <div className="pt-6">
            <HelpQueueMentorDashboard eventId={event.id} />
          </div>
        )}
        {user && event.id && (
          <div className="pt-6">
            <HelpQueueAttendeeWidget eventId={event.id} userId={user.id} />
          </div>
        )}

        {/* ── NEW (Issue #3931): Dietary Forecast ──────────────── */}
        {isOrganizer && event.id && (
          <div className="pt-6">
            <DietaryForecastPanel eventId={event.id} />
          </div>
        )}

        {/* ── NEW (Issue #4052): Real-Time Parking Availability ── */}
        {event.id && (
          <div className="pt-6">
            <RealTimeEventParkingMap
              eventId={event.id}
              eventName={event.title}
              venueName={event.venues?.name || event.location || "Venue"}
            />
          </div>
        )}
      </div>

      <div className="max-w-4xl mx-auto px-6 md:px-8 mb-8">
        <SongRequestSection eventId={event.id} isOrganizer={false} />
      </div>

      <EventFeedbackSurvey eventId={event.id} />
      <EventSocialProofToasts eventId={event.id} />
    </article>
  );
}
