import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from "react";
import { getCountdown, getGoogleCalendarUrl } from "@/lib/utils";
import { toast } from "sonner";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";

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

const COLORS = ["bg-lime", "bg-sky", "bg-peach"];

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
  // Derived state memoization
  const club = useMemo(
    () => (Array.isArray(event.clubs) ? event.clubs[0] || null : event.clubs || null),
    [event.clubs],
  );

  const rsvps = useMemo(
    () => (Array.isArray(event.event_rsvps) ? event.event_rsvps : []),
    [event.event_rsvps],
  );

  const myRsvp = useMemo(
    () => (user ? rsvps.find((rsvp) => rsvp.user_id === user.id) || null : null),
    [user, rsvps],
  );

  const hasRsvpd = !!myRsvp;

  const savedEventsList = useMemo(
    () => (Array.isArray(event.saved_events) ? event.saved_events : []),
    [event.saved_events],
  );

  const isSaved = useMemo(
    () => (user ? savedEventsList.some((se) => se.user_id === user.id) : false),
    [user, savedEventsList],
  );

  const googleCalendarUrl =
    getGoogleCalendarUrl({
      title: event.title,
      description: event.description,
      event_date: event.event_date,
      start_date: event.start_date,
      end_date: event.end_date,
      location: event.location,
    }) || "";

  const googleCalendarUrl = useMemo(
    () =>
      getGoogleCalendarUrl({
        title: event.title,
        description: event.description,
        event_date: event.event_date,
        start_date: event.start_date,
        end_date: event.end_date,
        location: event.location,
      }),
    [
      event.title,
      event.description,
      event.event_date,
      event.start_date,
      event.end_date,
      event.location,
    ],
  );

  const { copyToClipboard, isCopied: copied } = useCopyToClipboard();
  const [ticketOpen, setTicketOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);

  const handleCopyLink = async () => {
    if (await copyToClipboard(window.location.href)) {
      toast.success("Link copied!");
    } else {
      toast.error("Failed to copy link.");
    }
  }, []);

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}#event-${event.id}`;
    if (await copyToClipboard(shareUrl)) {
      toast.success("Link copied!");
    } else {
      toast.error("Failed to copy link.");
    }
  }, [event.id]);

  const handleRsvpToggleClick = useCallback(
    (eventId: string, currentHasRsvpd: boolean) => {
      if (currentHasRsvpd) {
        setConfirmOpen(true);
      } else {
        onRsvpToggle?.(eventId, false);
      }
    },
    [onRsvpToggle],
  );

  const handleBookmarkClick = useCallback(() => {
    if (!user) {
      toast.error("Please log in to bookmark events");
      return;
    }
    onBookmarkToggle?.(event.id, isSaved);
  }, [user, onBookmarkToggle, event.id, isSaved]);

  // Context value object memoization
  const value: EventCardContextValue = useMemo(
    () => ({
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
    }),
    [
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
      confirmOpen,
      isDescriptionExpanded,
      handleCopyLink,
      handleShare,
      handleRsvpToggleClick,
      handleBookmarkClick,
    ],
  );

  return <EventCardContext.Provider value={value}>{children}</EventCardContext.Provider>;
}
