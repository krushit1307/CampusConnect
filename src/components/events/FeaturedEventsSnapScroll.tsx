import React from "react";
import { Link } from "react-router-dom";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import ChevronDown from "lucide-react/dist/esm/icons/chevron-down";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import ArrowRight from "lucide-react/dist/esm/icons/arrow-right";
import { SnapScrollContainer, SnapSection } from "@/components/ui/SnapScrollContainer";
import { formatDate } from "@/lib/utils";
import { FeaturedEvent } from "@/components/home/featuredGrid";
import { Button } from "@/components/ui/button";

export interface FeaturedEventsSnapScrollProps {
  events: FeaturedEvent[];
  className?: string;
}

/**
 * Full-Screen 100dvh Cinematic Snap Scroll Experience for Featured Events (#1741).
 * Features vertical snap scrolling, parallax backdrop, high-res banners,
 * dot navigation, and smooth viewport locking.
 */
export const FeaturedEventsSnapScroll: React.FC<FeaturedEventsSnapScrollProps> = ({
  events,
  className,
}) => {
  if (!events || events.length === 0) return null;

  const limitedEvents = events.slice(0, 5);
  const sectionLabels = limitedEvents.map((e) => e.title || "Featured Event");

  return (
    <SnapScrollContainer sectionLabels={sectionLabels} className={className}>
      {limitedEvents.map((event, index) => {
        const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;
        const isLast = index === limitedEvents.length - 1;

        return (
          <SnapSection key={event.id} id={`featured-snap-${event.id}`}>
            {/* Background Image / Gradient */}
            <div className="absolute inset-0 z-0">
              {event.banner_url ? (
                <img
                  src={event.banner_url}
                  alt={event.title}
                  className="w-full h-full object-cover object-center filter brightness-[0.4] scale-105 transition-transform duration-1000"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-gray-900 via-purple-950 to-black opacity-90" />
              )}
              {/* Overlay Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
            </div>

            {/* Foreground Content Card */}
            <div className="relative z-10 max-w-5xl mx-auto px-6 py-12 text-white flex flex-col justify-end h-full pb-20 md:pb-24">
              <div className="space-y-4 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="neu-border bg-lime text-black px-3 py-1 font-mono text-xs font-bold uppercase tracking-wider rounded-full flex items-center gap-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                    <Sparkles className="w-3.5 h-3.5 fill-black" />
                    Featured #{index + 1}
                  </span>
                  {event.event_date && (
                    <span className="neu-border bg-white text-black px-3 py-1 font-mono text-xs font-bold uppercase rounded-full shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {formatDate(event.event_date).split(" at ")[0]}
                    </span>
                  )}
                  {clubName && (
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-gray-300 bg-black/60 px-3 py-1 rounded-full border border-white/20">
                      {clubName}
                    </span>
                  )}
                </div>

                <h1 className="font-display font-extrabold text-3xl sm:text-5xl lg:text-6xl text-white leading-tight tracking-tight drop-shadow-lg">
                  {event.title}
                </h1>

                {event.location && (
                  <p className="font-mono text-sm text-lime flex items-center gap-2 font-bold">
                    <MapPin className="w-4 h-4 shrink-0" />
                    {event.location}
                  </p>
                )}

                {event.description && (
                  <p className="font-mono text-sm sm:text-base text-gray-200 line-clamp-3 leading-relaxed max-w-xl">
                    {event.description}
                  </p>
                )}

                <div className="pt-4 flex items-center gap-4">
                  <Button
                    asChild
                    className="neu-border bg-lime text-black hover:bg-lime/90 font-mono font-bold text-sm uppercase px-6 py-6 rounded-xl shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                  >
                    <Link to={`/events/${event.id}`}>
                      View Event Details <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </div>
            </div>

            {/* Scroll Down Indicator */}
            {!isLast && (
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-1 text-white/70 animate-bounce pointer-events-none">
                <span className="font-mono text-[10px] uppercase font-bold tracking-widest">
                  Snap Scroll
                </span>
                <ChevronDown className="w-5 h-5 text-lime" />
              </div>
            )}
          </SnapSection>
        );
      })}
    </SnapScrollContainer>
  );
};
