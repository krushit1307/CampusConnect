interface RSVPButtonProps {
  isPending: boolean;
  hasRsvpd: boolean;
  onClick: () => void;
}

export function RSVPButton({ isPending, hasRsvpd, onClick }: RSVPButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
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
