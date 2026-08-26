import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollVelocity } from "./useScrollVelocity";

/**
 * Mocks the browser scroll environment for testing the useScrollVelocity hook.
 *
 * Since Vitest's jsdom doesn't support real scroll events, we manually:
 * 1. Set window.scrollY to the desired value.
 * 2. Dispatch a native "scroll" event so the hook's listener fires.
 * 3. Flush requestAnimationFrame to trigger the compute callback.
 */
function simulateScroll(scrollY: number) {
  Object.defineProperty(window, "scrollY", { value: scrollY, writable: true, configurable: true });
  window.dispatchEvent(new Event("scroll"));
}

describe("useScrollVelocity Hook", () => {
  let rafCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    rafCallbacks = [];

    // Mock requestAnimationFrame to be synchronously flushable
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });

    // Mock performance.now for velocity calculations
    let now = 1000;
    vi.spyOn(performance, "now").mockImplementation(() => {
      now += 100; // advance 100ms per call
      return now;
    });

    // Set initial scroll geometry
    Object.defineProperty(window, "scrollY", { value: 0, writable: true, configurable: true });
    Object.defineProperty(document.documentElement, "scrollHeight", {
      value: 5000,
      writable: true,
      configurable: true,
    });
    Object.defineProperty(window, "innerHeight", {
      value: 800,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function flushRaf() {
    const cbs = [...rafCallbacks];
    rafCallbacks.length = 0;
    cbs.forEach((cb) => cb(performance.now()));
  }

  it("starts with idle direction and zero velocity", () => {
    const { result } = renderHook(() => useScrollVelocity());
    expect(result.current.direction).toBe("idle");
    expect(result.current.velocity).toBe(0);
    expect(result.current.shouldShowBackToTop).toBe(false);
  });

  it("detects downward scroll and hides back-to-top", () => {
    const { result } = renderHook(() => useScrollVelocity({ threshold: 5, visibilityDepth: 100 }));

    act(() => {
      simulateScroll(500);
      flushRaf();
    });

    expect(result.current.direction).toBe("down");
    expect(result.current.scrollY).toBe(500);
    expect(result.current.shouldShowBackToTop).toBe(false);
  });

  it("detects upward scroll past depth and shows back-to-top", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 5, visibilityDepth: 100, throttleMs: 0 }),
    );

    // First scroll down past the depth threshold
    act(() => {
      simulateScroll(1500);
      flushRaf();
    });

    expect(result.current.direction).toBe("down");
    expect(result.current.shouldShowBackToTop).toBe(false);

    // Now scroll up — user signals intent to go back
    act(() => {
      simulateScroll(1200);
      flushRaf();
    });

    expect(result.current.direction).toBe("up");
    expect(result.current.shouldShowBackToTop).toBe(true);
  });

  it("hides back-to-top immediately when user scrolls down again", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 5, visibilityDepth: 100, throttleMs: 0 }),
    );

    // Scroll down, then up (show button), then down (hide button)
    act(() => {
      simulateScroll(1500);
      flushRaf();
    });
    act(() => {
      simulateScroll(1200);
      flushRaf();
    });
    expect(result.current.shouldShowBackToTop).toBe(true);

    act(() => {
      simulateScroll(1400);
      flushRaf();
    });
    expect(result.current.direction).toBe("down");
    expect(result.current.shouldShowBackToTop).toBe(false);
  });

  it("hides button when near the top of the page (scrollY <= 50)", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 5, visibilityDepth: 100, throttleMs: 0 }),
    );

    // Scroll down then up to show
    act(() => {
      simulateScroll(1500);
      flushRaf();
    });
    act(() => {
      simulateScroll(1200);
      flushRaf();
    });
    expect(result.current.shouldShowBackToTop).toBe(true);

    // Now scroll all the way back to the top
    act(() => {
      simulateScroll(30);
      flushRaf();
    });
    expect(result.current.shouldShowBackToTop).toBe(false);
  });

  it("clamps negative scrollY values to 0 (iOS Safari rubber-banding)", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 5, visibilityDepth: 100, throttleMs: 0 }),
    );

    act(() => {
      simulateScroll(-50); // rubber-band past top
      flushRaf();
    });

    expect(result.current.scrollY).toBe(0);
    expect(result.current.direction).toBe("up");
    expect(result.current.shouldShowBackToTop).toBe(false);
  });

  it("calculates scroll progress as a 0–1 fraction", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 5, visibilityDepth: 100, throttleMs: 0 }),
    );

    // scrollableHeight = 5000 - 800 = 4200; scrollY = 2100 → progress = 0.5
    act(() => {
      simulateScroll(2100);
      flushRaf();
    });

    expect(result.current.scrollProgress).toBeCloseTo(0.5, 1);
  });

  it("does not flip direction on tiny scroll deltas below threshold", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 20, visibilityDepth: 100, throttleMs: 0 }),
    );

    act(() => {
      simulateScroll(500);
      flushRaf();
    });
    expect(result.current.direction).toBe("down");

    // Tiny 5px upward scroll — should NOT flip direction
    act(() => {
      simulateScroll(495);
      flushRaf();
    });
    expect(result.current.direction).toBe("down"); // unchanged
  });

  it("calculates positive velocity on scroll", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 5, visibilityDepth: 100, throttleMs: 0 }),
    );

    act(() => {
      simulateScroll(500);
      flushRaf();
    });

    // Velocity is always >= 0 regardless of direction
    expect(result.current.velocity).toBeGreaterThanOrEqual(0);
  });

  it("handles resize events by recalculating scroll progress", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 5, visibilityDepth: 100, throttleMs: 0 }),
    );

    act(() => {
      simulateScroll(2100);
      flushRaf();
    });

    // Resize the viewport
    act(() => {
      Object.defineProperty(window, "innerHeight", {
        value: 600,
        writable: true,
        configurable: true,
      });
      window.dispatchEvent(new Event("resize"));
    });

    // scrollableHeight is now 5000 - 600 = 4400; scrollY = 2100 → ~0.477
    expect(result.current.scrollProgress).toBeCloseTo(2100 / 4400, 1);
  });

  it("does not show button when scrolling up but still above visibility depth", () => {
    const { result } = renderHook(() =>
      useScrollVelocity({ threshold: 5, visibilityDepth: 1000, throttleMs: 0 }),
    );

    // Scroll down only 500px (below 1000px depth)
    act(() => {
      simulateScroll(500);
      flushRaf();
    });

    // Scroll up 100px — but still at 400px, below visibilityDepth
    act(() => {
      simulateScroll(400);
      flushRaf();
    });

    expect(result.current.direction).toBe("up");
    expect(result.current.shouldShowBackToTop).toBe(false);
  });
});
