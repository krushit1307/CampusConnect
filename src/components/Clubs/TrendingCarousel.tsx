import { OptimizedImage } from "@/components/media/OptimizedImage";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

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
  if (!clubs || clubs.length === 0) return null;

  return (
    <div className="w-full neu-border bg-lavender p-6 md:p-8 relative neu-shadow mb-6">
      <h2 className="text-2xl font-bold mb-4 font-display">🔥 Trending Clubs</h2>

      <Carousel className="w-full">
        <CarouselContent>
          {clubs.map((club) => (
            <CarouselItem key={club.id} className="basis-[280px]">
              <div className="h-full rounded-xl border-2 border-black shadow-[4px_4px_0_0_var(--color-ink)] bg-white overflow-hidden transition-transform hover:-translate-y-1 hover:translate-x-1 hover:shadow-[0_0_0_0_var(--color-ink)] cursor-grab active:cursor-grabbing flex flex-col">
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

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-display font-bold text-lg truncate">{club.name}</h3>

                  <p className="font-mono text-gray-500 text-sm mt-2 line-clamp-2">
                    {club.description}
                  </p>

                  <div className="mt-auto pt-4">
                    <p className="font-mono font-bold text-sm bg-lime inline-block px-2 py-1 border-2 border-black">
                      👥 {club.member_count} Members
                    </p>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <div className="hidden sm:block">
          <CarouselPrevious className="left-0 -translate-x-1/2 bg-white border-2 border-black shadow-[2px_2px_0_0_var(--color-ink)]" />
          <CarouselNext className="right-0 translate-x-1/2 bg-white border-2 border-black shadow-[2px_2px_0_0_var(--color-ink)]" />
        </div>
      </Carousel>
    </div>
  );
}
