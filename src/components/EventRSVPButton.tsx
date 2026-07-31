import { toast } from "sonner";

interface EventRSVPButtonProps {
  eventId: string;
  user: { id: string } | null;
  hasRsvpd: boolean;
  isPending: boolean;
  onToggle: (eventId: string, hasRsvpd: boolean) => void;
}

export function EventRSVPButton({
  eventId,
  user,
  hasRsvpd,
  isPending,
  onToggle,
}: EventRSVPButtonProps) {
  const handleClick = () => {
    if (!user) {
      toast.error("Please log in to RSVP");
      return;
    }

    onToggle(eventId, hasRsvpd);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      aria-pressed={hasRsvpd}
      aria-label={isPending ? "Updating RSVP" : hasRsvpd ? "Cancel RSVP" : "RSVP to this event"}
      aria-busy={isPending}
      className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
        hasRsvpd ? "bg-lime text-black" : "bg-black text-cream"
      }`}
    >
      {isPending ? "Updating..." : hasRsvpd ? "RSVP'd ✓" : "RSVP →"}
    </button>
  );
}
