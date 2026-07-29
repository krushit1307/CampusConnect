import { createContext, useContext, useState, ReactNode } from "react";
import { getCountdown, getGoogleCalendarUrl } from "@/lib/utils";
import { toast } from "sonner";

export interface Event {
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

export interface EventCardProps {
  event: Event;
  index?: number;
  user?: { id: string } | null;
  onRsvpToggle?: (eventId: string, hasRsvpd: boolean) => void;
  isRsvpPending?: boolean;
  onBookmarkToggle?: (eventId: string, isSaved: boolean) => void;
  isBookmarkPending?: boolean;
  children?: ReactNode;
}

export interface EventCardContextValue {
  event: Event;
  index: number;
  user: { id: string } | null;
  onRsvpToggle?: (eventId: string, hasRsvpd: boolean) => void;
  isRsvpPending: boolean;
  onBookmarkToggle?: (eventId: string, isSaved: boolean) => void;
  isBookmarkPending: boolean;
  club: { name: string } | null;
  rsvps: { id: string; user_id: string }[];
  myRsvp: { id: string; user_id: string } | null;
  hasRsvpd: boolean;
  isSaved: boolean;
  googleCalendarUrl: string;
  countdown: string;
  cardBg: string;
  copied: boolean;
  ticketOpen: boolean;
  setTicketOpen: (open: boolean) => void;
  confirmOpen: boolean;
  setConfirmOpen: (open: boolean) => void;
  isDescriptionExpanded: boolean;
  setIsDescriptionExpanded: React.Dispatch<React.SetStateAction<boolean>>;
  handleCopyLink: () => Promise<void>;
  handleShare: () => Promise<void>;
  handleRsvpToggleClick: (eventId: string, currentHasRsvpd: boolean) => void;
  handleBookmarkClick: () => void;
}

const EventCardContext = createContext<EventCardContextValue | null>(null);

export function useEventCardContext(): EventCardContextValue {
  const context = useContext(EventCardContext);
  if (!context) {
    throw new Error("useEventCardContext must be used within an <EventCard> compound component");
  }
  return context;
}

export function EventCardProvider({
  event,
  index = 0,
  user = null,
  onRsvpToggle,
  isRsvpPending = false,
  onBookmarkToggle,
  isBookmarkPending = false,
  children,
}: EventCardProps) {
  const club = Array.isArray(event.clubs) ? event.clubs[0] || null : event.clubs || null;
  const rsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps : [];
  const myRsvp = user ? rsvps.find((rsvp) => rsvp.user_id === user.id) || null : null;
  const hasRsvpd = !!myRsvp;

  const savedEventsList = Array.isArray(event.saved_events) ? event.saved_events : [];
  const isSaved = user ? savedEventsList.some((se) => se.user_id === user.id) : false;

  const colors = ["bg-lime", "bg-sky", "bg-peach"];
  const cardBg = colors[index % colors.length];

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
    } catch {
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
    } catch {
      toast.error("Failed to copy link.");
    }
  };

  const handleRsvpToggleClick = (eventId: string, currentHasRsvpd: boolean) => {
    if (currentHasRsvpd) {
      setConfirmOpen(true);
    } else {
      onRsvpToggle?.(eventId, false);
    }
  };

  const handleBookmarkClick = () => {
    if (!user) {
      toast.error("Please log in to bookmark events");
      return;
    }
    onBookmarkToggle?.(event.id, isSaved);
  };

  const value: EventCardContextValue = {
    event,
    index,
    user,
    onRsvpToggle,
    isRsvpPending,
    onBookmarkToggle,
    isBookmarkPending,
    club,
    rsvps,
    myRsvp,
    hasRsvpd,
    isSaved,
    googleCalendarUrl,
    countdown,
    cardBg,
    copied,
    ticketOpen,
    setTicketOpen,
    confirmOpen,
    setConfirmOpen,
    isDescriptionExpanded,
    setIsDescriptionExpanded,
    handleCopyLink,
    handleShare,
    handleRsvpToggleClick,
    handleBookmarkClick,
  };

  return <EventCardContext.Provider value={value}>{children}</EventCardContext.Provider>;
}
