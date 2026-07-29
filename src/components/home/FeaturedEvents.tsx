import { Link } from "react-router-dom";
import { formatDate } from "@/lib/utils";

interface FeaturedEvent {
  id: string;
  title: string;
  description: string | null;
  event_date: string | null;
  banner_url?: string | null;
  clubs: { name: string } | { name: string }[] | null;
}

interface FeaturedEventsProps {
  events: FeaturedEvent[];
}

export function FeaturedEvents({ events }: FeaturedEventsProps) {
  if (!events || events.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 gap-4 auto-rows-[250px] md:auto-rows-[300px]">
      {events.slice(0, 5).map((event, index) => {
        // Determine grid span based on index
        let spanClass = "col-span-1 row-span-1";

        if (events.length === 1) {
          spanClass = "md:col-span-4 md:row-span-2";
        } else if (events.length === 2) {
          spanClass = index === 0 ? "md:col-span-2 md:row-span-2" : "md:col-span-2 md:row-span-2";
        } else if (events.length === 3) {
          if (index === 0) spanClass = "md:col-span-2 md:row-span-2";
          else spanClass = "md:col-span-2 md:row-span-1";
        } else if (events.length === 4) {
          if (index === 0) spanClass = "md:col-span-2 md:row-span-2";
          else if (index === 1) spanClass = "md:col-span-2 md:row-span-1";
          else spanClass = "md:col-span-1 md:row-span-1";
        } else if (events.length >= 5) {
          if (index === 0) spanClass = "md:col-span-2 md:row-span-2";
          else if (index === 1) spanClass = "md:col-span-2 md:row-span-1";
          else spanClass = "md:col-span-1 md:row-span-1";
        }

        const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;

        return (
          <Link
            key={event.id}
            to={`/events/${event.id}`}
            className={`group relative overflow-hidden rounded-xl neu-border transition-transform duration-300 hover:-translate-y-1 hover:shadow-lg bg-gray-900 ${spanClass}`}
          >
            {event.banner_url ? (
              <img
                src={event.banner_url}
                alt={event.title}
                className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-500 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-brand-blue-dark to-violet-900 opacity-80" />
            )}

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

            <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
              <div className="flex items-center gap-2 mb-2">
                <span className="inline-block rounded-full bg-brand-peach-light px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-brand-blue-dark">
                  {event.event_date ? formatDate(event.event_date).split(" at ")[0] : "TBA"}
                </span>
                {clubName && (
                  <span className="inline-block font-mono text-[10px] font-bold uppercase text-white/80 truncate">
                    {clubName}
                  </span>
                )}
              </div>
              <h3 className="font-display text-xl md:text-2xl font-bold text-white leading-tight mb-2 group-hover:text-brand-peach-light transition-colors">
                {event.title}
              </h3>
              {index === 0 && event.description && (
                <p className="font-mono text-sm text-gray-200 line-clamp-2 hidden md:block">
                  {event.description}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
