import { describe, it, expect } from "vitest";
import {
  extractAutoTagsFromVisionData,
  filterGalleryByTags,
  MIN_CONFIDENCE_THRESHOLD,
  GalleryImageWithTags,
} from "./imageAutoTagging";

describe("Image Auto-Tagging & Gallery Filtering Suite (#2796)", () => {
  it("extracts high-confidence labels and applies 'people' / 'group photo' tags based on face count", () => {
    const visionPayload = {
      labels: [
        { name: "Pizza", confidence: 0.95 },
        { name: "Food", confidence: 0.88 },
        { name: "Blurry Noise", confidence: 0.35 }, // Below 0.7 threshold
      ],
      faceCount: 4,
    };

    const tags = extractAutoTagsFromVisionData(visionPayload);

    expect(tags).toContain("pizza");
    expect(tags).toContain("food");
    expect(tags).not.toContain("blurry noise");
    expect(tags).toContain("people");
    expect(tags).toContain("group photo");
  });

  it("applies 'scenery' tag when face count is 0", () => {
    const visionPayload = {
      labels: [{ name: "Stage", confidence: 0.92 }],
      faceCount: 0,
    };

    const tags = extractAutoTagsFromVisionData(visionPayload);

    expect(tags).toContain("stage");
    expect(tags).toContain("scenery");
    expect(tags).not.toContain("people");
  });

  it("filters gallery images instantly matching selected active tags", () => {
    const gallery: GalleryImageWithTags[] = [
      { id: "img1", eventId: "e1", imageUrl: "url1", tags: ["food", "pizza", "people"] },
      { id: "img2", eventId: "e1", imageUrl: "url2", tags: ["stage", "scenery"] },
      { id: "img3", eventId: "e1", imageUrl: "url3", tags: ["food", "drinks"] },
    ];

    const foodOnly = filterGalleryByTags(gallery, ["Food"]);
    expect(foodOnly.length).toBe(2);

    const foodAndPizza = filterGalleryByTags(gallery, ["Food", "Pizza"]);
    expect(foodAndPizza.length).toBe(1);
    expect(foodAndPizza[0].id).toBe("img1");
  });
});
