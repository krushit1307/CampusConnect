// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MockSpatialPositionProvider } from "@/lib/accessibility/mockSpatialPositionProvider";
import { SpatialAudioBeacon } from "@/lib/accessibility/spatialAudioBeacon";
import { useSpatialWayfinding } from "@/hooks/useSpatialWayfinding";

function createFakeBeacon() {
  const beacon = {
    isRunning: false,
    start: vi.fn(async () => {
      beacon.isRunning = true;
      return true;
    }),
    stop: vi.fn(() => {
      beacon.isRunning = false;
    }),
    setPosition: vi.fn(),
    setVolume: vi.fn(),
  };
  return beacon as unknown as SpatialAudioBeacon;
}

describe("useSpatialWayfinding", () => {
  let provider: MockSpatialPositionProvider;
  let beacon: ReturnType<typeof createFakeBeacon>;

  beforeEach(() => {
    provider = new MockSpatialPositionProvider();
    provider.setUserPosition({ x: 0, y: 0, z: 0 });
    provider.setTargetPosition({ x: 5, y: 5, z: 0 });
    provider.setHeadOrientation({ yaw: 0, pitch: 0, roll: 0 });
    beacon = createFakeBeacon();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("reports idle with no snapshot before starting", () => {
    const { result } = renderHook(() => useSpatialWayfinding({ provider, beacon }));
    expect(result.current.status).toBe("idle");
    expect(result.current.snapshot).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it("starts navigation, computes the snapshot and feeds the beacon", async () => {
    const { result } = renderHook(() =>
      useSpatialWayfinding({ provider, beacon, pollIntervalMs: 50 }),
    );

    await act(async () => {
      await result.current.startNavigation();
    });

    expect(result.current.status).toBe("navigating");
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot?.distanceM).toBeCloseTo(Math.sqrt(50), 3);
    expect(result.current.snapshot?.description).toBe("ahead and to your right");
    expect(beacon.start).toHaveBeenCalledTimes(1);
    expect(beacon.setPosition).toHaveBeenCalled();
  });

  it("does not create a second audio start while already navigating", async () => {
    const { result } = renderHook(() => useSpatialWayfinding({ provider, beacon }));

    await act(async () => {
      await result.current.startNavigation();
      await result.current.startNavigation();
    });

    expect(beacon.start).toHaveBeenCalledTimes(1);
  });

  it("updates the snapshot when the provider reports a new target", async () => {
    const { result } = renderHook(() =>
      useSpatialWayfinding({ provider, beacon, pollIntervalMs: 50 }),
    );

    await act(async () => {
      await result.current.startNavigation();
      provider.setTargetPosition({ x: 5, y: 0, z: 0 });
    });

    await waitFor(() => {
      expect(result.current.snapshot?.distanceM).toBeCloseTo(5, 1);
    });
    expect(result.current.snapshot?.description).toBe("to your right");
  });

  it("reflects a head turn via the provider", async () => {
    const { result } = renderHook(() =>
      useSpatialWayfinding({ provider, beacon, pollIntervalMs: 50 }),
    );

    await act(async () => {
      await result.current.startNavigation();
      provider.setHeadOrientation({ yaw: 90, pitch: 0, roll: 0 });
    });

    await waitFor(() => {
      expect(result.current.snapshot?.relativeBearingDeg).toBeCloseTo(-45, 1);
    });
  });

  it("surfaces invalid position data as an error without crashing", async () => {
    const badProvider = {
      getTargetPosition: async () => ({ x: Number.NaN, y: 0, z: 0 }),
      getUserPosition: async () => ({ x: 0, y: 0, z: 0 }),
      getHeadOrientation: async () => ({ yaw: 0 }),
    };
    const { result } = renderHook(() => useSpatialWayfinding({ provider: badProvider, beacon }));

    await act(async () => {
      await result.current.startNavigation();
    });

    expect(result.current.status).toBe("navigating");
    expect(result.current.error).toBeTruthy();
    expect(result.current.snapshot).toBeNull();
  });

  it("surfaces provider failures as an error without crashing", async () => {
    const failingProvider = {
      getTargetPosition: async () => {
        throw new Error("provider unavailable");
      },
      getUserPosition: async () => ({ x: 0, y: 0, z: 0 }),
      getHeadOrientation: async () => ({ yaw: 0 }),
    };
    const { result } = renderHook(() =>
      useSpatialWayfinding({ provider: failingProvider, beacon }),
    );

    await act(async () => {
      await result.current.startNavigation();
    });

    expect(result.current.error).toBeTruthy();
  });

  it("stops cleanly: beacon stopped, timers cleared, snapshot reset", async () => {
    const { result } = renderHook(() =>
      useSpatialWayfinding({ provider, beacon, pollIntervalMs: 50 }),
    );

    await act(async () => {
      await result.current.startNavigation();
    });

    await act(async () => {
      result.current.stopNavigation();
    });

    expect(result.current.status).toBe("stopped");
    expect(result.current.snapshot).toBeNull();
    expect(beacon.stop).toHaveBeenCalledTimes(1);
  });

  it("releases resources (beacon + timers) on unmount", async () => {
    const { result, unmount } = renderHook(() =>
      useSpatialWayfinding({ provider, beacon, pollIntervalMs: 50 }),
    );

    await act(async () => {
      await result.current.startNavigation();
    });
    expect(beacon.stop).not.toHaveBeenCalled();

    unmount();

    expect(beacon.stop).toHaveBeenCalledTimes(1);
  });
});
