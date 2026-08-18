import {
  formatDate,
  formatEventDateRange,
  getCountdown,
  getGoogleCalendarUrl,
  getIcsContent,
  isEventLive,
} from "@/lib/utils";
import { Link } from "react-router-dom";
import { useState } from "react";
import { MapPin, Calendar, Clock, Link as LinkIcon, Share2, Bookmark, Play } from "lucide-react";
import { useAudioStore } from "@/store/audioStore";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { TicketDialog } from "@/components/ui/ticket-modal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EventRSVPButton } from "@/components/EventRSVPButton";
import { usePreloadEvent } from "@/hooks/usePreloadEvent";
import { EventCapacityGauge } from "@/components/events/EventCapacityGauge";
import { LiveNowBadge } from "@/components/events/LiveNowBadge";
import { ShareMenu } from "@/components/ui/ShareMenu";
import { EventRsvpCancelDialog } from "@/components/events/EventRsvpCancelDialog";
import { getEventTldr } from "@/lib/eventSummary";

interface Event {
  id: string;
  short_id?: string | null;
  title: string;
  description: string | null;
  tldr_summary?: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  event_status?: string | null;
  location: string | null;
  banner_url?: string | null;
  created_at?: string | null;
  max_attendees?: number | null;
  clubs: { name: string } | { name: string }[] | null;
  event_rsvps: { id: string; user_id: string }[] | null;
  saved_events: { id: string; user_id: string }[] | null;
  rsvp_count?: number;
  saved_count?: number;
}

interface EventCardProps {
  event: Event;
  index: number;
  user: { id: string } | null;
  onRsvpToggle: (eventId: string, hasRsvpd: boolean) => void;
  isRsvpPending: boolean;
  onBookmarkToggle: (eventId: string, isSaved: boolean) => void;
  isBookmarkPending: boolean;
  active?: boolean;
}

const ASSUMED_LEAD_TIME_DAYS = 30;

interface EventProgress {
  percent: number;
  isPast: boolean;
  isEstimated: boolean;
}

function getEventProgress(createdAt: string | null | undefined, eventDate: string): EventProgress {
  const now = Date.now();
  const eventTime = new Date(eventDate).getTime();

  if (now >= eventTime) {
    return { percent: 100, isPast: true, isEstimated: false };
  }

  let startTime: number;
  let isEstimated = false;

  if (createdAt) {
    startTime = new Date(createdAt).getTime();
  } else {
    startTime = eventTime - ASSUMED_LEAD_TIME_DAYS * 24 * 60 * 60 * 1000;
    isEstimated = true;
  }

  const totalWindow = eventTime - startTime;
  if (totalWindow <= 0) {
    return { percent: 100, isPast: false, isEstimated };
  }

  const elapsed = now - startTime;
  const percent = Math.min(100, Math.max(0, (elapsed / totalWindow) * 100));

  return { percent, isPast: false, isEstimated };
}

function EventProgressBar({
  createdAt,
  eventDate,
}: {
  createdAt: string | null | undefined;
  eventDate: string | null;
}) {
  if (!eventDate) return null;

  const { percent, isPast, isEstimated } = getEventProgress(createdAt, eventDate);

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between font-mono text-[9px] sm:text-xs font-bold uppercase text-black">
        <span>Time to event</span>
        <span>{isPast ? "Ended" : `${Math.round(percent)}%`}</span>
      </div>
      <div className="h-4 w-full neu-border overflow-hidden bg-white p-0.5">
        {isPast ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-200">
            <span className="font-mono text-[8px] sm:text-[9px] font-bold uppercase text-gray-500">
              Event has passed
            </span>
          </div>
        ) : (
          <div
            className="h-full border-r-2 border-black bg-lime transition-all duration-500 ease-out"
            style={{ width: `${percent}%` }}
          />
        )}
      </div>
      {isEstimated && !isPast && (
        <p className="mt-1 font-mono text-[8px] sm:text-[9px] text-gray-500">
          Estimated — creation date unavailable
        </p>
      )}
    </div>
  );
}

