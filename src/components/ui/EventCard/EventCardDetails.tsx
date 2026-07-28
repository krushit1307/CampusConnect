import { formatEventDateRange } from "@/lib/utils";
import { useEventCardContext } from "./EventCardContext";

export function EventCardDetails() {
  const { event, rsvps } = useEventCardContext();

  return (
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
  );
}
