import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { LazyMotion, m } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { Parallax3DCard } from "@/components/ui/Parallax3DCard";
import { sortFeaturedEvents, type FeaturedEvent } from "./featuredGrid";
import { loadDomMax } from "@/lib/motionFeatures";

interface FeaturedEventsProps {
  events: FeaturedEvent[];
}

// Native scroll distance for the Prev/Next buttons (issue spec).
const SCROLL_STEP = 300;

export function FeaturedEvents({ events }: FeaturedEventsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const updateButtons = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollPrev(scrollLeft > 4);
    // 1px buffer for sub-pixel rounding
    setCanScrollNext(Math.ceil(scrollLeft + clientWidth) < scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateButtons();
    el.addEventListener("scroll", updateButtons, { passive: true });
    window.addEventListener("resize", updateButtons);
    return () => {
      el.removeEventListener("scroll", updateButtons);
      window.removeEventListener("resize", updateButtons);
    };
  }, [updateButtons]);

  if (!events || events.length === 0) return null;

  const limited = events.slice(0, 5);
  const sorted = sortFeaturedEvents(limited);

  const scrollPrev = () => {
    trackRef.current?.scrollBy({ left: -SCROLL_STEP, behavior: "smooth" });
  };

  const scrollNext = () => {
    trackRef.current?.scrollBy({ left: SCROLL_STEP, behavior: "smooth" });
  };

  return (
    <LazyMotion features={loadDomMax} strict={import.meta.env.DEV}>
      <div className="relative">
        <div
          data-testid="featured-events-carousel"
          ref={trackRef}
          role="region"
          aria-roledescription="carousel"
          aria-label="Featured events"
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {sorted.map((event, index) => {
            const isHero = index === 0;
            const clubName = Array.isArray(event.clubs) ? event.clubs[0]?.name : event.clubs?.name;

            return (
              <div
                key={event.id}
                data-testid={isHero ? "featured-event-hero" : "featured-event-slide"}
                className="flex-[0_0_85%] snap-center pr-4 h-[260px] md:h-[340px]"
              >
                <Parallax3DCard className="h-full w-full rounded-xl">
                  <Link
                    to={`/events/${event.id}`}
                    aria-label={`Featured event: ${event.title}`}
                    className="group relative block h-full w-full overflow-hidden rounded-xl neu-border transition-transform duration-300 hover:shadow-lg bg-gray-900"
                  >
                    {event.banner_url ? (
                      <m.img
                        layoutId={`event-image-${event.id}`}
                        src={event.banner_url}
                        alt={event.title}
                        className="absolute inset-0 h-full w-full object-cover object-center opacity-60 transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <m.div
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
              </div>
            );
          })}
        </div>

        {/* Prev/Next — hidden on mobile (swiping is natural), prominent on
          desktop where the scrollbar is hidden and a mouse can't swipe. */}
        <button
          type="button"
          onClick={scrollPrev}
          disabled={!canScrollPrev}
          aria-label="Previous featured events"
          className="hidden md:inline-flex absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-white text-black shadow-[2px_2px_0_0_var(--color-ink)] transition-colors hover:bg-brand-peach-light disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={scrollNext}
          disabled={!canScrollNext}
          aria-label="Next featured events"
          className="hidden md:inline-flex absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 h-11 w-11 items-center justify-center rounded-full border-2 border-black bg-white text-black shadow-[2px_2px_0_0_var(--color-ink)] transition-colors hover:bg-brand-peach-light disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </LazyMotion>
  );
}
