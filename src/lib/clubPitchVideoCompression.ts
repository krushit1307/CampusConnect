export type TranscodeStatus =
  | "uploaded"
  | "transcoding"
  | "completed"
  | "raw_file_purged";

export interface VideoTranscodeJob {
  id: string;
  clubId: string;
  pitchTitle: string;
  rawS3Key: string;
  rawFileSizeMb: number;
  compressedSizeMb?: number;
  bandwidthSavedPct?: number;
  masterM3u8Url?: string;
  resolutions: string[];
  status: TranscodeStatus;
  createdAt: string;
}

export interface TranscodeMetrics {
  rawSizeMb: number;
  compressedSizeMb: number;
  bandwidthSavingsMb: number;
  bandwidthSavedPct: number;
  costSavingsUsd: number;
}

export interface HlsVariant {
  resolution: string;
  bandwidthKbps: number;
  playlistUrl: string;
}

const AWS_EGRESS_COST_PER_GB = 0.09; // AWS CloudFront $0.09 per GB

/**
 * Calculates compression ratio, bandwidth savings percentage, and AWS egress cost savings (#4289).
 */
export function calculateTranscodeMetrics(
  rawSizeMb: number,
  compressedSizeMb: number
): TranscodeMetrics {
  const raw = Math.max(0.1, rawSizeMb);
  const compressed = Math.max(0.1, compressedSizeMb);
  const savingsMb = Math.max(0, raw - compressed);
  const bandwidthSavedPct = Math.round((savingsMb / raw) * 1000) / 10;

  // Cost savings per 1,000 views
  const savingsGb = (savingsMb * 1000) / 1024;
  const costSavingsUsd = Math.round(savingsGb * AWS_EGRESS_COST_PER_GB * 100) / 100;

  return {
    rawSizeMb: raw,
    compressedSizeMb: compressed,
    bandwidthSavingsMb: Math.round(savingsMb * 10) / 10,
    bandwidthSavedPct,
    costSavingsUsd,
  };
}

/**
 * Simulates MediaConvert/Lambda HLS video transcoding and raw S3 file purging (#4289).
 */
export function processVideoTranscodeJob(job: VideoTranscodeJob): VideoTranscodeJob {
  const raw = job.rawFileSizeMb || 500.0;
  // HLS multi-bitrate transcoding achieves ~95% size reduction vs 4K ProRes
  const compressed = Math.round(raw * 0.049 * 10) / 10;
  const metrics = calculateTranscodeMetrics(raw, compressed);
  const cleanKey = (job.rawS3Key || "raw-uploads/video_pitch.mov").replace(/^raw-uploads\//, "").replace(/\.[^/.]+$/, "");

  const masterM3u8Url = `https://cdn.campus.edu/hls/${cleanKey}/master.m3u8`;

  return {
    ...job,
    compressedSizeMb: compressed,
    bandwidthSavedPct: metrics.bandwidthSavedPct,
    masterM3u8Url,
    resolutions: ["1080p", "720p", "480p"],
    status: "raw_file_purged",
  };
}

/**
 * Returns HLS variant playlist manifests for 1080p, 720p, and 480p streams (#4289).
 */
export function getHlsVariantManifests(masterM3u8Url: string): HlsVariant[] {
  const cleanBase = (masterM3u8Url || "https://cdn.campus.edu/hls/pitch_101/master.m3u8").replace(/\/master\.m3u8$/, "");

  return [
    { resolution: "1080p", bandwidthKbps: 4500, playlistUrl: `${cleanBase}/1080p/index.m3u8` },
    { resolution: "720p", bandwidthKbps: 2500, playlistUrl: `${cleanBase}/720p/index.m3u8` },
    { resolution: "480p", bandwidthKbps: 1200, playlistUrl: `${cleanBase}/480p/index.m3u8` },
  ];
}
