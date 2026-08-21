import { describe, it, expect } from "vitest";
import {
  calculateFpsFromDelta,
  evaluatePerformanceProfile,
  evaluateDeviceHardwareBaseline,
  LOW_FPS_THRESHOLD,
} from "./performanceProfiler";

describe("Performance Profiler Suite (#2680)", () => {
  it("calculates frame rate correctly from millisecond deltas", () => {
    expect(calculateFpsFromDelta(16.67)).toBe(60);
    expect(calculateFpsFromDelta(33.33)).toBe(30);
    expect(calculateFpsFromDelta(50)).toBe(20);
  });

  it("activates low performance mode when FPS drops below threshold", () => {
    const state = evaluatePerformanceProfile({
      fps: 22, // Below 30 FPS
      hardwareConcurrency: 8,
      isBackgroundTab: false,
    });

    expect(state.reduceAnimations).toBe(true);
    expect(state.performanceTier).toBe("LOW");
    expect(state.reason).toContain("FPS dropped below");
  });

  it("activates low performance mode on low-end multi-core hardware", () => {
    const state = evaluatePerformanceProfile({
      fps: 60,
      hardwareConcurrency: 2, // Low core count
      isBackgroundTab: false,
    });

    expect(state.reduceAnimations).toBe(true);
    expect(state.performanceTier).toBe("LOW");
    expect(state.reason).toContain("Low CPU core count");
  });

  it("ignores frame rate drops when the tab is in the background", () => {
    const state = evaluatePerformanceProfile({
      fps: 10, // Throttled background frame rate
      hardwareConcurrency: 8,
      isBackgroundTab: true, // Backgrounded tab
    });

    expect(state.reduceAnimations).toBe(false);
    expect(state.performanceTier).toBe("HIGH");
  });
});
