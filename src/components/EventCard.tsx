import { formatDate, formatEventDateRange, getCountdown, getGoogleCalendarUrl } from "@/lib/utils";
import { Link } from "react-router-dom";
import { FormEvent, useState } from "react";
import { Calendar, Check, Share2, X, Link as LinkIcon, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { TicketDialog } from "@/components/ui/ticket-modal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EventRSVPButton } from "@/components/EventRSVPButton";
import { ConfirmModal } from "@/components/ui/confirm-modal";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location: string | null;
  banner_url?: string | null;
  created_at?: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_rsvps: { id: string; user_id: string }[] | null;
  saved_events: { id: string; user_id: string }[] | null;
}

interface EventCardProps {
  event: Event;
  index: number;
  user: { id: string } | null;
  onRsvpToggle: (eventId: string, hasRsvpd: boolean) => void;
  isRsvpPending: boolean;
  onBookmarkToggle: (eventId: string, isSaved: boolean) => void;
  isBookmarkPending: boolean;
}

// Assumed lead time (in days) used when an event has no `created_at` available
// (e.g. mock/dev fallback data, or a query that hasn't been updated to select it
// yet). This keeps the progress bar meaningful instead of just hiding it.
const ASSUMED_LEAD_TIME_DAYS = 30;

interface EventProgress {
  /** 0-100, how far along we are between "created" and the event date */
  percent: number;
  /** true once the event date has passed */
  isPast: boolean;
  /** true when we had to fall back to an assumed lead time (no created_at) */
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
  // No date at all ("TBA" events) — nothing meaningful to show a timeline for.
  if (!eventDate) return null;

  const { percent, isPast, isEstimated } = getEventProgress(createdAt, eventDate);

  return (
    <div className="mt-4">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] font-bold uppercase text-black">
        <span>Time to event</span>
        <span>{isPast ? "Ended" : `${Math.round(percent)}%`}</span>
      </div>
      <div className="h-4 w-full neu-border overflow-hidden bg-white p-0.5">
        {isPast ? (
          <div className="flex h-full w-full items-center justify-center bg-gray-200">
            <span className="font-mono text-[9px] font-bold uppercase text-gray-500">
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
        <p className="mt-1 font-mono text-[9px] text-gray-500">
          Estimated — creation date unavailable
        </p>
      )}
    </div>
  );
}

export function EventCard({
  event,
  index,
  user,
  onRsvpToggle,
  isRsvpPending,
  onBookmarkToggle,
  isBookmarkPending,
}: EventCardProps) {
  const club = Array.isArray(event.clubs) ? event.clubs[0] : event.clubs;
  const rsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps : [];
  const myRsvp = user ? rsvps.find((rsvp) => rsvp.user_id === user.id) : null;

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

  const [copied, setCopied] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied!");
    } catch (error) {
      toast.error("Failed to copy link.");
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#event-${event.id}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied!");
      window.setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error("Failed to copy link.");
    }
  };

  const handleRsvpToggleClick = (eventId: string, currentHasRsvpd: boolean) => {
    if (currentHasRsvpd) {
      setConfirmOpen(true);
    } else {
      onRsvpToggle(eventId, false);
    }
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

  const shouldTruncate = !!event.description && event.description.length > 220;

  const displayedDescription =
    shouldTruncate && !isDescriptionExpanded
      ? `${event.description!.slice(0, 180)}...`
      : event.description;

  return (
    <article
      id={`event-${event.id}`}
      className={`neu-border p-5 relative ${colors[index % colors.length]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col">
          <p className="font-mono text-xs font-bold uppercase tracking-wider pr-10 text-red-900">
            {event.event_date ? formatDate(event.event_date).split(" at ")[0].toUpperCase() : "TBA"}
          </p>

          {event.event_date && (
            <span
              className={`mt-2 inline-flex min-h-[24px] items-center rounded-full px-2 py-1 text-[11px] font-bold ${
                countdown === "Ended" ? "bg-gray-100 text-gray-600" : "bg-peach text-orange-700"
              }`}
            >
              {countdown}
            </span>
          )}
        </div>

        <div className="flex gap-2 relative z-10">
          <button
            type="button"
            onClick={handleBookmarkClick}
            disabled={isBookmarkPending}
            className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white text-black transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={isSaved ? "Unsave event" : "Save event"}
          >
            <Bookmark className="h-4 w-4" fill={isSaved ? "black" : "none"} />
          </button>

          <button
            type="button"
            onClick={handleShare}
            aria-label="Copy event link"
            className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white text-black"
          >
            {copied ? (
              <Check aria-hidden="true" size={14} strokeWidth={3} />
            ) : (
              <Share2 aria-hidden="true" size={14} strokeWidth={3} />
            )}
          </button>
        </div>
      </div>

      <p className="mt-3 font-mono text-xs font-bold uppercase text-black">Event</p>
      <Link to={`/events/${event.id}`} className="group">
        <h2 className="mt-1 text-2xl font-black group-hover:underline text-violet-900">
          {event.title}
        </h2>
      </Link>
      <p className="mt-1 font-mono text-sm font-bold text-blue-900">{club?.name}</p>

      {event.description ? (
        <div
          className={`mt-4 overflow-hidden transition-all duration-300 ease-in-out ${
            isDescriptionExpanded ? "max-h-[250px]" : "max-h-40"
          }`}
        >
          <p className="text-sm leading-6 text-gray-800 inline">{displayedDescription}</p>

          {shouldTruncate && (
            <button
              type="button"
              onClick={() => setIsDescriptionExpanded((prev) => !prev)}
              className="ml-1 inline font-semibold text-violet-700 hover:text-violet-900 transition-colors"
            >
              {isDescriptionExpanded ? "Read less" : "Read more"}
            </button>
          )}
        </div>
      ) : null}

      <EventProgressBar createdAt={event.created_at} eventDate={event.event_date} />

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-xs font-bold uppercase text-black">Date &amp; Time</dt>
          <dd className="mt-1 text-sm text-red-900">{formatEventDateRange(event)}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs font-bold uppercase text-black">Venue</dt>
          <dd className="mt-1 text-sm text-red-900">{event.location || "TBA"}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs font-bold uppercase text-black">Attendees</dt>
          <dd className="mt-1 text-sm text-red-900">{rsvps.length} RSVP'd</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <EventRSVPButton
          eventId={event.id}
          user={user}
          hasRsvpd={hasRsvpd}
          isPending={isRsvpPending}
          onToggle={handleRsvpToggleClick}
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
      </div>

      <div className="mt-4 flex gap-2">
        <a
          href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#1DA1F2] hover:text-white transition-colors"
        >
          Twitter
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(window.location.href)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#0A66C2] hover:text-white transition-colors"
        >
          LinkedIn
        </a>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(`Check out this event: ${event.title} - ${window.location.href}`)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="neu-border px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-[#25D366] hover:text-white transition-colors"
        >
          WhatsApp
        </a>
      </div>

      <ConfirmModal
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        title="Cancel your RSVP?"
        description="Are you sure you want to remove your RSVP for this event?"
        confirmText="Yes, cancel RSVP"
        onConfirm={() => {
          onRsvpToggle(event.id, true);
          setConfirmOpen(false);
        }}
      />

      <TicketDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        event={event}
        rsvpId={myRsvp?.id ?? ""}
      />
    </article>
  );
}
