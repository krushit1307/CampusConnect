import React from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Info, Loader2 } from "lucide-react";
import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";

interface RecommendedEvent {
  id: string;
  title: string;
  description: string;
  relevance_score: number;
  recommendation_reason: string;
}

export default function SuggestedEventsCarousel({ userId }: { userId: string }) {
  const [emblaRef] = useEmblaCarousel({ align: "start", dragFree: true });
  const supabase = createClient();

  // Fetch the real data from your new Postgres RPC
  const { data: events, isLoading } = useQuery({
    queryKey: ["recommended-events", userId],
    queryFn: async (): Promise<RecommendedEvent[]> => {
      const { data, error } = await supabase.rpc("get_recommended_events", {
        p_user_id: userId,
      });

      if (error) throw error;
      return data || [];
    },
    enabled: !!userId, // Don't fetch until we have the user ID
  });

  if (isLoading) {
    return (
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Recommended For You</h2>
        <div className="flex h-48 items-center justify-center neu-border bg-white">
          <Loader2 className="h-8 w-8 animate-spin text-black" />
        </div>
      </div>
    );
  }

  // If the user has no recommendations, hide the carousel entirely
  if (!events || events.length === 0) return null;

  return (
    <div className="mb-8">
      <h2 className="text-xl font-bold mb-4">Recommended For You</h2>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 touch-pan-y py-2">
          {events.map((event) => (
            <div
              key={event.id}
              className="flex-[0_0_280px] min-w-0 bg-white border-2 border-black rounded-sm p-4 shadow-[4px_4px_0_0_#000] relative group transition-transform hover:-translate-y-1 hover:shadow-[6px_6px_0_0_#000]"
            >
              <h3 className="font-display font-bold text-lg truncate">{event.title}</h3>
              <p className="font-mono text-gray-600 text-sm mt-2 line-clamp-2">
                {event.description}
              </p>

              <div className="mt-4 flex items-center font-mono text-xs font-bold text-blue-600 cursor-help">
                <Info className="w-4 h-4 mr-1" />
                Why am I seeing this?
                <span className="invisible group-hover:visible absolute bg-black text-white p-2 text-xs bottom-full left-0 mb-2 w-48 z-10 border-2 border-black shadow-[2px_2px_0_0_#000]">
                  {event.recommendation_reason}
                </span>
              </div>

              <button className="mt-4 w-full bg-lime text-black border-2 border-black font-mono font-bold py-2 hover:bg-peach transition-colors shadow-[2px_2px_0_0_#000] hover:shadow-[4px_4px_0_0_#000] active:translate-y-0.5 active:shadow-[0px_0px_0_0_#000]">
                RSVP
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
