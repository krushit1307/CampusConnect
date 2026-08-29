import { describe, it, expect, beforeEach } from "vitest";
import { PhotoWatermarkingPipelineService } from "../photoWatermarkingPipelineService";

describe("PhotoWatermarkingPipelineService Unit Tests", () => {
  let service: PhotoWatermarkingPipelineService;

  beforeEach(() => {
    service = new PhotoWatermarkingPipelineService();
    service.clear();
  });

  it("calculates bottom-right layout coordinates correctly for high-res images", () => {
    const layout = service.calculateWatermarkLayout(1920, 1080, {
      opacity: 0.3,
      position: "BOTTOM_RIGHT",
      year: 2026,
      paddingPx: 24,
      logoMaxHeightPercent: 0.12,
      fontSizePx: 18,
      includeCopyrightSymbol: true,
    });

    expect(layout.logoHeight).toBe(Math.round(1080 * 0.12)); // 130px
    expect(layout.logoWidth).toBe(Math.round(130 * 1.5)); // 195px
    expect(layout.y).toBe(1080 - 130 - 24); // 926
    expect(layout.x).toBe(1920 - 195 - 24 - 120); // 1581
  });

  it("generates SVG watermark with 30% opacity, Club Logo, and (c) 2026 text", () => {
    const branding = {
      clubId: "club_robotics",
      clubName: "Robotics Club",
      logoUrl: "https://cdn.example.com/robotics.svg",
      copyrightHolder: "Robotics Club",
      year: 2026,
    };

    const layout = service.calculateWatermarkLayout(1920, 1080, {
      opacity: 0.3,
      position: "BOTTOM_RIGHT",
      year: 2026,
      paddingPx: 24,
      logoMaxHeightPercent: 0.12,
      fontSizePx: 18,
      includeCopyrightSymbol: true,
    });

    const svg = service.generateWatermarkSvgString(branding, layout, {
      opacity: 0.3,
      position: "BOTTOM_RIGHT",
      year: 2026,
      paddingPx: 24,
      logoMaxHeightPercent: 0.12,
      fontSizePx: 18,
      includeCopyrightSymbol: true,
    });

    expect(svg).toContain('opacity="0.3"');
    expect(svg).toContain("© 2026 Robotics Club");
    expect(svg).toContain("https://cdn.example.com/robotics.svg");
  });

  it("processes image and returns dual-bucket S3 outputs", async () => {
    service.registerClubBranding({
      clubId: "club_photography",
      clubName: "Photo Society",
      logoUrl: "https://cdn.example.com/photo-soc.svg",
      copyrightHolder: "Photo Society",
      year: 2026,
    });

    const result = await service.processAndWatermarkPhoto({
      imageBuffer: "data:image/jpeg;base64,samplebase64buffer",
      mimeType: "image/jpeg",
      fileName: "crowd-cheering.jpg",
      eventId: "event_concert",
      clubId: "club_photography",
      uploaderId: "user_photographer",
    });

    expect(result.publicAsset.bucket).toBe("campus-photos-public");
    expect(result.publicAsset.isWatermarked).toBe(true);
    expect(result.publicAsset.url).toContain("public_wm_");

    expect(result.privateArchive.bucket).toBe("campus-photos-vault-private");
    expect(result.privateArchive.isWatermarked).toBe(false);
    expect(result.privateArchive.url).toContain("archive_orig_");

    expect(result.assetRecord.watermarkMetadata.opacity).toBe(0.3);
    expect(result.assetRecord.watermarkMetadata.copyrightText).toBe("© 2026 Photo Society");
  });
});
