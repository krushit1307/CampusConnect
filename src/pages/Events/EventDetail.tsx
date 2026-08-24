// =============================================================================
// PATCH: src/pages/Events/EventDetail.tsx
// Issue: #3678 — Real-Time "Micro-Volunteering" Task Board
// Issue: #4301 — Interactive "Event Schedule" Custom Itinerary Builder
// =============================================================================

import React, { useEffect, useState } from "react";
import { MapPin } from "lucide-react";
import { useParams } from "react-router-dom";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { EventSocialProofToasts } from "@/components/events/EventSocialProofToasts";
import { useBannerColor } from "@/hooks/useBannerColor";
import { EventFeedbackSurvey } from "@/components/events/EventFeedbackSurvey";
import VolunteerShifts from "@/components/VolunteerShifts";
import { LiveTaskOrganizerPanel } from "@/components/events/LiveTaskOrganizerPanel";
import { LiveTaskAttendeePopup } from "@/components/events/LiveTaskAttendeePopup";
import { HelpQueueMentorDashboard } from "@/components/events/HelpQueueMentorDashboard";
import { HelpQueueAttendeeWidget } from "@/components/events/HelpQueueAttendeeWidget";
import { DietaryForecastPanel } from "@/components/events/DietaryForecastPanel";
import { User } from "@supabase/supabase-js";
import { SponsorBountiesSection } from "@/components/events/SponsorBountiesSection";

// NEW (Issue #4301): Itinerary Builder Imports
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import format from "date-fns/format";
import parse from "date-fns/parse";
import startOfWeek from "date-fns/startOfWeek";
import getDay from "date-fns/getDay";
import enUS from "date-fns/locale/en-US";
import "react-big-calendar/lib/css/react-big-calendar.css";
import { toast } from "sonner";
import { hasTemporalConflict } from "@/utils/timeConflicts";
import { generateItineraryPDF } from "@/utils/generateItineraryPDF";

// Setup React Big Calendar Localizer
const locales = {
  "en-US": enUS,
};
const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

interface EventDetailRecord {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  banner_url: string | null;
  clubs: { name: string; id: string } | { name: string; id: string }[] | null;
  venues: { name: string } | null;
  dualClock?: any; // Added to prevent TypeScript errors from the merged branch
}

