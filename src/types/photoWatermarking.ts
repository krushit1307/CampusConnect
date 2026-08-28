export type WatermarkPosition =
  "BOTTOM_RIGHT" | "BOTTOM_LEFT" | "TOP_RIGHT" | "TOP_LEFT" | "CENTER";

export type PhotoAssetVisibility = "PUBLIC_WATERMARKED" | "PRIVATE_ARCHIVE" | "QUARANTINED";

export interface WatermarkConfig {
  opacity: number; // default 0.30 (30%)
  position: WatermarkPosition; // default BOTTOM_RIGHT
  year: number; // e.g. 2026
  paddingPx: number; // default 24px
  logoMaxHeightPercent: number; // default 0.12 (12% of image height)
  fontSizePx: number; // default 18px
  includeCopyrightSymbol: boolean; // default true
}

export interface ClubBrandingInfo {
  clubId: string;
  clubName: string;
  logoUrl: string;
  copyrightHolder: string;
  year?: number;
}

export interface ProcessedPhotoAsset {
  id: string;
  eventId: string;
  clubId: string;
  uploaderId: string;
  originalFileName: string;
  publicWatermarkedUrl: string;
  publicBucketKey: string;
  privateArchiveUrl: string;
  privateBucketKey: string;
  watermarkMetadata: {
    appliedLogoUrl: string;
    copyrightText: string;
    opacity: number;
    position: WatermarkPosition;
    processedAt: string;
  };
  moderationStatus: "APPROVED" | "PENDING" | "REJECTED";
  width: number;
  height: number;
  fileSizeBytes: number;
  mimeType: string;
  createdAt: string;
  updatedAt: string;
}

export interface PhotoWatermarkProcessInput {
  imageBuffer: ArrayBuffer | Uint8Array | string; // base64 or raw buffer
  mimeType: string;
  fileName: string;
  eventId: string;
  clubId: string;
  uploaderId: string;
  customWatermarkConfig?: Partial<WatermarkConfig>;
}

export interface DualBucketUploadResult {
  publicAsset: {
    bucket: "campus-photos-public";
    key: string;
    url: string;
    isWatermarked: boolean;
  };
  privateArchive: {
    bucket: "campus-photos-vault-private";
    key: string;
    url: string;
    isWatermarked: boolean;
  };
  assetRecord: ProcessedPhotoAsset;
}
