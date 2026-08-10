// src/types/gallery.ts
export interface GalleryPhoto {
  id: string;
  url: string;
  thumbnailUrl: string;
  width: number;
  height: number;
  alt: string;
  uploadedAt: string;
  tags: string[];
  photographer: {
    id: string;
    name: string;
    avatarUrl: string;
  };
  location?: string;
  cameraSettings?: {
    aperture?: string;
    shutterSpeed?: string;
    iso?: number;
  };
}

export type SortOption = "newest" | "oldest" | "popular";
export type FilterTag = string | "all";

export interface GalleryFilters {
  sort: SortOption;
  tag: FilterTag;
  searchQuery: string;
}
