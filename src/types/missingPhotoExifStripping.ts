/**
 * Type definitions for Automated Missing Photo EXIF Metadata Stripping & Privacy Sanitization.
 * Issue: #5098 - Automated "Missing Photo" EXIF Metadata Stripping
 */

export type PrivacyRiskLevel = "SAFE_CLEAN" | "MODERATE_METADATA" | "HIGH_GPS_EXPOSED";

export interface ExifTagMetadata {
  gpsLatitude?: number | null;
  gpsLongitude?: number | null;
  gpsAltitude?: number | null;
  dateTimeOriginal?: string | null;
  cameraMake?: string | null;
  cameraModel?: string | null;
  software?: string | null;
  artist?: string | null;
  orientation?: number;
}

export interface ExifStrippingResult {
  originalFileName: string;
  originalSizeBytes: number;
  sanitizedSizeBytes: number;
  tagsRemovedCount: number;
  removedTagsSummary: string[];
  sanitizedDataUrl: string;
  sanitizedFile?: File;
  strippedAt: string;
  isPrivacyProtected: boolean;
}

export interface MissingPhotoUploadInspection {
  photoTaskId: string;
  eventId: string;
  eventTitle: string;
  fileName: string;
  fileSizeBytes: number;
  detectedExif: ExifTagMetadata;
  privacyRisk: PrivacyRiskLevel;
  hasGpsCoordinates: boolean;
  status: "RAW_UPLOADED" | "EXIF_STRIPPED" | "PUBLISHED_TO_GALLERY";
  createdAt: string;
}
