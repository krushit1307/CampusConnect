import { useState, useEffect, useRef } from "react";
import { parseVideoUrl, getEmbedUrl } from "@/utils/videoEmbed";

export interface LazyYouTubeEmbedProps {
  url?: string;
  videoId?: string;
  title?: string;
  className?: string;
}

export function LazyYouTubeEmbed({
  url,
  videoId,
  title = "Embedded video",
  className = "",
}: LazyYouTubeEmbedProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine YouTube ID from either direct videoId or parsed url
  let resolvedId = videoId || "";
  if (!resolvedId && url) {
    const parsed = parseVideoUrl(url);
    if (parsed && parsed.type === "youtube") {
      resolvedId = parsed.id;
    }
  }

  useEffect(() => {
    const el = containerRef.current;
    if (!el || isLoaded) return;

    if (typeof IntersectionObserver === "undefined") {
      setIsLoaded(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsLoaded(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [isLoaded]);

  if (!resolvedId) return null;

  const thumbnailUrl = `https://img.youtube.com/vi/${resolvedId}/maxresdefault.jpg`;
  const fallbackThumbnailUrl = `https://img.youtube.com/vi/${resolvedId}/hqdefault.jpg`;
  const embedUrl = `https://www.youtube-nocookie.com/embed/${resolvedId}?autoplay=1`;

  const handlePlayClick = () => {
    setIsLoaded(true);
  };

  return (
    <div
      ref={containerRef}
      data-testid="lazy-youtube-container"
      className={`relative w-full aspect-video bg-black overflow-hidden neu-border rounded-lg shadow-md ${className}`}
    >
      {isLoaded ? (
        <iframe
          data-testid="youtube-iframe"
          src={embedUrl}
          title={title}
          className="absolute inset-0 w-full h-full border-0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          loading="lazy"
        />
      ) : (
        <div
          data-testid="youtube-placeholder"
          onClick={handlePlayClick}
          className="group absolute inset-0 w-full h-full cursor-pointer flex items-center justify-center bg-zinc-900"
        >
          {/* Static Thumbnail Image */}
          <img
            src={thumbnailUrl}
            onError={(e) => {
              // Fallback to hqdefault if maxresdefault is missing
              (e.target as HTMLImageElement).src = fallbackThumbnailUrl;
            }}
            alt={title}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />

          {/* Semi-transparent Dark Overlay */}
          <div className="absolute inset-0 bg-black/30 group-hover:bg-black/20 transition-colors" />

          {/* Custom SVG Fake Play Button */}
          <button
            type="button"
            data-testid="fake-play-button"
            aria-label={`Play ${title}`}
            className="relative z-10 w-16 h-16 sm:w-20 sm:h-20 flex items-center justify-center bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-all transform group-hover:scale-110 focus:outline-none focus:ring-4 focus:ring-red-500/50"
          >
            <svg
              className="w-8 h-8 sm:w-10 sm:h-10 fill-current ml-1"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M8 5v14l11-7z" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
