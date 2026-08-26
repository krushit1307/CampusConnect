import { Link } from "react-router-dom";
import { useEventCardContext } from "./EventCardContext";
import { EventCardProgressBar } from "./EventCardProgressBar";
import { EventCardDetails } from "./EventCardDetails";
import { getEventTldr } from "@/lib/eventSummary";

export function EventCardBody() {
  const { event, club } = useEventCardContext();

  return (
    <>
      <p className="mt-3 font-mono text-xs font-bold uppercase text-black">Event</p>
      <Link to={`/events/${event.id}`} className="group">
        <h2 className="mt-1 text-2xl font-black text-violet-900 group-hover:underline">
          {event.title}
        </h2>
      </Link>
      <p className="mt-1 font-mono text-sm font-bold text-blue-900">{club?.name}</p>

      {(event.tldr_summary || event.description) && (
        <p className="mt-3 border-l-4 border-black/30 pl-3 font-mono text-sm font-semibold leading-relaxed text-black/80">
          <span className="mr-1 text-[10px] font-black uppercase tracking-wider text-black/60">
            TL;DR:
          </span>
          {getEventTldr(event.tldr_summary, event.description)}
        </p>
      )}

      <EventCardProgressBar />
      <EventCardDetails />
    </>
  );
}
