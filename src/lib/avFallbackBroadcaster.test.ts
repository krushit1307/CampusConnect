import { describe, it, expect } from "vitest";
import {
  evaluatePresenterPingFailure,
  executeCutToLive,
  executeCutToFallback,
} from "./avFallbackBroadcaster";

describe("Audio/Visual Check Fallback Broadcaster Utility (#4668)", () => {
  it("routes fallback slate MP4 loop when presenter ping check fails", () => {
    const state = evaluatePresenterPingFailure(false);

    expect(state.presenterPingPassed).toBe(false);
    expect(state.activeSource).toBe("fallback_slate");
    expect(state.status).toBe("broadcasting_fallback");
    expect(state.fallbackSlateUrl).toContain("starting_soon_fallback.mp4");
  });

  it("routes live WebRTC feed when presenter passes ping check", () => {
    const state = evaluatePresenterPingFailure(true);

    expect(state.presenterPingPassed).toBe(true);
    expect(state.activeSource).toBe("live_webrtc");
    expect(state.status).toBe("cut_to_live");
  });

  it("crossfades stream from fallback slate to live WebRTC feed", () => {
    const fallbackState = evaluatePresenterPingFailure(false);
    const liveState = executeCutToLive(fallbackState);

    expect(liveState.activeSource).toBe("live_webrtc");
    expect(liveState.status).toBe("cut_to_live");
    expect(liveState.crossfadeProgress).toBe(100);
  });

  it("executes emergency switch back to fallback slate", () => {
    const liveState = evaluatePresenterPingFailure(true);
    const emergencyState = executeCutToFallback(liveState);

    expect(emergencyState.activeSource).toBe("fallback_slate");
    expect(emergencyState.status).toBe("broadcasting_fallback");
  });
});
