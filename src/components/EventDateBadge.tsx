import { formatDate } from "@/lib/utils";

interface EventDateBadgeProps {
  eventDate: string | null;
}

export function EventDateBadge({ eventDate }: EventDateBadgeProps) {
  return (
    <p className="font-mono text-xs font-bold uppercase tracking-wider">
      {eventDate ? formatDate(eventDate).split(" at ")[0].toUpperCase() : "TBA"}
    </p>
  );
}
