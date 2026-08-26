import { formatDate } from "@/lib/utils";

interface EventDateBadgeProps {
  eventDate: string | null;
}

export function EventDateBadge({ eventDate }: EventDateBadgeProps) {
  const dateText = eventDate ? formatDate(eventDate).split(" at ")[0].toUpperCase() : "TBA";
  return (
    <p
      className="font-mono text-xs font-bold uppercase tracking-wider"
      aria-label={`Event date: ${dateText}`}
    >
      {dateText}
    </p>
  );
}
