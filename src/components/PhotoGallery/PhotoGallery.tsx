// src/components/PhotoGallery/PhotoGallery.tsx
import React, { useState, useMemo } from "react";
import { GalleryPhoto, SortOption, FilterTag, GalleryFilters } from "../../types/gallery";
import { PhotoCard } from "./PhotoCard";
import { Lightbox } from "./Lightbox";
import { useImageAspectRatio } from "../../hooks/useImageAspectRatio";
import { EmptyState } from "../ui/EmptyState";
import { LoadingSpinner } from "../ui/LoadingSpinner";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import Search from "lucide-react/dist/esm/icons/search";
import SlidersHorizontal from "lucide-react/dist/esm/icons/sliders-horizontal";
import ImageIcon from "lucide-react/dist/esm/icons/image";
import { cn } from "../../lib/utils";

interface PhotoGalleryProps {
  photos: GalleryPhoto[];
  isLoading?: boolean;
  className?: string;
}

/**
 * Fluid Masonry Layout Photo Gallery.
 *
 * Replaces the old CSS Grid implementation which forced all images into
 * identical squares (`object-cover`), arbitrarily cropping tall/wide photos.
 *
 * Uses modern CSS Columns (`columns-1 md:columns-2 lg:columns-3`) combined
 * with `break-inside: avoid` to respect original aspect ratios while maintaining
 * a tight, Pinterest-style grid.
 */
export const PhotoGallery: React.FC<PhotoGalleryProps> = ({
  photos,
  isLoading = false,
  className,
}) => {
  const [filters, setFilters] = useState<GalleryFilters>({
    sort: "newest",
    tag: "all",
    searchQuery: "",
  });

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [likedPhotos, setLikedPhotos] = useState<Set<string>>(new Set());

  // Pre-calculate aspect ratios to prevent CLS during layout
  const urls = useMemo(() => photos.map((p) => p.thumbnailUrl), [photos]);
  const { ratios, isLoading: isRatiosLoading } = useImageAspectRatio(urls);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    photos.forEach((p) => p.tags.forEach((t) => tags.add(t)));
    return Array.from(tags);
  }, [photos]);

  const filteredAndSortedPhotos = useMemo(() => {
    let result = [...photos];

    // Filter by tag
    if (filters.tag !== "all") {
      result = result.filter((p) => p.tags.includes(filters.tag));
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.alt.toLowerCase().includes(query) ||
          p.photographer.name.toLowerCase().includes(query) ||
          p.location?.toLowerCase().includes(query),
      );
    }

    // Sort
    switch (filters.sort) {
      case "newest":
        result.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
        break;
      case "oldest":
        result.sort((a, b) => new Date(a.uploadedAt).getTime() - new Date(b.uploadedAt).getTime());
        break;
      case "popular":
        // Assuming we had a likes count, we'd sort by it here
        break;
    }

    return result;
  }, [photos, filters]);

  const toggleLike = (photoId: string) => {
    setLikedPhotos((prev) => {
      const next = new Set(prev);
      if (next.has(photoId)) {
        next.delete(photoId);
      } else {
        next.add(photoId);
      }
      return next;
    });
  };

  const openLightbox = (index: number) => setLightboxIndex(index);
  const closeLightbox = () => setLightboxIndex(null);

  const goToNext = () => {
    if (lightboxIndex !== null && lightboxIndex < filteredAndSortedPhotos.length - 1) {
      setLightboxIndex(lightboxIndex + 1);
    }
  };

  const goToPrev = () => {
    if (lightboxIndex !== null && lightboxIndex > 0) {
      setLightboxIndex(lightboxIndex - 1);
    }
  };

  if (isLoading || isRatiosLoading) {
    return <LoadingSpinner size="lg" text="Loading gallery..." overlay />;
  }

  if (photos.length === 0) {
    return (
      <EmptyState
        title="No photos yet"
        description="Be the first to upload a photo to this gallery!"
        actionLabel="Upload Photo"
        animationType="empty-state"
      />
    );
  }

  return (
    <div className={cn("w-full", className)}>
      {/* Header / Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8 items-stretch sm:items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search photos, photographers, locations..."
            value={filters.searchQuery}
            onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e.target.value }))}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2 items-center">
          <Select
            value={filters.sort}
            onValueChange={(value: SortOption) => setFilters((prev) => ({ ...prev, sort: value }))}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
              <SelectItem value="popular">Most Popular</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tags */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          <Badge
            variant={filters.tag === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setFilters((prev) => ({ ...prev, tag: "all" }))}
          >
            All Photos
          </Badge>
          {availableTags.map((tag) => (
            <Badge
              key={tag}
              variant={filters.tag === tag ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setFilters((prev) => ({ ...prev, tag }))}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Masonry Grid using CSS Columns */}
      {filteredAndSortedPhotos.length === 0 ? (
        <EmptyState
          title="No results found"
          description="Try adjusting your search or filters to find what you're looking for."
          animationType="search-empty"
          className="py-20"
        />
      ) : (
        <div className="columns-1 md:columns-2 lg:columns-3 xl:columns-4 gap-4">
          {filteredAndSortedPhotos.map((photo, index) => {
            const ratioData = ratios[photo.thumbnailUrl];
            const paddingBottom = ratioData ? ratioData.paddingBottom : "75%"; // Fallback 4:3

            return (
              <PhotoCard
                key={photo.id}
                photo={photo}
                paddingBottom={paddingBottom}
                isLiked={likedPhotos.has(photo.id)}
                onLikeToggle={() => toggleLike(photo.id)}
                onClick={() => openLightbox(index)}
              />
            );
          })}
        </div>
      )}

      {/* Lightbox Modal */}
      <Lightbox
        photo={lightboxIndex !== null ? filteredAndSortedPhotos[lightboxIndex] : null}
        isOpen={lightboxIndex !== null}
        onClose={closeLightbox}
        onNext={goToNext}
        onPrev={goToPrev}
        hasNext={lightboxIndex !== null && lightboxIndex < filteredAndSortedPhotos.length - 1}
        hasPrev={lightboxIndex !== null && lightboxIndex > 0}
      />
    </div>
  );
};
