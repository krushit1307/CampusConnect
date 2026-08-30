export type BroadcastSource = "fallback_slate" | "live_webrtc";

export interface FallbackBroadcasterState {
  sessionId: string;
  eventId: string;
  fallbackSlateUrl: string;
  presenterPingPassed: boolean;
  activeSource: BroadcastSource;
  crossfadeProgress: number;
  status: "broadcasting_fallback" | "cut_to_live" | "offline";
  updatedAt: string;
}

const DEFAULT_SLATE_URL = "https://cdn.campus.edu/slates/starting_soon_fallback.mp4";

/**
 * Evaluates presenter readiness and automatically routes fallback MP4 loop if ping check fails (#4668).
 */
export function evaluatePresenterPingFailure(
  pingPassed: boolean,
  slateUrl: string = DEFAULT_SLATE_URL,
  eventId: string = "evt-keynote-1"
): FallbackBroadcasterState {
  const sessionId = `bsession-${Date.now()}`;
  const updatedAt = new Date().toISOString();

  if (!pingPassed) {
    return {
      sessionId,
      eventId,
      fallbackSlateUrl: slateUrl,
      presenterPingPassed: false,
      activeSource: "fallback_slate",
      crossfadeProgress: 0,
      status: "broadcasting_fallback",
      updatedAt,
    };
  }

  return {
    sessionId,
    eventId,
    fallbackSlateUrl: slateUrl,
    presenterPingPassed: true,
    activeSource: "live_webrtc",
    crossfadeProgress: 100,
    status: "cut_to_live",
    updatedAt,
  };
}

/**
 * Crossfades broadcast source from Fallback Slate MP4 to Live WebRTC Presenter feed (#4668).
 */
export function executeCutToLive(
  state: FallbackBroadcasterState
): FallbackBroadcasterState {
  return {
    ...state,
    presenterPingPassed: true,
    activeSource: "live_webrtc",
    crossfadeProgress: 100,
    status: "cut_to_live",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Emergency switch back to Fallback Slate MP4 loop (#4668).
 */
export function executeCutToFallback(
  state: FallbackBroadcasterState
): FallbackBroadcasterState {
  return {
    ...state,
    activeSource: "fallback_slate",
    crossfadeProgress: 0,
    status: "broadcasting_fallback",
    updatedAt: new Date().toISOString(),
  };
}
