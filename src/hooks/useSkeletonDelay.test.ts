import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSkeletonDelay } from "./useSkeletonDelay";

describe("useSkeletonDelay Hook (#1736)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false initially to avoid flash on fast networks", () => {
    const { result } = renderHook(() => useSkeletonDelay(true, 200));
    expect(result.current).toBe(false);
  });

  it("returns true after the specified delayMs has elapsed", () => {
    const { result } = renderHook(() => useSkeletonDelay(true, 200));
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current).toBe(true);
  });

  it("resets to false immediately when isLoading becomes false before delay", () => {
    const { result, rerender } = renderHook(({ loading }) => useSkeletonDelay(loading, 200), {
      initialProps: { loading: true },
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);

    // Fast load finishes before 200ms
    rerender({ loading: false });

    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(result.current).toBe(false);
  });
});
