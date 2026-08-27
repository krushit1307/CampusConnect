import { SafetyRollCallDashboard } from "@/components/events/SafetyRollCallDashboard";
import { SafetyCheckPrompt } from "@/components/events/SafetyCheckPrompt";
// =============================================================================
// PATCH: src/pages/Events/EventDetail.tsx
// Issue: #3678 — Real-Time "Micro-Volunteering" Task Board
// Issue: #4791 — Interactive "Event Schedule" Drag-and-Drop Itinerary Planner
// Issue: #4265 — Real-Time "Event Photography" Collaborative Album
// =============================================================================

import React, { useEffect, useState } from "react";
import { CrisisAbTestBanner } from "@/components/events/CrisisAbTestBanner";
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

import { toast } from "sonner";
import { hasTemporalConflict } from "@/utils/timeConflicts";
import { generateItineraryPDF } from "@/utils/generateItineraryPDF";

// NEW (Issue #4265): Live Album Imports
import { LiveAlbumUploader } from "@/components/events/LiveAlbumUploader";
import { broadcastNewPhoto } from "@/components/events/ProjectorView";

// NEW (Issue #4791): Drag-and-Drop Calendar Import
import { ItineraryCalendar } from "@/components/ItineraryCalendar";

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
  is_live_album_active: boolean | null; // NEW: Live album toggle
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
          "id, title, description, event_date, location, banner_url, clubs(id, name), venues(name), is_live_album_active"
        )
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as EventDetailRecord | null;
    },
  });

  // Fetch sub-sessions for this event
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

  // Fetch the user's current bookmarked itinerary
  const { data: itinerary = [] } = useQuery({
    queryKey: ["user_itinerary", user?.id],
    enabled: Boolean(user?.id && eventId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_itinerary")
        .select("id, sub_session_id, sub_sessions(id, start_time, end_time)")
        .eq("user_id", user!.id);

      if (error) throw error;

      return data.map((d: any) => ({
        id: d.id,
        sub_session_id: d.sub_session_id,
        start_time: d.sub_sessions.start_time,
        end_time: d.sub_sessions.end_time,
      }));
    },
  });

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
          <div className="min-w-[260px]">
             {/* @ts-expect-error - EventDualClockTime might be dynamically registered */}
             {/* eslint-disable-next-line @typescript-eslint/no-require-imports */}
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

        {/* ── NEW (Issue #4265): Live Event Album Section ──────────────── */}
        {event.is_live_album_active && event.id && (
          <div className="pt-8 mt-8 border-t-2 border-black">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
              <div>
                <h2 className="font-display text-2xl font-bold">Live Event Album</h2>
                <p className="text-gray-600 text-sm mt-1">Snap photos and they will appear on the big screen instantly!</p>
              </div>
              
              {isOrganizer && (
                <a
                  href={`/events/${event.id}/projector`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition-colors whitespace-nowrap"
                >
                  Open Projector View ↗
                </a>
              )}
            </div>
            
            <LiveAlbumUploader 
              eventId={event.id} 
              onUploadComplete={(url) => {
                broadcastNewPhoto(event.id, url);
                toast.success("Awesome shot! Sent to the projector.", { icon: "📸" });
              }} 
            />
          </div>
        )}

        {/* ── NEW (Issue #4791): Interactive Drag-and-Drop Timeline Builder ──────────────── */}
        <div className="pt-8 mt-8 border-t-2 border-black">
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-display text-2xl font-bold">
              Event Schedule & Itinerary Builder
            </h2>
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
          
          {/* Injecting the new Drag and Drop Calendar component here */}
          <ItineraryCalendar />
          
        </div>

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
