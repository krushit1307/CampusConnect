import React, { useState, useCallback } from "react";
import { Play } from "lucide-react";

interface LiteYouTubeEmbedProps {
  videoId: string;
  title?: string;
  className?: string;
}

export const LiteYouTubeEmbed: React.FC<LiteYouTubeEmbedProps> = ({
  videoId,
  title = "YouTube video",
  className = "",
}) => {
  const [activated, setActivated] = useState(false);

  const handleActivate = useCallback(() => {
    setActivated(true);
  }, []);

  const thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

  if (activated) {
    return (
      <div className={`relative w-full aspect-video ${className}`}>
        <iframe
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          title={title}
          className="absolute top-0 left-0 w-full h-full rounded-lg"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div
      className={`relative w-full aspect-video cursor-pointer group rounded-lg overflow-hidden bg-black ${className}`}
      onClick={handleActivate}
      role="button"
      aria-label={`Play ${title}`}
    >
      {/* Thumbnail */}
      <img
        src={thumbnailUrl}
        alt={title}
        loading="lazy"
        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
        onError={(e) => {
          // Fallback to hqdefault if maxresdefault doesn't exist
          (e.target as HTMLImageElement).src =
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
        }}
      />

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors" />

      {/* Play button */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center shadow-lg transform transition-transform group-hover:scale-110">
          <Play className="w-8 h-8 text-white fill-white ml-1" />
        </div>
      </div>
    </div>
  );
};
