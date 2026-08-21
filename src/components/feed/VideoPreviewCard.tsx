// =============================================================================
// Component: VideoPreviewCard
// Issue: #2402 - Async generation of looping video previews via FFmpeg
// Description: Renders the <video> tag for the 3-second looping .webm preview.
// Uses IntersectionObserver to auto-play only when visible in viewport.
// =============================================================================

import React, { useRef, useEffect, useState } from "react";

interface VideoPreviewCardProps {
  eventId: string;
  title: string;
  previewUrl: string | null;
  thumbnailUrl: string;
  onClick: () => void;
}

export const VideoPreviewCard: React.FC<VideoPreviewCardProps> = ({
  eventId,
  title,
  previewUrl,
  thumbnailUrl,
  onClick,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // IntersectionObserver to detect when card is in viewport
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsInView(entry.isIntersecting);
        });
      },
      { threshold: 0.5 }, // Trigger when 50% of the card is visible
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  // Auto-play/pause based on viewport visibility
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !previewUrl) return;

    if (isInView && isLoaded) {
      video.play().catch((err) => {
        console.warn("Auto-play prevented or failed:", err);
      });
    } else {
      video.pause();
    }
  }, [isInView, isLoaded, previewUrl]);

  const handleVideoLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div
      ref={cardRef}
      onClick={onClick}
      className="group relative aspect-video bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden cursor-pointer shadow-md hover:shadow-xl transition-all duration-300"
    >
      {/* Static thumbnail fallback while preview loads or if unavailable */}
      {!previewUrl && <img src={thumbnailUrl} alt={title} className="w-full h-full object-cover" />}

      {/* Auto-playing silent looping webm preview */}
      {previewUrl && (
        <video
          ref={videoRef}
          src={previewUrl}
          autoPlay
          loop
          muted
          playsInline
          onLoadedData={handleVideoLoad}
          className={`w-full h-full object-cover transition-opacity duration-500 ${
            isLoaded ? "opacity-100" : "opacity-0"
          }`}
        />
      )}

      {/* Overlay gradient for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

      {/* Event Title */}
      <div className="absolute bottom-0 left-0 right-0 p-4">
        <h3 className="text-white font-bold text-lg leading-tight group-hover:text-indigo-300 transition-colors">
          {title}
        </h3>
      </div>

      {/* Loading indicator if preview is being generated */}
      {!previewUrl && (
        <div className="absolute top-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-full backdrop-blur-sm">
          Processing preview...
        </div>
      )}
    </div>
  );
};
