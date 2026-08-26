export type StreamResolution = "1080p" | "720p" | "480p" | "360p";
export type QualitySelectionMode = "auto" | StreamResolution;

export interface NetworkQualityState {
  effectiveType?: "4g" | "3g" | "2g" | "slow-2g";
  downlinkMbps?: number;
  rttMs?: number;
  bufferHealthSec: number;
  packetLossRatio: number;
}

export interface QualityAdaptationResult {
  targetQuality: StreamResolution;
  reason: string;
  isDegraded: boolean;
  bitrateKbps: number;
  selectionMode: QualitySelectionMode;
}

export interface HlsLevelManifest {
  resolution: StreamResolution;
  bitrateKbps: number;
  width: number;
  height: number;
  playlistUrl: string;
}

export const BITRATE_MAP: Record<StreamResolution, { bitrateKbps: number; width: number; height: number }> = {
  "1080p": { bitrateKbps: 4500, width: 1920, height: 1080 },
  "720p": { bitrateKbps: 2500, width: 1280, height: 720 },
  "480p": { bitrateKbps: 1200, width: 854, height: 480 },
  "360p": { bitrateKbps: 600, width: 640, height: 360 },
};

/**
 * Returns bitrate in Kbps for a target video resolution (#3586).
 */
export function getStreamBitrateForQuality(quality: StreamResolution): number {
  return BITRATE_MAP[quality]?.bitrateKbps || 2500;
}

/**
 * Determines optimal video resolution based on real-time buffer health and network telemetry (#3586).
 */
export function determineOptimalQuality(
  networkState: NetworkQualityState,
  manualOverride: QualitySelectionMode = "auto"
): QualityAdaptationResult {
  // If user selected manual resolution override (e.g. 720p), honor preference
  if (manualOverride !== "auto") {
    const bitrateKbps = getStreamBitrateForQuality(manualOverride);
    return {
      targetQuality: manualOverride,
      reason: `Manual user resolution override (${manualOverride})`,
      isDegraded: manualOverride === "480p" || manualOverride === "360p",
      bitrateKbps,
      selectionMode: manualOverride,
    };
  }

  const { bufferHealthSec, downlinkMbps = 5.0, rttMs = 50, packetLossRatio = 0 } = networkState;

  // Severe network degradation / low buffer (< 2.0s or < 1.0 Mbps or high packet loss)
  if (bufferHealthSec < 2.0 || downlinkMbps < 1.0 || rttMs > 300 || packetLossRatio > 0.12) {
    const target: StreamResolution = bufferHealthSec < 1.0 || downlinkMbps < 0.6 ? "360p" : "480p";
    return {
      targetQuality: target,
      reason: `Automatic degradation triggered to prevent buffering (Buffer: ${bufferHealthSec.toFixed(1)}s, Downlink: ${downlinkMbps.toFixed(1)}Mbps)`,
      isDegraded: true,
      bitrateKbps: getStreamBitrateForQuality(target),
      selectionMode: "auto",
    };
  }

  // Moderate network constraint (downlink < 3.5 Mbps or buffer < 4.0s)
  if (bufferHealthSec < 4.0 || downlinkMbps < 3.5 || rttMs > 150) {
    return {
      targetQuality: "720p",
      reason: "Adaptive 720p selected for smooth playback",
      isDegraded: false,
      bitrateKbps: getStreamBitrateForQuality("720p"),
      selectionMode: "auto",
    };
  }

  // Excellent high-speed connection
  return {
    targetQuality: "1080p",
    reason: "High-speed network detected (1080p Full HD)",
    isDegraded: false,
    bitrateKbps: getStreamBitrateForQuality("1080p"),
    selectionMode: "auto",
  };
}

/**
 * Generates multi-bitrate HLS playlist variants (#3586).
 */
export function generateHlsManifestLevels(baseStreamUrl: string): HlsLevelManifest[] {
  const cleanBase = (baseStreamUrl || "https://live.campus.edu/hls/panel_stream").replace(/\/$/, "");
  const resolutions: StreamResolution[] = ["1080p", "720p", "480p", "360p"];

  return resolutions.map((res) => {
    const meta = BITRATE_MAP[res];
    return {
      resolution: res,
      bitrateKbps: meta.bitrateKbps,
      width: meta.width,
      height: meta.height,
      playlistUrl: `${cleanBase}/${res}/index.m3u8`,
    };
  });
}
