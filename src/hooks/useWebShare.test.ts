import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWebShare } from "./useWebShare";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useWebShare", () => {
  it("detects navigator.share availability", () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
    const { result } = renderHook(() => useWebShare());
    expect(result.current.canShare).toBe(true);
  });

  it("detects when navigator.share is unavailable", () => {
    // Remove "share" from navigator entirely so "share" in navigator is false
    const { share: _removed, ...navigatorWithoutShare } = navigator as unknown as Record<
      string,
      unknown
    >;
    vi.stubGlobal("navigator", navigatorWithoutShare);
    const { result } = renderHook(() => useWebShare());
    expect(result.current.canShare).toBe(false);
    vi.unstubAllGlobals();
  });

  it("returns success when navigator.share resolves", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    const shareResult = await result.current.share({
      title: "Test",
      text: "Check this out",
      url: "https://example.com",
    });

    expect(shareResult).toEqual({ kind: "success" });
  });

  it("returns abort when user cancels share", async () => {
    const abortError = new Error("User cancelled");
    abortError.name = "AbortError";
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(abortError),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    const shareResult = await result.current.share({
      title: "Test",
      text: "Check this out",
      url: "https://example.com",
    });

    expect(shareResult).toEqual({ kind: "abort" });
  });

  it("returns error when navigator.share throws", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockRejectedValue(new Error("Share failed")),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn().mockReturnValue(true),
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    const shareResult = await result.current.share({
      title: "Test",
      text: "Check this out",
      url: "https://example.com",
    });

    expect(shareResult).toEqual({ kind: "error", error: expect.any(Error) });
    expect((shareResult as { kind: "error"; error: Error }).error.message).toBe("Share failed");
  });

  it("returns unavailable when canShare is false", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: vi.fn().mockReturnValue(false),
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    const shareResult = await result.current.share({
      title: "Test",
      text: "Check this out",
      url: "https://example.com",
    });

    expect(shareResult).toEqual({ kind: "unavailable" });
  });

  it("returns unavailable when navigator.share is not available", async () => {
    Object.defineProperty(navigator, "share", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    const shareResult = await result.current.share({
      title: "Test",
      text: "Check this out",
      url: "https://example.com",
    });

    expect(shareResult).toEqual({ kind: "unavailable" });
  });

  it("works without navigator.canShare", async () => {
    Object.defineProperty(navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(navigator, "canShare", {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    const shareResult = await result.current.share({
      title: "Test",
      text: "Check this out",
      url: "https://example.com",
    });

    expect(shareResult).toEqual({ kind: "success" });
  });

  it("copies text to clipboard", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    let success = false;
    await act(async () => {
      success = await result.current.copyToClipboard("https://example.com");
    });

    expect(success).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("https://example.com");
  });

  it("tracks copied state", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    expect(result.current.copied).toBe(false);

    await act(async () => {
      await result.current.copyToClipboard("https://example.com");
    });

    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.copied).toBe(false);
    vi.useRealTimers();
  });

  it("returns false when clipboard write fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("Clipboard error")) },
      configurable: true,
      writable: true,
    });

    const { result } = renderHook(() => useWebShare());
    let success = true;
    await act(async () => {
      success = await result.current.copyToClipboard("https://example.com");
    });

    expect(success).toBe(false);
  });
});
