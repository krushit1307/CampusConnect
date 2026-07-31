import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { formatDate } from "@/lib/utils";
import { Parallax3DCard } from "@/components/ui/Parallax3DCard";
import {
  FEATURED_SLOT_CLASSES,
  pickFeaturedSlot,
  sortFeaturedEvents,
  type FeaturedEvent,
} from "./featuredGrid";

interface FeaturedEventsProps {
  events: FeaturedEvent[];
}

export function FeaturedEvents({ events }: FeaturedEventsProps) {
  if (!events || events.length === 0) return null;

  // Cap to 5 tiles so the grid stays tightly packed (issue spec mentions
  // 2x2 hero + landscape + standard + portrait fills a 4-col, 2-row grid).
  const limited = events.slice(0, 5);
  const sorted = sortFeaturedEvents(limited);

  return (
    <div
      data-testid="featured-events-grid"
      className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-2 md:grid-flow-dense gap-4 auto-rows-[250px] md:auto-rows-[300px]"
    >
      {sorted.map((event, index) => {
        const slot = pickFeaturedSlot(event, index, sorted.length, sorted);
        const spanClass = FEATURED_SLOT_CLASSES[slot];
        const isHero = slot === "hero";

        const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;

        return (
          <Parallax3DCard
            key={event.id}
            className={spanClass}
            data-testid={`featured-event-${slot}`}
          >
            <Link
              to={`/events/${event.id}`}
              aria-label={`Featured event: ${event.title}`}
              className="group relative block h-full w-full overflow-hidden rounded-xl neu-border transition-transform duration-300 hover:shadow-lg bg-gray-900"
            >
              {event.banner_url ? (
                <motion.img
                  layoutId={`event-image-${event.id}`}
                  src={event.banner_url}
                  alt={event.title}
                  className="absolute inset-0 h-full w-full object-cover object-center opacity-60 transition-transform duration-500 group-hover:scale-105"
                />
              ) : (
                <motion.div
                  layoutId={`event-image-${event.id}`}
                  className="absolute inset-0 bg-gradient-to-br from-brand-blue-dark to-violet-900 opacity-80"
                />
              )}

              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

              <div className="absolute inset-0 flex flex-col justify-end p-6 z-10">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="inline-block rounded-full bg-brand-peach-light px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-brand-blue-dark">
                    {event.event_date ? formatDate(event.event_date).split(" at ")[0] : "TBA"}
                  </span>
                  {isHero && (
                    <span className="inline-block rounded-full bg-brand-peach-light/90 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase text-brand-blue-dark">
                      Featured
                    </span>
                  )}
                  {clubName && (
                    <span className="inline-block font-mono text-[10px] font-bold uppercase text-white/80 truncate">
                      {clubName}
                    </span>
                  )}
                </div>
                <h3
                  className={`font-display font-bold text-white leading-tight mb-2 group-hover:text-brand-peach-light transition-colors ${
                    isHero ? "text-2xl md:text-4xl" : "text-xl md:text-2xl"
                  }`}
                >
                  {event.title}
                </h3>
                {isHero && event.description && (
                  <p className="font-mono text-sm text-gray-200 line-clamp-2 hidden md:block">
                    {event.description}
                  </p>
                )}
              </div>
            </Link>
          </Parallax3DCard>
        );
      })}
    </div>
  );
}
