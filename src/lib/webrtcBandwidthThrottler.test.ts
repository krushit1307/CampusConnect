import { describe, it, expect } from "vitest";
import {
  evaluateWebRtcBandwidthAdaptation,
  applyEncodingParametersToSender,
  WebRtcNetworkStats,
} from "./webrtcBandwidthThrottler";

describe("Build Real-Time Audio/Visual Check Bandwidth Throttler Suite (#4493)", () => {
  it("keeps optimal encoding settings when network statistics are healthy", () => {
    const stats: WebRtcNetworkStats = { packetLossPercentage: 1.2, latencyMs: 80 };
    const adaptation = evaluateWebRtcBandwidthAdaptation(stats);

    expect(adaptation.tier).toBe("optimal");
    expect(adaptation.isVideoTrackEnabled).toBe(true);
    expect(adaptation.targetMaxBitrateKbps).toBe(2500);
    expect(adaptation.renderAudioOnlySlate).toBe(false);
  });

  it("throttles bitrate to 500kbps and scales resolution down when packetLoss > 5% or latency > 300ms", () => {
    const lossStats: WebRtcNetworkStats = { packetLossPercentage: 6.5, latencyMs: 120 };
    const lossAdaptation = evaluateWebRtcBandwidthAdaptation(lossStats);

    expect(lossAdaptation.tier).toBe("throttled_360p");
    expect(lossAdaptation.targetMaxBitrateKbps).toBe(500);
    expect(lossAdaptation.scaleResolutionDownBy).toBe(3.0);
    expect(lossAdaptation.isVideoTrackEnabled).toBe(true);

    const latencyStats: WebRtcNetworkStats = { packetLossPercentage: 2.0, latencyMs: 340 };
    const latencyAdaptation = evaluateWebRtcBandwidthAdaptation(latencyStats);
    expect(latencyAdaptation.tier).toBe("throttled_360p");
  });

  it("disables video track and activates Audio-Only slate under critical network degradation", () => {
    const criticalStats: WebRtcNetworkStats = { packetLossPercentage: 18.0, latencyMs: 650 };
    const adaptation = evaluateWebRtcBandwidthAdaptation(criticalStats);

    expect(adaptation.tier).toBe("audio_only");
    expect(adaptation.isVideoTrackEnabled).toBe(false);
    expect(adaptation.renderAudioOnlySlate).toBe(true);
    expect(adaptation.slateMessage).toBe("Presenter Audio Only (Low Bandwidth)");
  });

  it("correctly mutates sender encoding parameters object", () => {
    const adaptation = evaluateWebRtcBandwidthAdaptation({
      packetLossPercentage: 8.0,
      latencyMs: 100,
    });
    const mockSenderParams = { encodings: [{ maxBitrate: 2500000, scaleResolutionDownBy: 1.0 }] };

    const updated = applyEncodingParametersToSender(mockSenderParams, adaptation);

    expect(updated.encodings[0].maxBitrate).toBe(500000); // 500 kbps in bps
    expect(updated.encodings[0].scaleResolutionDownBy).toBe(3.0);
  });
});
