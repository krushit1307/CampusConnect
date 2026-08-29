import { describe, it, expect, vi } from "vitest";
import {
  createPresenterPingPayload,
  createPresenterPingResponse,
  applyPresenterPing,
  handlePresenterPingResponse,
  evaluatePresenterPingTimeout,
  calculateRemainingSeconds,
  shouldTriggerFallbackOnAwol,
  playPresenterPingChime,
  PresenterState,
  DEFAULT_PING_TIMEOUT_SECONDS,
} from "./presenterPing";

describe("Real-Time 'Audio/Visual Check' Presenter Ping Suite (#4526)", () => {
  const mockPresenter: PresenterState = {
    id: "presenter-123",
    name: "Dr. Jane Doe",
    avatarUrl: "https://example.com/avatar.jpg",
    connectionState: "connected",
    pingStatus: "idle",
  };

  it("creates a properly structured ping payload with 15s default timeout", () => {
    const payload = createPresenterPingPayload("event-456", "presenter-123");
    expect(payload.eventId).toBe("event-456");
    expect(payload.presenterId).toBe("presenter-123");
    expect(payload.timeoutSeconds).toBe(15);
    expect(payload.pingId).toMatch(/^ping_/);
    expect(payload.timestamp).toBeGreaterThan(0);
  });

  it("applies a sent ping to presenter state and marks status as 'pinged'", () => {
    const payload = createPresenterPingPayload("event-456", "presenter-123", 15, "ping-custom-1");
    const pingedState = applyPresenterPing(mockPresenter, payload);

    expect(pingedState.pingStatus).toBe("pinged");
    expect(pingedState.activePingId).toBe("ping-custom-1");
    expect(pingedState.lastPingedAt).toBe(payload.timestamp);
    expect(pingedState.timeoutAt).toBe(payload.timestamp + 15000);
  });

  it("handles a confirmed readiness response and transitions status to 'confirmed_ready'", () => {
    const payload = createPresenterPingPayload("event-456", "presenter-123", 15, "ping-custom-1");
    const pingedState = applyPresenterPing(mockPresenter, payload);

    const response = createPresenterPingResponse(payload, true, payload.timestamp + 3500);
    expect(response.confirmed).toBe(true);
    expect(response.responseTimeMs).toBe(3500);

    const readyState = handlePresenterPingResponse(pingedState, response);
    expect(readyState.pingStatus).toBe("confirmed_ready");
    expect(readyState.confirmedAt).toBeDefined();
    expect(readyState.activePingId).toBeNull();
    expect(readyState.failureReason).toBeNull();
  });

  it("flags presenter as AWOL if 15 seconds expire without confirmation", () => {
    const now = 1000000;
    const payload = {
      eventId: "event-456",
      presenterId: "presenter-123",
      pingId: "ping-custom-1",
      timestamp: now,
      timeoutSeconds: 15,
    };
    const pingedState = applyPresenterPing(mockPresenter, payload);

    // Before 15 seconds (10s elapsed)
    const stillActive = evaluatePresenterPingTimeout(pingedState, now + 10000);
    expect(stillActive.pingStatus).toBe("pinged");

    // After 15 seconds (16s elapsed)
    const awolState = evaluatePresenterPingTimeout(pingedState, now + 16000);
    expect(awolState.pingStatus).toBe("awol");
    expect(awolState.activePingId).toBeNull();
    expect(awolState.failureReason).toContain("AWOL");
  });

  it("calculates accurate remaining countdown seconds", () => {
    const now = 1000000;
    const timeoutAt = now + 15000;

    expect(calculateRemainingSeconds(timeoutAt, now)).toBe(15);
    expect(calculateRemainingSeconds(timeoutAt, now + 5000)).toBe(10);
    expect(calculateRemainingSeconds(timeoutAt, now + 14100)).toBe(1);
    expect(calculateRemainingSeconds(timeoutAt, now + 15000)).toBe(0);
    expect(calculateRemainingSeconds(timeoutAt, now + 16000)).toBe(0);
  });

  it("determines when to trigger fallback broadcaster on AWOL", () => {
    expect(shouldTriggerFallbackOnAwol({ ...mockPresenter, pingStatus: "idle" })).toBe(false);
    expect(shouldTriggerFallbackOnAwol({ ...mockPresenter, pingStatus: "pinged" })).toBe(false);
    expect(shouldTriggerFallbackOnAwol({ ...mockPresenter, pingStatus: "confirmed_ready" })).toBe(
      false,
    );
    expect(shouldTriggerFallbackOnAwol({ ...mockPresenter, pingStatus: "awol" })).toBe(true);
  });

  it("synthesizes audio chime using Web Audio API", () => {
    const mockGainNode = {
      gain: {
        setValueAtTime: vi.fn(),
        exponentialRampToValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
    };

    const mockOscillatorNode = {
      type: "sine",
      frequency: {
        setValueAtTime: vi.fn(),
      },
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };

    const mockAudioContext = {
      state: "running",
      currentTime: 0,
      createOscillator: vi.fn().mockReturnValue(mockOscillatorNode),
      createGain: vi.fn().mockReturnValue(mockGainNode),
      destination: {},
      resume: vi.fn(),
    } as unknown as AudioContext;

    const played = playPresenterPingChime(mockAudioContext);
    expect(played).toBe(true);
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(2);
    expect(mockAudioContext.createGain).toHaveBeenCalledTimes(2);
    expect(mockOscillatorNode.start).toHaveBeenCalledTimes(2);
    expect(mockOscillatorNode.stop).toHaveBeenCalledTimes(2);
  });
});
