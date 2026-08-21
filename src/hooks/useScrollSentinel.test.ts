import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollSentinel } from "./useScrollSentinel";

type ObserverCallback = (entries: Pick<IntersectionObserverEntry, "isIntersecting">[]) => void;

describe("useScrollSentinel", () => {
  let observeSpy: ReturnType<typeof vi.fn>;
  let disconnectSpy: ReturnType<typeof vi.fn>;
  let capturedCallback: ObserverCallback | null;
  let originalIntersectionObserver: typeof IntersectionObserver | undefined;

  beforeEach(() => {
    observeSpy = vi.fn();
    disconnectSpy = vi.fn();
    capturedCallback = null;

    originalIntersectionObserver = globalThis.IntersectionObserver;

    class MockIntersectionObserver {
      constructor(callback: ObserverCallback) {
        capturedCallback = callback;
      }

      observe = observeSpy;
      disconnect = disconnectSpy;
      unobserve = vi.fn();
      takeRecords = vi.fn(() => []);
      root = null;
      rootMargin = "";
      thresholds = [0];
    }

    // @ts-expect-error - simplified mock, not the full DOM interface
    globalThis.IntersectionObserver = MockIntersectionObserver;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver as typeof IntersectionObserver;
  });

  it("starts as false (not past the sentinel / at the top of the page)", () => {
    const sentinel = document.createElement("div");
    const ref = { current: sentinel };

    const { result } = renderHook(() => useScrollSentinel(ref));

    expect(result.current).toBe(false);
    expect(observeSpy).toHaveBeenCalledWith(sentinel);
  });

  it("flips to true once the sentinel scrolls out of view (isIntersecting: false)", () => {
    const sentinel = document.createElement("div");
    const ref = { current: sentinel };

    const { result } = renderHook(() => useScrollSentinel(ref));

    act(() => {
      capturedCallback?.([{ isIntersecting: false }]);
    });

    expect(result.current).toBe(true);
  });

  it("flips back to false once the sentinel scrolls back into view (isIntersecting: true)", () => {
    const sentinel = document.createElement("div");
    const ref = { current: sentinel };

    const { result } = renderHook(() => useScrollSentinel(ref));

    act(() => {
      capturedCallback?.([{ isIntersecting: false }]);
    });
    expect(result.current).toBe(true);

    act(() => {
      capturedCallback?.([{ isIntersecting: true }]);
    });
    expect(result.current).toBe(false);
  });

  it("disconnects the observer on unmount", () => {
    const sentinel = document.createElement("div");
    const ref = { current: sentinel };

    const { unmount } = renderHook(() => useScrollSentinel(ref));
    unmount();

    expect(disconnectSpy).toHaveBeenCalledTimes(1);
  });

  it("does nothing (and doesn't throw) when the sentinel ref isn't attached yet", () => {
    const ref = { current: null };

    const { result } = renderHook(() => useScrollSentinel(ref));

    expect(result.current).toBe(false);
    expect(observeSpy).not.toHaveBeenCalled();
  });
});
