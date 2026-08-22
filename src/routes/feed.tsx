import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { createClient } from "@/lib/supabase/client";
import { useQuery, useQueries } from "@tanstack/react-query";
import { SiteShell } from "@/components/site/SiteShell";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import { StudySessionMatchmaker } from "@/components/StudySessionMatchmaker";

export default function Feed() {
  const supabase = createClient();
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
  }, [supabase]);

  // 1. Fetch the Personalized Configuration from our Edge Function
  const { data: config, isLoading: isConfigLoading } = useQuery({
    queryKey: ["homepage_config"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("homepage-config");
      if (error) throw error;
      return data; // Returns { carousels: [...] }
    },
    enabled: !!session,
  });

  // 2. Fetch the actual event data in PARALLEL using useQueries
  const carouselQueries = useQueries({
    queries: (config?.carousels || []).map((carousel: any) => ({
      queryKey: ["carousel_events", carousel.id],
      queryFn: async () => {
        // Fallback for global trending (for the Cold Start problem)
        if (carousel.fallback) {
          const { data, error } = await supabase
            .from("events")
            .select("*")
            .is("deleted_at", null)
            .gte("event_date", new Date().toISOString())
            .order("event_date", { ascending: true })
            .limit(12);
          if (error) throw error;
          return data;
        }

        // Otherwise, call the specific SQL RPC we built!
        const { data, error } = await supabase.rpc(carousel.rpc, { p_user_id: session.user.id });
        if (error) throw error;
        return data;
      },
      enabled: !!config && !!session,
      // Aggressive caching (5 minutes) so we don't spam the database on navigation
      staleTime: 5 * 60 * 1000,
    })),
  });

  if (isConfigLoading || !session) {
    return (
      <SiteShell>
        <div className="flex h-[70vh] items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-black" />
        </div>
      </SiteShell>
    );
  }

  return (
    <SiteShell>
      <div>
        {/* Header Section */}
        <section className="border-b-2 border-black bg-peach px-4 py-14 md:px-6">
          <div className="mx-auto max-w-5xl">
            <p className="eyebrow font-bold flex items-center gap-2">
              <Sparkles size={16} /> Personalized Dashboard
            </p>
            <h1 className="mt-2 text-3xl font-bold sm:text-4xl md:text-6xl">
              Discover what's happening.
            </h1>
            <p className="mt-4 font-mono text-gray-700 max-w-xl">
              Curated events based on your major, the clubs you follow, and your campus network.
            </p>
          </div>
        </section>

        {/* Dynamic Carousels Section */}
        <section className="bg-cream min-h-screen px-4 py-12 md:px-6">
          <div className="mx-auto max-w-5xl space-y-16">
            <StudySessionMatchmaker />

            {/* 3. Render each carousel row dynamically based on Edge Function logic */}
            {config?.carousels?.map((carousel: any, index: number) => {
              const queryResult = carouselQueries[index];
              const events = queryResult.data || [];

              // Show skeleton loaders while parallel queries are resolving
              if (queryResult.isLoading) {
                return (
                  <div key={carousel.id} className="space-y-6">
                    <h2 className="font-display text-3xl font-bold uppercase tracking-tight">
                      {carousel.title}
                    </h2>
                    <div className="flex gap-6 overflow-x-auto pb-6">
                      <div className="h-80 w-80 bg-gray-200 animate-pulse neu-border rounded-lg shrink-0"></div>
                      <div className="h-80 w-80 bg-gray-200 animate-pulse neu-border rounded-lg shrink-0"></div>
                      <div className="h-80 w-80 bg-gray-200 animate-pulse neu-border rounded-lg shrink-0 hidden md:block"></div>
                    </div>
                  </div>
                );
              }

              // Don't render the section at all if there are no events returned for this category
              if (events.length === 0) return null;

              return (
                <section key={carousel.id} className="space-y-6">
                  <div className="flex items-end justify-between border-b-2 border-black pb-2">
                    <h2 className="font-display text-3xl font-bold uppercase tracking-tight">
                      {carousel.title}
                    </h2>
                    <Link
                      to="/events"
                      className="font-mono text-xs font-bold uppercase hover:underline text-brand-blue-dark"
                    >
                      View all →
                    </Link>
                  </div>

                  {/* Horizontal Scroll Container */}
                  <div className="flex gap-6 overflow-x-auto pb-6 snap-x pt-2 scrollbar-hide">
                    {events.map((event: any) => (
                      <Link
                        key={event.id}
                        to={`/events/${event.id}`}
                        className="w-[300px] md:w-[350px] shrink-0 snap-start block outline-none"
                      >
                        <div className="neu-border bg-white h-full flex flex-col transition-all hover:-translate-y-2 hover:shadow-[8px_8px_0_0_#000]">
                          {event.banner_url ? (
                            <img
                              src={event.banner_url}
                              alt={event.title}
                              className="h-40 w-full object-cover border-b-2 border-black"
                            />
                          ) : (
                            <div className="h-40 w-full bg-lime border-b-2 border-black flex items-center justify-center font-bold font-mono">
                              NO BANNER
                            </div>
                          )}

                          <div className="p-5 flex flex-col flex-grow">
                            <h3 className="font-bold font-display text-xl line-clamp-2 leading-tight">
                              {event.title}
                            </h3>

                            <div className="mt-4 space-y-2 font-mono text-xs text-gray-600">
                              <div className="flex items-center gap-2">
                                <Calendar size={14} className="text-black" />
                                <span>
                                  {new Date(event.event_date).toLocaleDateString(undefined, {
                                    weekday: "short",
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </span>
                              </div>
                              {event.location && (
                                <div className="flex items-center gap-2">
                                  <MapPin size={14} className="text-black shrink-0" />
                                  <span className="line-clamp-1">{event.location}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-auto pt-6">
                              <span className="inline-block bg-brand-peach-light text-black border-2 border-black px-3 py-1 text-xs font-mono font-bold uppercase">
                                RSVP Now
                              </span>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </section>
      </div>
    </SiteShell>
  );
}
