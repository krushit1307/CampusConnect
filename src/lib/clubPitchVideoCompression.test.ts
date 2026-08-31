import { describe, it, expect } from "vitest";
import {
  calculateTranscodeMetrics,
  processVideoTranscodeJob,
  getHlsVariantManifests,
  VideoTranscodeJob,
} from "./clubPitchVideoCompression";

describe("Club Pitch Video Compression Pipeline Utility (#4289)", () => {
  it("calculates bandwidth savings percentage and AWS egress cost savings", () => {
    const metrics = calculateTranscodeMetrics(500.0, 24.5);

    expect(metrics.rawSizeMb).toBe(500.0);
    expect(metrics.compressedSizeMb).toBe(24.5);
    expect(metrics.bandwidthSavingsMb).toBe(475.5);
    expect(metrics.bandwidthSavedPct).toBe(95.1);
    expect(metrics.costSavingsUsd).toBeGreaterThan(40); // > $40 savings per 1k views
  });

  it("transcodes raw 500MB ProRes video and purges raw S3 upload", () => {
    const initialJob: VideoTranscodeJob = {
      id: "job-101",
      clubId: "club-cs-1",
      pitchTitle: "60-Sec Hackathon Pitch",
      rawS3Key: "raw-uploads/prores_4k_pitch.mov",
      rawFileSizeMb: 500.0,
      resolutions: [],
      status: "uploaded",
      createdAt: new Date().toISOString(),
    };

    const completed = processVideoTranscodeJob(initialJob);

    expect(completed.status).toBe("raw_file_purged");
    expect(completed.compressedSizeMb).toBeLessThan(30);
    expect(completed.bandwidthSavedPct).toBeGreaterThan(90);
    expect(completed.masterM3u8Url).toContain("/hls/prores_4k_pitch/master.m3u8");
  });

  it("returns multi-bitrate HLS variant manifests", () => {
    const variants = getHlsVariantManifests("https://cdn.campus.edu/hls/pitch_101/master.m3u8");

    expect(variants).toHaveLength(3);
    expect(variants[0].resolution).toBe("1080p");
    expect(variants[0].playlistUrl).toBe("https://cdn.campus.edu/hls/pitch_101/1080p/index.m3u8");
    expect(variants[2].resolution).toBe("480p");
  });
});
