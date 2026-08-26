export interface WebRtcNetworkStats {
  packetLossPercentage: number;
  latencyMs: number;
}

export interface EncodingParameters {
  maxBitrate?: number; // in bps
  scaleResolutionDownBy?: number;
}

export type AdaptationTier = "optimal" | "throttled_360p" | "audio_only";

export interface ThrottlerAdaptationResult {
  tier: AdaptationTier;
  isVideoTrackEnabled: boolean;
  targetMaxBitrateKbps: number;
  scaleResolutionDownBy: number;
  renderAudioOnlySlate: boolean;
  slateMessage?: string;
}

export const PACKET_LOSS_HIGH_THRESHOLD = 5.0; // 5%
export const LATENCY_HIGH_THRESHOLD_MS = 300; // 300ms
export const CRITICAL_PACKET_LOSS_THRESHOLD = 15.0; // 15%
export const CRITICAL_LATENCY_THRESHOLD_MS = 600; // 600ms

/**
 * Evaluates WebRTC network telemetry metrics to determine active stream encoding limits.
 */
export function evaluateWebRtcBandwidthAdaptation(
  stats: WebRtcNetworkStats,
): ThrottlerAdaptationResult {
  const isCriticalLoss = stats.packetLossPercentage >= CRITICAL_PACKET_LOSS_THRESHOLD;
  const isCriticalLatency = stats.latencyMs >= CRITICAL_LATENCY_THRESHOLD_MS;

  // Severe degradation -> Disable video track, fallback to Audio-Only
  if (isCriticalLoss || isCriticalLatency) {
    return {
      tier: "audio_only",
      isVideoTrackEnabled: false,
      targetMaxBitrateKbps: 64, // Low bitrate audio priority
      scaleResolutionDownBy: 1.0,
      renderAudioOnlySlate: true,
      slateMessage: "Presenter Audio Only (Low Bandwidth)",
    };
  }

  const isHighLoss = stats.packetLossPercentage > PACKET_LOSS_HIGH_THRESHOLD;
  const isHighLatency = stats.latencyMs > LATENCY_HIGH_THRESHOLD_MS;

  // Moderate degradation -> Throttle video bitrate and scale down resolution (e.g. 1080p -> 360p)
  if (isHighLoss || isHighLatency) {
    return {
      tier: "throttled_360p",
      isVideoTrackEnabled: true,
      targetMaxBitrateKbps: 500, // Cap at 500 kbps
      scaleResolutionDownBy: 3.0, // Scale 1080p down to 360p
      renderAudioOnlySlate: false,
    };
  }

  // Optimal conditions
  return {
    tier: "optimal",
    isVideoTrackEnabled: true,
    targetMaxBitrateKbps: 2500, // Full HD bitrate
    scaleResolutionDownBy: 1.0,
    renderAudioOnlySlate: false,
  };
}

/**
 * Mutates RTCRtpSender encoding parameters based on evaluated network adaptation results.
 */
export function applyEncodingParametersToSender(
  senderParameters: { encodings: EncodingParameters[] },
  adaptation: ThrottlerAdaptationResult,
): { encodings: EncodingParameters[] } {
  const encodings = senderParameters.encodings || [{}];

  const updatedEncodings = encodings.map((enc) => ({
    ...enc,
    maxBitrate: adaptation.targetMaxBitrateKbps * 1000, // convert kbps to bps
    scaleResolutionDownBy: adaptation.scaleResolutionDownBy,
  }));

  return { encodings: updatedEncodings };
}
