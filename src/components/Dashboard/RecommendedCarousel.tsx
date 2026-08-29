import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, queryClient } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { OptimizedImage } from "@/components/media/OptimizedImage";
import Sparkles from "lucide-react/dist/esm/icons/sparkles";
import Calendar from "lucide-react/dist/esm/icons/calendar";
import MapPin from "lucide-react/dist/esm/icons/map-pin";
import Loader2 from "lucide-react/dist/esm/icons/loader-2";
import Check from "lucide-react/dist/esm/icons/check";
import { toast } from "sonner";

interface RecommendedEvent {
  id: string;
  title: string;
  description: string;
  event_date: string | null;
  location: string;
  banner_url: string | null;
  club_id: string;
  similarity: number;
}

interface RecommendedCarouselProps {
  userId: string;
  hasInterestVector: boolean;
  events: RecommendedEvent[];
  isLoading: boolean;
  refetch: () => void;
}

const SEED_TAGS = [
  { id: "tech", label: "💻 Technology" },
  { id: "art", label: "🎨 Art & Design" },
  { id: "sports", label: "⚽ Sports & Fitness" },
  { id: "music", label: "🎵 Music & Theater" },
  { id: "career", label: "💼 Career & Finance" },
  { id: "social", label: "🤝 Social & Mixers" },
];

