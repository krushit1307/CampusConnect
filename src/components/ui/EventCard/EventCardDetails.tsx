import { useEventCardContext } from "./EventCardContext";
import { EventDualClockTime } from "@/components/EventDualClockTime";
import { useEventDualClock } from "@/hooks/useEventDualClock";

export function EventCardDetails() {
  const { event, rsvps } = useEventCardContext();
  const { data } = useEventDualClock(event);

  return (
    <dl className="mt-5 grid gap-4 sm:grid-cols-3">
      <div>
        <dt className="font-mono text-xs font-bold uppercase text-black">
          Date &amp; Time
        </dt>
        <dd className="mt-1 text-sm text-red-900">
          <EventDualClockTime
            data={data}
            venueLabel={event.location || undefined}
            variant="compact"
          />
        </dd>
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
