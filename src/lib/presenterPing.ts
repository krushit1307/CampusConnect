/**
 * Real-Time "Audio/Visual Check" Presenter Ping Core Library (#4526)
 * Handles payload generation, response evaluation, timeout state transitions,
 * and audio chime synthesis for presenter behavioral readiness verification.
 */

export type PresenterPingStatus = "idle" | "pinged" | "confirmed_ready" | "awol";

export interface PresenterPingPayload {
  eventId: string;
  presenterId: string;
  pingId: string;
  timestamp: number;
  timeoutSeconds: number;
}

export interface PresenterPingResponsePayload {
  eventId: string;
  presenterId: string;
  pingId: string;
  confirmed: boolean;
  responseTimeMs: number;
}

export interface PresenterState {
  id: string;
  name: string;
  avatarUrl?: string | null;
  connectionState: "connected" | "disconnected" | "checking" | "failed";
  pingStatus: PresenterPingStatus;
  activePingId?: string | null;
  lastPingedAt?: number | null;
  confirmedAt?: number | null;
  timeoutAt?: number | null;
  failureReason?: string | null;
}

export const DEFAULT_PING_TIMEOUT_SECONDS = 15;

/**
 * Creates a unique WebSocket/Realtime ping payload targeting a specific presenter.
 */
export function createPresenterPingPayload(
  eventId: string,
  presenterId: string,
  timeoutSeconds = DEFAULT_PING_TIMEOUT_SECONDS,
  pingId?: string,
): PresenterPingPayload {
  return {
    eventId,
    presenterId,
    pingId: pingId || `ping_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    timeoutSeconds,
  };
}

/**
 * Creates a response payload when the presenter confirms readiness.
 */
export function createPresenterPingResponse(
  ping: PresenterPingPayload,
  confirmed = true,
  now = Date.now(),
): PresenterPingResponsePayload {
  return {
    eventId: ping.eventId,
    presenterId: ping.presenterId,
    pingId: ping.pingId,
    confirmed,
    responseTimeMs: Math.max(0, now - ping.timestamp),
  };
}

/**
 * Applies a newly sent ping to a presenter's state.
 */
export function applyPresenterPing(
  presenter: PresenterState,
  ping: PresenterPingPayload,
): PresenterState {
  const timeoutAt = ping.timestamp + ping.timeoutSeconds * 1000;
  return {
    ...presenter,
    pingStatus: "pinged",
    activePingId: ping.pingId,
    lastPingedAt: ping.timestamp,
    timeoutAt,
    failureReason: null,
  };
}

/**
 * Processes an incoming confirmation response from a presenter.
 */
export function handlePresenterPingResponse(
  presenter: PresenterState,
  response: PresenterPingResponsePayload,
): PresenterState {
  if (presenter.id !== response.presenterId) {
    return presenter;
  }

  // If the response matches an active ping and is confirmed
  if (response.confirmed) {
    return {
      ...presenter,
      pingStatus: "confirmed_ready",
      confirmedAt: Date.now(),
      activePingId: null,
      failureReason: null,
    };
  }

  return {
    ...presenter,
    pingStatus: "awol",
    activePingId: null,
    failureReason: "Presenter declined or failed readiness check.",
  };
}

/**
 * Evaluates whether a pinged presenter has exceeded the timeout and transitioned to AWOL.
 */
export function evaluatePresenterPingTimeout(
  presenter: PresenterState,
  currentTime = Date.now(),
): PresenterState {
  if (presenter.pingStatus !== "pinged" || !presenter.timeoutAt) {
    return presenter;
  }

  if (currentTime >= presenter.timeoutAt) {
    return {
      ...presenter,
      pingStatus: "awol",
      activePingId: null,
      failureReason: `Presenter did not respond within ${DEFAULT_PING_TIMEOUT_SECONDS} seconds (AWOL).`,
    };
  }

  return presenter;
}

/**
 * Calculates remaining seconds in the countdown for an active ping.
 */
export function calculateRemainingSeconds(
  timeoutAt?: number | null,
  currentTime = Date.now(),
): number {
  if (!timeoutAt) return 0;
  const diffMs = timeoutAt - currentTime;
  return Math.max(0, Math.ceil(diffMs / 1000));
}

/**
 * Checks if a presenter state requires preparing or triggering the fallback broadcaster slate.
 */
export function shouldTriggerFallbackOnAwol(presenter: PresenterState): boolean {
  return presenter.pingStatus === "awol";
}

/**
 * Synthesizes an audible alert chime using the Web Audio API.
 * Uses a crisp two-tone ascending chime (e.g. C5 -> G5) to alert the presenter urgently.
 */
export function playPresenterPingChime(customAudioCtx?: AudioContext): boolean {
  try {
    const AudioContextClass =
      typeof window !== "undefined"
        ? window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null;

    if (!customAudioCtx && !AudioContextClass) return false;

    const ctx = customAudioCtx || (AudioContextClass ? new AudioContextClass() : null);
    if (!ctx) return false;

    if (ctx.state === "suspended") {
      void ctx.resume();
    }

    const now = ctx.currentTime;

    // First tone (523.25 Hz - C5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone (783.99 Hz - G5) with slight delay for pleasant but urgent chime
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(783.99, now + 0.15);
    gain2.gain.setValueAtTime(0.35, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.15);
    osc2.stop(now + 0.6);

    return true;
  } catch (error) {
    console.warn("Could not play audio chime:", error);
    return false;
  }
}
