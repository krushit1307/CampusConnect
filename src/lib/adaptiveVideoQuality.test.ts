import { describe, it, expect } from "vitest";
import {
  determineOptimalQuality,
  getStreamBitrateForQuality,
  generateHlsManifestLevels,
} from "./adaptiveVideoQuality";

describe("Adaptive Bitrate Video Quality Engine Utility (#3586)", () => {
  it("selects 1080p Full HD when connection speed and buffer health are excellent", () => {
    const quality = determineOptimalQuality({
      effectiveType: "4g",
      downlinkMbps: 8.5,
      rttMs: 30,
      bufferHealthSec: 6.0,
      packetLossRatio: 0.0,
    });

    expect(quality.targetQuality).toBe("1080p");
    expect(quality.isDegraded).toBe(false);
    expect(quality.bitrateKbps).toBe(4500);
  });

  it("automatically degrades to 480p/360p under poor Wi-Fi conditions or low buffer (<2.0s)", () => {
    const qualityLowBuffer = determineOptimalQuality({
      effectiveType: "3g",
      downlinkMbps: 1.2,
      rttMs: 180,
      bufferHealthSec: 1.5, // Low buffer!
      packetLossRatio: 0.05,
    });

    expect(qualityLowBuffer.isDegraded).toBe(true);
    expect(["480p", "360p"]).toContain(qualityLowBuffer.targetQuality);
    expect(qualityLowBuffer.reason).toContain("prevent buffering");
  });

  it("honors manual resolution override preference", () => {
    const qualityManual = determineOptimalQuality(
      {
        effectiveType: "4g",
        downlinkMbps: 15.0,
        bufferHealthSec: 8.0,
        packetLossRatio: 0,
      },
      "720p" // Manual override
    );

    expect(qualityManual.targetQuality).toBe("720p");
    expect(qualityManual.selectionMode).toBe("720p");
    expect(qualityManual.reason).toContain("Manual user resolution override");
  });

  it("generates HLS level manifests for multi-bitrate streaming", () => {
    const manifests = generateHlsManifestLevels("https://live.campus.edu/hls/panel");

    expect(manifests).toHaveLength(4);
    expect(manifests[0].resolution).toBe("1080p");
    expect(manifests[0].playlistUrl).toContain("/1080p/index.m3u8");
    expect(manifests[3].resolution).toBe("360p");
  });
});