export default function RecommendedCarousel({
  userId,
  hasInterestVector,
  events,
  isLoading,
  refetch,
}: RecommendedCarouselProps) {
  const supabase = createClient();
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const seedInterestsMutation = useMutation({
    mutationFn: async (tags: string[]) => {
      const { error } = await supabase.rpc("seed_user_interest_vector", {
        p_user_id: userId,
        p_tags: tags,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Onboarding interests saved successfully!");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
    },
    onError: (err: any) => {
      toast.error(`Failed to save interests: ${err.message}`);
    },
  });

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleSaveInterests = () => {
    if (selectedTags.length === 0) {
      toast.error("Please select at least one interest tag.");
      return;
    }
    seedInterestsMutation.mutate(selectedTags);
  };

  if (isLoading) {
    return (
      <div className="w-full neu-border bg-lime/10 p-6 md:p-8 relative neu-shadow mb-6 animate-pulse">
        <div className="h-8 w-48 bg-gray-300 rounded mb-4" />
        <div className="h-40 w-full bg-gray-200 rounded" />
      </div>
    );
  }

  // Cold Start Onboarding state
  if (!hasInterestVector) {
    return (
      <div className="w-full neu-border bg-peach p-6 md:p-8 relative neu-shadow mb-6">
        <div className="absolute -top-8 -right-8 w-24 h-24 bg-lime rounded-full border-4 border-black opacity-30 pointer-events-none" />
        <div className="max-w-2xl relative z-10">
          <div className="inline-flex items-center gap-2 bg-white border-2 border-black px-3 py-1 font-mono text-xs font-bold uppercase mb-4">
            <Sparkles className="h-4 w-4 fill-black" />
            AI Recommendations Onboarding
          </div>
          <h2 className="text-2xl font-display font-black text-black uppercase mb-2">
            Personalize Your Event Feed
          </h2>
          <p className="text-sm font-mono text-gray-800 leading-relaxed mb-6">
            Select your interest keywords to seed your semantic matching profile. Supabase pgvector
            will suggest matching events in real-time.
          </p>

          <div className="flex flex-wrap gap-2.5 mb-6">
            {SEED_TAGS.map((tag) => {
              const isSelected = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  onClick={() => toggleTag(tag.id)}
                  className={`neu-border px-3.5 py-2 font-mono text-xs font-bold transition-all ${
                    isSelected
                      ? "bg-black text-white -translate-y-0.5"
                      : "bg-white text-black hover:-translate-y-0.5"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    {tag.label}
                    {isSelected && <Check className="h-3 w-3 stroke-[3] text-lime" />}
                  </span>
                </button>
              );
            })}
          </div>

          <button
            onClick={handleSaveInterests}
            disabled={seedInterestsMutation.isPending || selectedTags.length === 0}
            className="neu-border bg-lime px-4 py-2 font-mono text-xs font-bold uppercase transition-transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-[2px_2px_0_0_#000]"
          >
            {seedInterestsMutation.isPending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Seeding Profile...
              </>
            ) : (
              "Save & Generate Feed"
            )}
          </button>
        </div>
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="w-full neu-border bg-lime/10 p-6 md:p-8 relative neu-shadow mb-6">
      <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-3">
        <h2 className="text-2xl font-bold font-display flex items-center gap-2">
          ✨ Recommended For You
        </h2>
        <span className="font-mono text-xs font-bold bg-white border-2 border-black px-2 py-0.5">
          AI Semantic Search
        </span>
      </div>

      <Carousel className="w-full">
        <CarouselContent>
          {events.map((event) => {
            const matchPercent = Math.round(event.similarity * 100);
            return (
              <CarouselItem key={event.id} className="basis-[300px]">
                <div className="h-full rounded-xl border-2 border-black shadow-[4px_4px_0_0_var(--color-ink)] bg-white overflow-hidden transition-transform hover:-translate-y-1 hover:translate-x-1 hover:shadow-[0_0_0_0_var(--color-ink)] cursor-grab active:cursor-grabbing flex flex-col justify-between">
                  <div>
                    {event.banner_url ? (
                      <OptimizedImage
                        src={event.banner_url}
                        alt={event.title}
                        width={300}
                        height={160}
                        responsiveWidths={[300, 600]}
                        sizes="(max-width: 640px) 300px, 300px"
                        className="h-40 w-full object-cover border-b-2 border-black"
                        fallback={
                          <img
                            src={event.banner_url}
                            alt={event.title}
                            className="h-40 w-full object-cover border-b-2 border-black"
                          />
                        }
                      />
                    ) : (
                      <div className="h-40 w-full bg-peach flex items-center justify-center border-b-2 border-black font-display font-black text-white text-3xl uppercase tracking-wider p-4 text-center select-none">
                        {event.title.substring(0, 3)}
                      </div>
                    )}

                    <div className="p-4 space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="font-mono text-[10px] font-black uppercase bg-lime border-2 border-black px-2 py-0.5">
                          {matchPercent}% Match
                        </span>
                        <div className="flex items-center gap-1 text-[10px] font-mono text-gray-500">
                          <Calendar className="h-3 w-3" />
                          {event.event_date
                            ? new Date(event.event_date).toLocaleDateString("en", {
                                month: "short",
                                day: "numeric",
                              })
                            : "TBA"}
                        </div>
                      </div>

                      <h3 className="font-display font-bold text-lg leading-tight line-clamp-1">
                        {event.title}
                      </h3>

                      <p className="font-mono text-gray-500 text-xs line-clamp-2">
                        {event.description}
                      </p>
                    </div>
                  </div>

                  <div className="p-4 border-t border-black/10 flex items-center justify-between gap-2 mt-auto">
                    <div className="flex items-center gap-1 font-mono text-[10px] text-gray-500 truncate">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="truncate">{event.location}</span>
                    </div>
                    <Link
                      to={`/events/${event.id}`}
                      className="neu-border bg-white hover:bg-lime/20 px-3 py-1.5 font-mono text-xs font-bold uppercase transition-colors shrink-0"
                    >
                      View
                    </Link>
                  </div>
                </div>
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <div className="hidden sm:block">
          <CarouselPrevious className="left-0 -translate-x-1/2 bg-white border-2 border-black shadow-[2px_2px_0_0_var(--color-ink)]" />
          <CarouselNext className="right-0 translate-x-1/2 bg-white border-2 border-black shadow-[2px_2px_0_0_var(--color-ink)]" />
        </div>
      </Carousel>
    </div>
  );
}
