import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCopyToClipboard } from "./useCopyToClipboard";

describe("useCopyToClipboard", () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: originalClipboard,
    });
    vi.useRealTimers();
  });

  it("uses the modern Clipboard API when available", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      expect(await result.current.copyToClipboard("event-link")).toBe(true);
    });

    expect(writeText).toHaveBeenCalledWith("event-link");
    expect(result.current.isCopied).toBe(true);
  });

  it("falls back to execCommand when Clipboard API is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    const execCommand = vi.spyOn(document, "execCommand").mockImplementation(() => {
      expect(document.querySelector("textarea")?.value).toBe("invite-code");
      return true;
    });
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      expect(await result.current.copyToClipboard("invite-code")).toBe(true);
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(document.querySelector("textarea")).toBeNull();
  });

  it("falls back to execCommand when Clipboard API rejects", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("Permission denied")) },
    });
    const execCommand = vi.spyOn(document, "execCommand").mockReturnValue(true);
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      expect(await result.current.copyToClipboard("club-id")).toBe(true);
    });

    expect(execCommand).toHaveBeenCalledWith("copy");
  });

  it("resets copied state after two seconds", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copyToClipboard("event-link");
    });
    expect(result.current.isCopied).toBe(true);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.isCopied).toBe(false);
  });

  it("resets copied state after custom timeout duration", async () => {
    vi.useFakeTimers();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    const { result } = renderHook(() => useCopyToClipboard(5000));

    await act(async () => {
      await result.current.copyToClipboard("event-link-custom");
    });
    expect(result.current.isCopied).toBe(true);

    act(() => vi.advanceTimersByTime(2000));
    expect(result.current.isCopied).toBe(true);

    act(() => vi.advanceTimersByTime(3000));
    expect(result.current.isCopied).toBe(false);
  });
});
