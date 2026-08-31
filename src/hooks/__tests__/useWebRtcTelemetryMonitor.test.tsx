import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useWebRtcTelemetryMonitor } from "../useWebRtcTelemetryMonitor";
import { supabase } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({
  supabase: {
    functions: {
      invoke: vi.fn(),
    },
  },
}));

describe("Build a 'Real-Time \"Audio/Visual Check\" Latency Monitor' Suite (#4426)", () => {
  let mockPc: any;

  beforeEach(() => {
    vi.useFakeTimers();
    mockPc = {
      connectionState: "connected",
      getStats: vi.fn().mockResolvedValue(new Map()),
    };
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  it("continuously polls getStats every 3 seconds", async () => {
    renderHook(() => useWebRtcTelemetryMonitor(mockPc as RTCPeerConnection, "evt-1"));
    expect(mockPc.getStats).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockPc.getStats).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(mockPc.getStats).toHaveBeenCalledTimes(2);
  });

  it("detects poor connection if latency > 300ms", async () => {
    const statsMap = new Map([
      ["1", { type: "candidate-pair", state: "succeeded", currentRoundTripTime: 0.4 }], // 400ms
    ]);
    mockPc.getStats.mockResolvedValue(statsMap);

    const { result } = renderHook(() =>
      useWebRtcTelemetryMonitor(mockPc as RTCPeerConnection, "evt-1"),
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.latency).toBe(400);
    expect(result.current.isPoorConnection).toBe(true);
  });

  it("detects poor connection if packet loss > 5%", async () => {
    const statsMap = new Map([
      ["1", { type: "remote-inbound-rtp", kind: "video", fractionLost: 0.06 }], // 6%
    ]);
    mockPc.getStats.mockResolvedValue(statsMap);

    const { result } = renderHook(() =>
      useWebRtcTelemetryMonitor(mockPc as RTCPeerConnection, "evt-1"),
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.packetLoss).toBe(6);
    expect(result.current.isPoorConnection).toBe(true);
  });

  it("triggers Fallback Broadcaster when connection drops", async () => {
    mockPc.connectionState = "failed";
    const { result } = renderHook(() =>
      useWebRtcTelemetryMonitor(mockPc as RTCPeerConnection, "evt-1"),
    );

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    expect(result.current.isDropped).toBe(true);
    expect(supabase.functions.invoke).toHaveBeenCalledWith("broadcast-failover", {
      body: { eventId: "evt-1", reason: "Connection dropped entirely" },
    });
  });
});
