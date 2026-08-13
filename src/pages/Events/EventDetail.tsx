import React, { useEffect } from "react";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import { useParams } from "react-router-dom";
import { useConfetti } from "../../hooks/useConfetti";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { SkeletonEventDetails } from "@/components/events/SkeletonEventDetails";
import { EventSocialProofToasts } from "@/components/events/EventSocialProofToasts";
import { useBannerColor } from "@/hooks/useBannerColor";

interface EventDetailRecord {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  banner_url: string | null;
  clubs: { name: string } | { name: string }[] | null;
}

export default function EventDetail() {
  const { eventId } = useParams();
  const supabase = createClient();
  const { data: event, isLoading } = useQuery<EventDetailRecord | null>({
    queryKey: ["event-detail", eventId],
    enabled: Boolean(eventId),
    queryFn: async () => {
      if (!eventId) return null;
      const { data, error } = await supabase
        .from("events")
        .select("id, title, description, event_date, location, banner_url, clubs(name)")
        .eq("id", eventId)
        .maybeSingle();
      if (error) throw error;
      return data as EventDetailRecord | null;
    },
  });

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

  return (
    <article className="relative min-h-full bg-white transition-colors duration-700">
      {/* Dynamic Extracted Banner Background Gradient (#1744) */}
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
        <div className="flex flex-wrap gap-4 font-mono text-sm text-gray-700">
          {event.event_date && (
            <span className="flex items-center gap-2">
              <Calendar size={18} aria-hidden="true" />
              {new Date(event.event_date).toLocaleString()}
            </span>
          )}
          {event.location && (
            <span className="flex items-center gap-2">
              <MapPin size={18} aria-hidden="true" />
              {event.location}
            </span>
          )}
        </div>
        {event.description && <p className="whitespace-pre-wrap leading-7">{event.description}</p>}
      </div>
      <EventSocialProofToasts eventId={event.id} />
    </article>
  );
}

interface RSVPModalProps {
  isOpen: boolean;
  onClose: () => void;
  studentName?: string;
}

export const RSVPSuccessModal: React.FC<RSVPModalProps> = ({ isOpen, onClose, studentName }) => {
  const { triggerSchoolColorsBurst } = useConfetti();

  useEffect(() => {
    // Fire the confetti the moment the success modal mounts and opens
    if (isOpen) {
      triggerSchoolColorsBurst();
    }
  }, [isOpen, triggerSchoolColorsBurst]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>🎉 Registration Successful!</h2>
        <p>You're all set for the event. We've sent the ticket details to your email.</p>
        <button onClick={onClose} className="close-btn">
          Awesome
        </button>
      </div>
    </div>
  );
};
