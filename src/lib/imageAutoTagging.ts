export interface VisionDetectedLabel {
  name: string;
  confidence: number; // 0.0 to 1.0
}

export interface VisionDetectionPayload {
  labels: VisionDetectedLabel[];
  faceCount: number;
}

export interface GalleryImageWithTags {
  id: string;
  eventId: string;
  imageUrl: string;
  tags: string[];
}

export const MIN_CONFIDENCE_THRESHOLD = 0.7;

/**
 * Processes Vision API payloads, extracting high-confidence tags and applying face-count rules.
 */
export function extractAutoTagsFromVisionData(
  data: VisionDetectionPayload,
  minConfidence = MIN_CONFIDENCE_THRESHOLD,
): string[] {
  const tagsSet = new Set<string>();

  // 1. High confidence label filtering
  for (const label of data.labels) {
    if (label.confidence >= minConfidence) {
      const normalizedTag = label.name.trim().toLowerCase();
      tagsSet.add(normalizedTag);
    }
  }

  // 2. Facial detection tagging (People vs. Scenery)
  if (data.faceCount > 0) {
    tagsSet.add("people");
    if (data.faceCount >= 3) {
      tagsSet.add("group photo");
    }
  } else {
    tagsSet.add("scenery");
  }

  return Array.from(tagsSet);
}

/**
 * Filters a gallery of images based on selected UI filter tags.
 */
export function filterGalleryByTags(
  images: GalleryImageWithTags[],
  selectedTags: string[],
): GalleryImageWithTags[] {
  if (selectedTags.length === 0) return images;

  const normalizedFilters = selectedTags.map((t) => t.toLowerCase());

  return images.filter((img) => {
    const imgTagsLower = img.tags.map((t) => t.toLowerCase());
    return normalizedFilters.every((filter) => imgTagsLower.includes(filter));
  });
}
