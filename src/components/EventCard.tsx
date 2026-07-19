import { formatDate, getGoogleCalendarUrl, formatEventDateRange } from "@/lib/utils";
import { Link } from "react-router-dom";
import { FormEvent, useState } from "react";
import { Calendar, Check, Share2, X, Link as LinkIcon, Bookmark } from "lucide-react";
import { toast } from "sonner";
import { TicketDialog } from "@/components/ui/ticket-modal";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EventDateBadge } from "@/components/EventDateBadge";
import { EventRSVPButton } from "@/components/EventRSVPButton";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  banner_url?: string | null;
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
  const colors = ["bg-lime", "bg-sky", "bg-peach", "bg-lavender"];
  const googleCalendarUrl = getGoogleCalendarUrl({
    title: event.title,
    description: event.description,
    event_date: event.event_date,
    start_date: event.start_date,
    end_date: event.end_date,
    location: event.location,
  });

  const [copied, setCopied] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

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

  const handleRsvpClick = () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    if (hasRsvpd) {
      setConfirmOpen(true);
      return;
    }

    onRsvpToggle(event.id, false);
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
    <article
      id={`event-${event.id}`}
      className={`neu-border p-5 relative ${colors[index % colors.length]}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-xs font-bold uppercase tracking-wider pr-10">
          {event.event_date ? formatDate(event.event_date).split(" at ")[0].toUpperCase() : "TBA"}
        </p>
        <div className="flex gap-2 relative z-10">
          <button
            type="button"
            onClick={handleBookmarkClick}
            disabled={isBookmarkPending}
            className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-60"
            aria-label={isSaved ? "Unsave event" : "Save event"}
          >
            <Bookmark className="h-4 w-4" fill={isSaved ? "black" : "none"} />
          </button>
          <button
            type="button"
            onClick={handleShare}
            aria-label="Copy event link"
            className="neu-border neu-press grid h-8 w-8 shrink-0 place-items-center bg-white"
          >
            {copied ? (
              <Check aria-hidden="true" size={14} strokeWidth={3} />
            ) : (
              <Share2 aria-hidden="true" size={14} strokeWidth={3} />
            )}
          </button>
        </div>
      </div>

      <p className="mt-3 font-mono text-xs font-bold uppercase">Event</p>
      <Link to={`/events/${event.id}`} className="group">
        <h2 className="mt-1 text-2xl font-black group-hover:underline">{event.title}</h2>
      </Link>
      <p className="mt-1 font-mono text-sm font-bold">{club?.name}</p>

      {event.description ? <p className="mt-4 text-sm leading-6">{event.description}</p> : null}

      <dl className="mt-5 grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-xs font-bold uppercase">Date &amp; Time</dt>
          <dd className="mt-1 text-sm">{formatEventDateRange(event)}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs font-bold uppercase">Venue</dt>
          <dd className="mt-1 text-sm">{event.location || "TBA"}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs font-bold uppercase">Attendees</dt>
          <dd className="mt-1 text-sm">{rsvps.length} RSVP'd</dd>
        </div>
      </dl>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <EventRSVPButton
          eventId={event.id}
          user={user}
          hasRsvpd={hasRsvpd}
          isPending={isRsvpPending}
          onToggle={onRsvpToggle}
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
            className="neu-border neu-press bg-white hover:bg-cream h-9 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95"
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
      <TicketDialog
        open={ticketOpen}
        onOpenChange={setTicketOpen}
        event={event}
        rsvpId={myRsvp?.id ?? ""}
      />
    </article>
  );
}
