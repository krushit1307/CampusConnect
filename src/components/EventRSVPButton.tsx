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
      className={`neu-border px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 ${
        hasRsvpd ? "bg-lime text-black" : "bg-black text-cream"
      }`}
    >
      {isPending ? "Updating..." : hasRsvpd ? "RSVP'd ✓" : "RSVP →"}
    </button>
  );
}
