// src/components/PhotoGallery/PhotoCard.tsx
import React, { useState } from "react";
import { GalleryPhoto } from "../../types/gallery";
import { cn } from "../../lib/utils";
import { Heart, MessageCircle, Share2, MapPin, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { Badge } from "../ui/badge";

interface PhotoCardProps {
  photo: GalleryPhoto;
  onClick: () => void;
  paddingBottom: string;
  isLiked?: boolean;
  onLikeToggle?: () => void;
}

/**
 * Individual photo card for the masonry grid.
 * Uses the pre-calculated padding-bottom percentage to maintain
 * the exact aspect ratio before the image finishes downloading.
 */
export const PhotoCard: React.FC<PhotoCardProps> = ({
  photo,
  onClick,
  paddingBottom,
  isLiked = false,
  onLikeToggle,
}) => {
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="mb-4 break-inside-avoid group relative cursor-pointer overflow-hidden rounded-xl bg-muted shadow-sm transition-all duration-300 hover:shadow-xl hover:-translate-y-1"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* Aspect ratio wrapper to prevent layout shift */}
      <div className="relative w-full" style={{ paddingBottom }}>
        <img
          src={photo.thumbnailUrl}
          alt={photo.alt}
          loading="lazy"
          onLoad={() => setIsImageLoaded(true)}
          className={cn(
            "absolute inset-0 w-full h-full object-cover transition-all duration-500",
            isImageLoaded ? "opacity-100 blur-0" : "opacity-0 blur-lg",
            isHovered && "scale-105",
          )}
        />

        {/* Dark overlay with actions - visible on hover */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-between p-3 transition-opacity duration-300",
            isHovered ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex justify-end gap-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onLikeToggle?.();
              }}
              className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors"
              aria-label="Like photo"
            >
              <Heart className={cn("w-4 h-4", isLiked && "fill-red-500 text-red-500")} />
            </button>
            <button
              onClick={(e) => e.stopPropagation()}
              className="p-2 rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/30 transition-colors"
              aria-label="Share photo"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>

          <div className="text-white">
            {photo.location && (
              <div className="flex items-center gap-1 text-xs mb-1 opacity-90">
                <MapPin className="w-3 h-3" />
                <span>{photo.location}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Avatar className="w-6 h-6 border border-white/50">
                <AvatarImage src={photo.photographer.avatarUrl} alt={photo.photographer.name} />
                <AvatarFallback>{photo.photographer.name[0]}</AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium">{photo.photographer.name}</span>
            </div>
          </div>
        </div>

        {/* Camera settings badge */}
        {photo.cameraSettings && isHovered && (
          <div className="absolute top-2 left-2 flex gap-1">
            {photo.cameraSettings.aperture && (
              <Badge
                variant="secondary"
                className="bg-black/50 text-white backdrop-blur-sm border-0 text-[10px]"
              >
                <Camera className="w-2.5 h-2.5 mr-1" />
                {photo.cameraSettings.aperture}
              </Badge>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
