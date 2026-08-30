import { describe, it, expect, beforeEach, vi } from "vitest";
import { MissingPhotoExifStrippingService } from "../missingPhotoExifStrippingService";

// Mock canvas & image orientation utilities
vi.mock("@/utils/exifOrientation", () => ({
  getExifOrientation: () => Promise.resolve(1),
  correctImageOrientation: (url: string) => Promise.resolve(url),
}));

describe("MissingPhotoExifStrippingService", () => {
  let service: MissingPhotoExifStrippingService;

  beforeEach(() => {
    service = new MissingPhotoExifStrippingService();
    service.clearAuditLogs();
  });

  describe("inspectExifMetadata", () => {
    it("should inspect JPEG file and extract metadata tags", async () => {
      const file = new File(["dummy image content"], "photo_location.jpg", {
        type: "image/jpeg",
      });

      const exif = await service.inspectExifMetadata(file);

      expect(exif.gpsLatitude).toBe(40.7128);
      expect(exif.gpsLongitude).toBe(-74.006);
      expect(exif.cameraMake).toBe("Apple");
      expect(exif.cameraModel).toBe("iPhone 15 Pro");
    });
  });

  describe("evaluatePrivacyRisk", () => {
    it("should classify HIGH_GPS_EXPOSED when GPS coordinates exist", () => {
      const risk = service.evaluatePrivacyRisk({
        gpsLatitude: 40.7128,
        gpsLongitude: -74.006,
      });

      expect(risk).toBe("HIGH_GPS_EXPOSED");
    });

    it("should classify MODERATE_METADATA when device/timestamp metadata exists without GPS", () => {
      const risk = service.evaluatePrivacyRisk({
        cameraModel: "Canon EOS R5",
        dateTimeOriginal: "2026-08-28",
      });

      expect(risk).toBe("MODERATE_METADATA");
    });

    it("should classify SAFE_CLEAN when no metadata tags exist", () => {
      const risk = service.evaluatePrivacyRisk({});
      expect(risk).toBe("SAFE_CLEAN");
    });
  });

  describe("processMissingPhotoUpload", () => {
    it("should run complete EXIF stripping pipeline and log audit record", async () => {
      const file = new File(["dummy content"], "photo_location.jpg", {
        type: "image/jpeg",
      });

      const res = await service.processMissingPhotoUpload(
        file,
        "task-101",
        "evt-showcase",
        "Robotics Showcase",
      );

      expect(res.inspection.photoTaskId).toBe("task-101");
      expect(res.inspection.hasGpsCoordinates).toBe(true);
      expect(res.inspection.status).toBe("EXIF_STRIPPED");
      expect(res.strippingResult.isPrivacyProtected).toBe(true);
      expect(res.strippingResult.tagsRemovedCount).toBeGreaterThan(0);

      const logs = service.getSanitizerAuditLogs();
      expect(logs.length).toBe(1);
    });
  });
});
