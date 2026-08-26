import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import {
  useBannerColor,
  getLuminance,
  ensureLegibleRGB,
  createBannerGradient,
  rgbToHex,
  DEFAULT_FALLBACK_RGB,
} from "./useBannerColor";

describe("useBannerColor Hook (#1744)", () => {
  it("returns default fallback RGB when no image URL is provided", () => {
    const { result } = renderHook(() => useBannerColor(null));

    expect(result.current.rgb).toEqual(DEFAULT_FALLBACK_RGB);
    expect(result.current.hex).toBe(rgbToHex(...DEFAULT_FALLBACK_RGB));
    expect(result.current.gradientStyle).toContain("linear-gradient");
    expect(result.current.isLoading).toBe(false);
  });

  it("calculates WCAG luminance correctly", () => {
    // Pure black
    expect(getLuminance(0, 0, 0)).toBe(0);
    // Pure white
    expect(getLuminance(255, 255, 255)).toBe(255);
  });

  it("darkens bright colors to ensure legible contrast for white text", () => {
    // Bright yellow (luminance ~225)
    const [r, g, b] = ensureLegibleRGB(255, 255, 0, 140);
    const newLuminance = getLuminance(r, g, b);

    expect(newLuminance).toBeLessThanOrEqual(140);
  });

  it("generates clean CSS linear-gradient string", () => {
    const gradient = createBannerGradient(134, 45, 200, 0.55);

    expect(gradient).toContain("linear-gradient");
    expect(gradient).toContain("rgba(134, 45, 200");
  });
});