function renderLocationWithLinks(locationText: string | null) {
  if (!locationText) return "TBA";

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = locationText.split(urlRegex);

  return parts.map((part, i) => {
    if (part.match(urlRegex)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-blue-700 transition-colors break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function EventCard({
  event,
  index,
  user,
  onRsvpToggle,
  isRsvpPending,
  onBookmarkToggle,
  isBookmarkPending,
  active,
}: EventCardProps) {
  const club = Array.isArray(event.clubs) ? event.clubs[0] : event.clubs;
  const rsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps : [];
  const myRsvp = user ? rsvps.find((rsvp) => rsvp.user_id === user.id) : null;
  const preloadEvent = usePreloadEvent(event.id);
  const hasRsvpd = !!myRsvp;
  const colors = ["bg-lime", "bg-sky", "bg-peach"];
  const googleCalendarUrl = getGoogleCalendarUrl({
    title: event.title,
    description: event.description,
    event_date: event.event_date,
    start_date: event.start_date,
    end_date: event.end_date,
    location: event.location,
  });
  const countdown = event.event_date ? getCountdown(event.event_date) : "TBA";
  const isLive = isEventLive(event);

  const [ticketOpen, setTicketOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const { playTrack } = useAudioStore();
  const supabase = createClient();

  const handlePlayRecording = async () => {
    if (!event.audio_recording_url) return;
    try {
      const { data, error } = await supabase.storage
        .from("event_audio")
        .createSignedUrl(event.audio_recording_url, 7200);

      if (error) throw error;

      playTrack({
        url: data.signedUrl,
        eventId: event.id,
        title: event.title,
        clubName: club?.name,
        clubLogo: club?.logo_url,
      });
    } catch (err: any) {
      toast.error("Could not play recording.");
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const handleDownloadIcs = () => {
    const icsContent = getIcsContent({
      title: event.title,
      description: event.description,
      event_date: event.event_date,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
    });

    if (!icsContent) {
      toast.error("Failed to generate calendar file");
      return;
    }

    const blob = new Blob([icsContent], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `${event.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const shareUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${window.location.pathname}#event-${event.id}`
      : "";

  const handleRsvpToggle = (eventId: string, currentlyRsvpd: boolean) => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    if (currentlyRsvpd) {
      setCancelConfirmOpen(true);
      return;
    }

    onRsvpToggle(eventId, false);
  };

  const handleConfirmCancelRsvp = () => {
    onRsvpToggle(event.id, true);
    setCancelConfirmOpen(false);
  };

  const savedEventsList = Array.isArray(event.saved_events) ? event.saved_events : [];
  const isSaved = user ? savedEventsList.some((se) => se.user_id === user.id) : false;

  const handleBookmarkClick = () => {
    if (!user) {
      toast.error("Please log in to bookmark events");
      return;
    }
    onBookmarkToggle?.(event.id, isSaved);
  };

  return (
    <div className="group">
      <article
        id={`event-${event.id}`}
 feat/club-equipment-asset-register-3481
        className={`neu-border p-5 relative ${colors[index % colors.length]} transition-all duration-300 ease-out group-hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-ink)]`}

        className={`neu-border p-5 relative ${
          active
            ? "bg-blue-100 border-4 border-blue-600 ring-2 ring-blue-600"
            : colors[index % colors.length]
        } transition-all duration-300 ease-out group-hover:scale-[1.02] hover:-translate-y-1 hover:shadow-[6px_6px_0_0_var(--color-ink)]`}
        onMouseEnter={preloadEvent.onMouseEnter}
        onMouseLeave={preloadEvent.onMouseLeave}
 main
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col">
            <p className="font-mono text-xs font-bold uppercase tracking-wider pr-10 text-red-900">
              {event.event_date
                ? formatDate(event.event_date).split(" at ")[0].toUpperCase()
                : "TBA"}
            </p>

            {isLive ? (
              <LiveNowBadge className="mt-2">Live Now</LiveNowBadge>
            ) : (
              event.event_date && (
                <span
                  className={`mt-2 inline-flex min-h-[24px] items-center rounded-full px-2 py-1 text-[11px] font-bold ${
                    countdown === "Ended"
                      ? "bg-gray-100 text-gray-600"
                      : "bg-peach text-orange-700"
                  }`}
                >
                  {countdown}
                </span>
              )
            )}
          </div>
          <div className="flex gap-2 relative z-10">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleBookmarkClick}
                    disabled={isBookmarkPending}
                    className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white text-black transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={isSaved ? "Unsave event" : "Save event"}
                  >
                    <Bookmark className="h-4 w-4" fill={isSaved ? "black" : "none"} />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isSaved ? "Unsave event" : "Save event"}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
 feat/club-equipment-asset-register-3481
                  <ShareMenu
                    url={shareUrl}
                    title={event.title}
                    text={`Check out this event: ${event.title}`}
                  >
                    <button

<ShareMenu
                    url={shareUrl}
                    title={event.title}
                    text={`Check out this event: ${event.title}`}
                    eventId={event.id}
                  >                    <button
 main
                      type="button"
                      aria-label="Share event link"
                      className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white text-black"
                    >
                      <Share2 aria-hidden="true" size={14} strokeWidth={3} />
                    </button>
                  </ShareMenu>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Share event</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <p className="mt-3 font-mono text-xs font-bold uppercase text-black">Event</p>
        <Link to={`/events/${event.id}`} className="group">
          <h2 className="mt-1 text-2xl font-black group-hover:underline text-violet-900">
            {event.title}
          </h2>
        </Link>
        <p className="mt-1 font-mono text-sm font-bold text-blue-900">{club?.name}</p>
        {(event.tldr_summary || event.description) && (
          <p className="mt-3 border-l-4 border-black/30 pl-3 font-mono text-sm font-semibold leading-relaxed text-black/80">
            <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-black/60">
              TL;DR:
            </span>
            {getEventTldr(event.tldr_summary, event.description)}
          </p>
        )}
        <EventProgressBar createdAt={event.created_at} eventDate={event.event_date} />
        <div className="mt-4">
          <EventCapacityGauge
            eventId={event.id}
            initialCapacity={event.rsvp_count ?? rsvps.length}
            maxAttendees={event.max_attendees || null}
            showDetails={true}
          />
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="font-mono text-xs font-bold uppercase text-black">Date &amp; Time</dt>
            <dd className="mt-1 text-sm text-red-900">{formatEventDateRange(event)}</dd>
          </div>
          <div>
            <dt className="font-mono text-xs font-bold uppercase text-black">Venue</dt>
            <dd className="mt-1 text-sm text-red-900">{renderLocationWithLinks(event.location)}</dd>
          </div>
          <div>
            <dt className="font-mono text-xs font-bold uppercase text-black">Attendees</dt>
            <dd className="mt-1 text-sm text-red-900">{event.rsvp_count ?? rsvps.length} RSVP'd</dd>
          </div>
        </dl>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <EventRSVPButton
            eventId={event.id}
            user={user}
            hasRsvpd={hasRsvpd}
            isPending={isRsvpPending}
            onToggle={handleRsvpToggle}
          />

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleCopyLink}
                  variant="outline"
                  className="neu-border neu-press bg-white hover:bg-cream h-9 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
                >
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Copy Link
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Copy Event Link</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          {hasRsvpd && googleCalendarUrl && (
            <a
              href={googleCalendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
            >
              <Calendar aria-hidden="true" size={14} strokeWidth={3} />
              Add to Google Calendar
            </a>
          )}
          {hasRsvpd && googleCalendarUrl && (
            <button
              onClick={handleDownloadIcs}
              type="button"
              className="neu-border bg-white px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2 text-black"
            >
              <Calendar aria-hidden="true" size={14} strokeWidth={3} />
              Add to Apple/Outlook
            </button>
          )}
          {hasRsvpd && myRsvp && (
            <Button
              type="button"
              onClick={() => setTicketOpen(true)}
              variant="outline"
              className="neu-border neu-press bg-white hover:bg-cream h-9 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 text-black"
            >
              View Ticket
            </Button>
          )}
          {event.audio_recording_url && (
            <Button
              type="button"
              onClick={handlePlayRecording}
              className="neu-border neu-press bg-blue-600 hover:bg-blue-700 h-9 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 text-white flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Listen Recording
            </Button>
          )}
        </div>
        <TicketDialog
          open={ticketOpen}
          onOpenChange={setTicketOpen}
          event={event}
          rsvpId={myRsvp?.id ?? ""}
        />
        <EventRsvpCancelDialog
          open={cancelConfirmOpen}
          onOpenChange={setCancelConfirmOpen}
          eventTitle={event.title}
          isPending={isRsvpPending}
          onConfirm={handleConfirmCancelRsvp}
        />
      </article>
    </div>
  );
}
