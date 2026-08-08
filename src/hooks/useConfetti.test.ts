import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useConfetti } from "./useConfetti";
import {
  fireConfetti,
  checkPrefersReducedMotion,
  BRAND_CONFETTI_COLORS,
} from "../lib/confettiEngine";

describe("Confetti Micro-Animation Engine (#2257)", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    // Mock window.matchMedia for prefers-reduced-motion
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false, // Reduced motion OFF by default for tests
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  it("should detect prefers-reduced-motion state correctly", () => {
    expect(checkPrefersReducedMotion()).toBe(false);

    // Toggle reduced motion ON in mock
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    expect(checkPrefersReducedMotion()).toBe(true);
  });

  it("should fire confetti particles when reduced motion is disabled", () => {
    const fired = fireConfetti({
      particleCount: 50,
      disableForReducedMotion: true,
    });

    expect(fired).toBe(true);
  });

  it("should instantly exit and return false when prefers-reduced-motion is true", () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: true,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));

    const fired = fireConfetti({
      particleCount: 50,
      disableForReducedMotion: true,
    });

    expect(fired).toBe(false);
  });

  it("should trigger dual-cannon burst pattern with 200ms right cannon delay in useConfetti hook", () => {
    const { result } = renderHook(() => useConfetti());

    act(() => {
      result.current.fireCannon();
    });

    // Verify first burst fired immediately, and 200ms timer is pending for second burst
    expect(vi.getTimerCount()).toBe(1);

    // Fast-forward 200ms to trigger right cannon
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it("should trigger celebration, fireworks, and stars presets", () => {
    const { result } = renderHook(() => useConfetti());

    act(() => {
      result.current.fireCelebration();
    });

    act(() => {
      result.current.fireStars();
    });

    act(() => {
      result.current.fireFireworks();
    });

    // Fireworks schedules 3 sequential timers
    expect(vi.getTimerCount()).toBeGreaterThanOrEqual(1);

    act(() => {
      vi.runAllTimers();
    });
  });

  it("should respect manual reducedMotionOverride state in useConfetti hook", () => {
    const { result } = renderHook(() => useConfetti());

    act(() => {
      result.current.setReducedMotionOverride(true);
    });

    act(() => {
      result.current.fireCannon();
    });

    // Timer count should be 0 because override suppressed firing
    expect(vi.getTimerCount()).toBe(0);
  });

  it("should contain brand confetti color palette", () => {
    expect(BRAND_CONFETTI_COLORS).toContain("#26ccff");
    expect(BRAND_CONFETTI_COLORS).toContain("#a25afd");
    expect(BRAND_CONFETTI_COLORS).toContain("#ff5e7e");
  });
});
