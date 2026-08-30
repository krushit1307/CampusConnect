import { describe, it, expect, beforeEach } from "vitest";
import { PhotoWatermarkingPipelineService } from "../../src/services/photoWatermarkingPipelineService";

describe("PhotoWatermarkingEngine Integration Tests", () => {
  let engine: PhotoWatermarkingPipelineService;

  beforeEach(() => {
    engine = new PhotoWatermarkingPipelineService();
    engine.clear();
  });

  it("handles batch photo processing with club fallback branding and isolation", async () => {
    const photos = ["photo1.jpg", "photo2.png", "photo3.webp"];

    for (const fileName of photos) {
      await engine.processAndWatermarkPhoto({
        imageBuffer: "buffer",
        mimeType: "image/jpeg",
        fileName,
        eventId: "event_gala",
        clubId: "club_music",
        uploaderId: "u_1",
      });
    }

    const eventAssets = engine.listAssetsByEvent("event_gala");
    expect(eventAssets).toHaveLength(3);

    for (const asset of eventAssets) {
      expect(asset.watermarkMetadata.opacity).toBe(0.3);
      expect(asset.publicWatermarkedUrl).toContain("campus-photos-public");
      expect(asset.privateArchiveUrl).toContain("campus-photos-vault-private");
    }
  });
});
