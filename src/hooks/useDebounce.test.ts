import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDebounce } from "./useDebounce";

// Alias jest to vi for compatibility with Jest-based test specifications
const jest = vi;

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("should return the initial value immediately upon mount", () => {
    const { result } = renderHook(() => useDebounce("initial", 500));
    expect(result.current).toBe("initial");
  });

  it("should execute the hook in isolation and not update debounced value before delay (e.g. 400ms)", () => {
    let value = "initial";
    const { result, rerender } = renderHook(() => useDebounce(value, 500));

    expect(result.current).toBe("initial");

    // Update the value passed to the hook
    value = "updated";
    rerender();

    // Advance fake timers by 400ms (less than delay of 500ms) within act
    act(() => {
      jest.advanceTimersByTime(400);
    });

    // Assert that result.current has NOT updated yet
    expect(result.current).toBe("initial");
  });

  it("should update debounced value after fake timers advance past the delay threshold (500ms)", () => {
    let value = "initial";
    const { result, rerender } = renderHook(() => useDebounce(value, 500));

    value = "updated";
    rerender();

    // Advance by 400ms
    act(() => {
      jest.advanceTimersByTime(400);
    });
    expect(result.current).toBe("initial");

    // Advance timers past the threshold (100ms remaining to reach 500ms)
    act(() => {
      jest.advanceTimersByTime(100);
    });

    // Assert that result.current HAS updated
    expect(result.current).toBe("updated");
  });

  it("should reset timer when value changes before delay threshold", () => {
    let value = "first";
    const { result, rerender } = renderHook(() => useDebounce(value, 500));

    value = "second";
    rerender();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("first");

    // Change value again before timer finishes
    value = "third";
    rerender();

    act(() => {
      jest.advanceTimersByTime(300);
    });
    // 300ms after 'third', timer has not reached 500ms
    expect(result.current).toBe("first");

    act(() => {
      jest.advanceTimersByTime(200);
    });
    // 500ms after 'third'
    expect(result.current).toBe("third");
  });

  it("should clear timeouts on unmount cleanup", () => {
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    let value = "initial";
    const { rerender, unmount } = renderHook(() => useDebounce(value, 500));

    value = "updated";
    rerender();

    // Unmount the hook
    unmount();

    // Verify unmount cleanup logic cleared the timeout
    expect(clearTimeoutSpy).toHaveBeenCalled();

    // Advancing timers after unmount should not trigger any state update warnings
    act(() => {
      jest.advanceTimersByTime(600);
    });

    clearTimeoutSpy.mockRestore();
  });
});