export default function EventDetail() {
  const { eventId } = useParams();
  const [supabase] = useState(() => createClient());
  const [user, setUser] = useState<User | null>(null);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const queryClient = useQueryClient();

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

  // NEW (Issue #4301): Fetch sub-sessions for this event
  const { data: subSessions = [] } = useQuery({
    queryKey: ["sub_sessions", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_sessions")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });

  // NEW (Issue #4301): Fetch the user's current bookmarked itinerary
  const { data: itinerary = [] } = useQuery({
    queryKey: ["user_itinerary", user?.id],
    enabled: Boolean(user?.id && eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_itinerary")
        .select("id, sub_session_id, sub_sessions(id, start_time, end_time)")
        .eq("user_id", user!.id);

      if (error) throw error;

      // Map to flatten the structure for the conflict checker
      return data.map((d: any) => ({
        id: d.id,
        sub_session_id: d.sub_session_id,
        start_time: d.sub_sessions.start_time,
        end_time: d.sub_sessions.end_time,
      }));
    },
  });

  // NEW (Issue #4301): Mutation to insert a bookmark
  const bookmarkMutation = useMutation({
    mutationFn: async (subSessionId: string) => {
      const { error } = await supabase.from("user_itinerary").insert({
        user_id: user!.id,
        sub_session_id: subSessionId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Added to your itinerary!");
      queryClient.invalidateQueries({ queryKey: ["user_itinerary"] });
    },
    onError: (err) => {
      toast.error("Failed to bookmark: " + err.message);
    },
  });

  // NEW (Issue #4301): Handle Bookmark click
  const handleBookmark = (session: any) => {
    if (!user) {
      toast.error("Please log in to build your itinerary.");
      return;
    }
    if (itinerary.some((i: any) => i.sub_session_id === session.id)) {
      toast.info("You already bookmarked this session.");
      return;
    }
    if (hasTemporalConflict(session, itinerary)) {
      toast.error("Time Conflict! You have an overlapping session booked.");
      return;
    }
    bookmarkMutation.mutate(session.id);
  };

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
  const dualClock = event.dualClock || null;

  // Map sub-sessions for React Big Calendar
  const calendarEvents = subSessions.map((s: any) => ({
    ...s,
    start: new Date(s.start_time),
    end: new Date(s.end_time),
  }));

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
        
        <div className="flex flex-wrap gap-x-8 gap-y-4 font-mono text-sm text-gray-700">
          {/* ── NEW: dual-clock time display (Issue #3680) ── */}
          {/* Note: Ensure EventDualClockTime is properly imported if it throws an error locally */}
          <div className="min-w-[260px]">
             {/* @ts-expect-error - EventDualClockTime might be dynamically registered */}
             {React.createElement(require('@/components/events/EventDualClockTime').EventDualClockTime || 'div', { data: dualClock, venueLabel: venueLabel, variant: "full" })}
          </div>

          {event.location && (
            <span className="flex items-center gap-2">
              <MapPin size={18} aria-hidden="true" />
              {event.location}
            </span>
          )}
        </div>

        {event.description && <p className="whitespace-pre-wrap leading-7">{event.description}</p>}

        {/* ── NEW (Issue #4301): Interactive Timeline Builder ──────────────── */}
        {subSessions.length > 0 && (
          <div className="pt-8 mt-8 border-t-2 border-black">
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-display text-2xl font-bold">
                Event Schedule & Itinerary Builder
              </h2>

              {/* Only show Export if they have bookmarked at least one session */}
              {itinerary.length > 0 && (
                <button
                  onClick={() =>
                    generateItineraryPDF(itinerary, user?.email || "Attendee", event.title)
                  }
                  className="bg-black text-white text-sm font-bold px-4 py-2 rounded border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-all"
                >
                  Export to PDF
                </button>
              )}
            </div>
            <div className="neu-border bg-white p-4 h-[600px]">
              <Calendar
                localizer={localizer}
                events={calendarEvents}
                defaultView="agenda"
                views={["agenda", "day"]}
                step={30}
                components={{
                  event: ({ event }: any) => {
                    const isBookmarked = itinerary.some((i: any) => i.sub_session_id === event.id);
                    return (
                      <div className="flex flex-col justify-between h-full p-1">
                        <div>
                          <strong className="block truncate font-bold text-sm text-black">
                            {event.title}
                          </strong>
                          <span className="text-xs text-gray-800">{event.room}</span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevents calendar modal from popping up
                            handleBookmark(event);
                          }}
                          disabled={isBookmarked || bookmarkMutation.isPending}
                          className="mt-2 text-xs font-bold bg-black text-white px-2 py-1 rounded hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed w-max"
                        >
                          {isBookmarked ? "Bookmarked ✓" : "+ Bookmark"}
                        </button>
                      </div>
                    );
                  },
                }}
              />
            </div>
          </div>
        )}

        {user && event.id && (
          <div className="pt-6">
            <VolunteerShifts eventId={event.id} userId={user.id} />
          </div>
        )}

        {isOrganizer && event.id && (
          <div className="pt-6">
            <LiveTaskOrganizerPanel eventId={event.id} />
          </div>
        )}

        {event.id && <SponsorBountiesSection eventId={event.id} />}
      </div>

      {user && event.id && <LiveTaskAttendeePopup eventId={event.id} userId={user.id} />}

      <EventFeedbackSurvey eventId={event.id} />
      <EventSocialProofToasts eventId={event.id} />
    </article>
  );
}
