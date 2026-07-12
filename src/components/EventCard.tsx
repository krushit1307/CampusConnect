import { formatDate } from "@/lib/utils";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  clubs: { name: string } | { name: string }[] | null;
  event_rsvps: { id: string; user_id: string }[] | null;
}

interface EventCardProps {
  event: Event;
  index: number;
  user: { id: string } | null;
  onRsvpToggle: (eventId: string, hasRsvpd: boolean) => void;
  isRsvpPending: boolean;
}

export function EventCard({ event, index, user, onRsvpToggle, isRsvpPending }: EventCardProps) {
  const c = Array.isArray(event.clubs) ? event.clubs[0] : event.clubs;
  const rsvps = Array.isArray(event.event_rsvps) ? event.event_rsvps : [];
  const hasRsvpd = user ? rsvps.some((r) => r.user_id === user.id) : false;

  const colors = ["bg-lime", "bg-sky", "bg-peach", "bg-lavender"];

  return (
    <article className="group neu-border flex flex-col bg-white p-5 transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[8px_8px_0_0_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_#000000]">
      <div className="mb-4 flex items-start justify-between">
        <div
          className={`neu-border ${colors[index % colors.length]} px-4 py-3 text-center font-mono text-xs font-bold transition-transform duration-300 group-hover:scale-105`}
        >
          {event.event_date ? formatDate(event.event_date).split(" at ")[0].toUpperCase() : "TBA"}
        </div>
        <span className="neu-border bg-cream px-2 py-1 font-mono text-[10px] font-bold uppercase transition-transform duration-300 group-hover:scale-105">
          Event
        </span>
      </div>
      <h2 className="text-xl font-bold transition-colors duration-300 group-hover:text-black/80">
        {event.title}
      </h2>
      <p className="mt-1 font-mono text-xs">{c?.name}</p>
      <div className="my-4 border-t-2 border-black" />

      <dl className="flex-grow space-y-1 font-mono text-xs">
        <div className="flex flex-col gap-0.5 border-b border-gray-100 pb-1.5">
          <dt className="font-bold uppercase text-gray-500">Date & Time</dt>
          <dd className="font-medium text-black">
            {event.event_date ? formatDate(event.event_date) : "TBA"}
          </dd>
        </div>
        <div className="flex justify-between pt-1.5">
          <dt className="font-bold uppercase">Venue</dt>
          <dd>{event.location || "TBA"}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="font-bold uppercase text-lime-600">Attendees</dt>
          <dd className="font-bold">{rsvps.length} RSVP'd</dd>
        </div>
      </dl>

      <button
        onClick={() => {
          if (!user) return alert("Please log in to RSVP");
          onRsvpToggle(event.id, hasRsvpd);
        }}
        disabled={isRsvpPending}
        className={`neu-border mt-5 px-4 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-all duration-300 hover:scale-105 active:scale-95 ${
          hasRsvpd ? "bg-lime text-black" : "bg-black text-cream"
        }`}
      >
        {hasRsvpd ? "RSVP'd ✓" : "RSVP →"}
      </button>
    </article>
  );
}
