import { useQuery } from "@/hooks/useReactQueryReplacement";
import { createClient } from "@/lib/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { useMasonry, type MasonryItem } from "@/hooks/useMasonry";

export default function GalleryPage() {
  const supabase = createClient();

  const { data: images = [], isLoading } = useQuery<MasonryItem[]>({
    queryKey: ["gallery_images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gallery_images")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const columns = useMasonry(images, 3);

  return (
    <SiteShell>
      <section className="border-b-2 border-black bg-[#ffde00] px-4 py-12 md:px-6">
        <div className="mx-auto max-w-7xl">
          <span className="inline-block bg-black text-white px-3 py-1 font-mono text-xs font-bold uppercase mb-2">
            Campus Moments
          </span>
          <h1 className="text-4xl font-black uppercase text-black sm:text-5xl md:text-6xl">
            Image Gallery
          </h1>
          <p className="mt-4 max-w-2xl font-mono text-sm text-black/75">
            A mathematically balanced masonry grid displaying student life, events, and campus
            architecture.
          </p>
        </div>
      </section>

      <section className="bg-[#fcf8f2] px-4 py-12 md:px-6 min-h-[60vh]">
        <div className="mx-auto max-w-7xl">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="bg-black/5 animate-pulse border-2 border-black neu-shadow w-full"
                  style={{ aspectRatio: i % 2 === 0 ? "4/3" : "3/4" }}
                />
              ))}
            </div>
          ) : images.length === 0 ? (
            <div className="text-center font-mono py-12 text-black/50">
              No gallery images found in database.
            </div>
          ) : (
            <div className="flex flex-col md:flex-row gap-6 items-start">
              {columns.map((columnItems, colIdx) => (
                <div key={colIdx} className="flex-1 flex flex-col gap-6 w-full">
                  {columnItems.map((img) => (
                    <div
                      key={img.id}
                      className="group relative overflow-hidden bg-white border-3 border-black neu-shadow transition-transform hover:-translate-y-1 duration-200"
                      style={{
                        aspectRatio: `${img.width} / ${img.height}`,
                      }}
                    >
                      {/* Image element */}
                      <img
                        src={img.url}
                        alt={img.caption || "Campus Gallery Image"}
                        loading="lazy"
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Hover Overlay */}
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end p-4 text-white font-mono">
                        {img.caption && (
                          <p className="text-xs font-bold leading-tight">{img.caption}</p>
                        )}
                        <span className="text-[10px] text-gray-300 mt-1 uppercase">
                          {img.width} x {img.height}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </SiteShell>
  );
}
