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

  // Event visual themes: background gradients and icons
  const eventThemes = [
    {
      bg: "from-purple-600 to-purple-400",
      icon: "🚀",
      label: "Tech",
    },
    {
      bg: "from-blue-400 to-cyan-300",
      icon: "🎨",
      label: "Art",
    },
    {
      bg: "from-orange-400 to-pink-400",
      icon: "🎤",
      label: "Music",
    },
    {
      bg: "from-green-500 to-emerald-400",
      icon: "📚",
      label: "Learning",
    },
  ];

  const theme = eventThemes[index % eventThemes.length];

  return (
    <article className="group neu-border flex flex-col bg-white transition-all duration-300 hover:-translate-x-1 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-[8px_8px_0_0_#000000] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_0_#000000]">
      {/* Image Header with Date Overlay */}
      <div
        className={`bg-gradient-to-br ${theme.bg} relative flex items-center justify-center overflow-hidden py-12`}
      >
        <div className="text-6xl opacity-30">{theme.icon}</div>
        <div className="absolute bottom-3 left-3 text-white">
          <p className="font-mono text-xs font-bold uppercase opacity-90">
            {event.event_date ? formatDate(event.event_date).split(" at ")[0].toUpperCase() : "TBA"}
          </p>
        </div>
        <span className="absolute right-3 top-3 bg-white px-2 py-1 font-mono text-[10px] font-bold uppercase text-[#123a57]">
          Event
        </span>
      </div>

      {/* Content Section */}
      <div className="flex flex-col p-5">
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
            <dt className="font-bold uppercase text-[#123a57]">Attendees</dt>
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
            hasRsvpd ? "bg-[#f5c66b] text-[#123a57]" : "bg-[#123a57] text-white"
          }`}
        >
          {hasRsvpd ? "RSVP'd ✓" : "RSVP →"}
        </button>
      </div>
    </article>
  );
}
