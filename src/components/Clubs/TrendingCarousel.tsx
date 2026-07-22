import useEmblaCarousel from "embla-carousel-react";
import { OptimizedImage } from "@/components/media/OptimizedImage";

interface Club {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  member_count: number;
}

interface TrendingCarouselProps {
  clubs: Club[];
}

export default function TrendingCarousel({ clubs }: TrendingCarouselProps) {
  const [emblaRef] = useEmblaCarousel({
    loop: true,
    align: "start",
    dragFree: true,
  });

  if (!clubs || clubs.length === 0) return null;

  return (
    <div className="w-full neu-border bg-lavender p-6 md:p-8 relative neu-shadow mb-6">
      <h2 className="text-2xl font-bold mb-4 font-display">🔥 Trending Clubs</h2>

      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4">
          {clubs.map((club) => (
            <div
              key={club.id}
              className="min-w-[280px] rounded-xl border-2 border-black shadow-[4px_4px_0_0_var(--color-ink)] bg-white overflow-hidden transition-transform hover:-translate-y-1 hover:translate-x-1 hover:shadow-[0_0_0_0_var(--color-ink)] cursor-grab active:cursor-grabbing"
            >
              <OptimizedImage
                src={club.image_url || "https://placehold.co/600x400/png"}
                alt={club.name}
                width={600}
                height={160}
                className="h-40 w-full object-cover border-b-2 border-black"
                fallback={
                  <img
                    src="https://placehold.co/600x400/png"
                    alt={club.name}
                    className="h-40 w-full object-cover border-b-2 border-black"
                  />
                }
              />

              <div className="p-4">
                <h3 className="font-display font-bold text-lg truncate">{club.name}</h3>

                <p className="font-mono text-gray-500 text-sm mt-2 line-clamp-2">
                  {club.description}
                </p>

                <p className="mt-4 font-mono font-bold text-sm bg-lime inline-block px-2 py-1 border-2 border-black">
                  👥 {club.member_count} Members
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
