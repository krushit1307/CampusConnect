import { describe, it, expect } from "vitest";
import { calculateAspectRatioFit } from "./imageCompressor";

describe("imageCompressor utility (#1435)", () => {
  it("returns original dimensions if image is within max limits", () => {
    const result = calculateAspectRatioFit(1200, 800, 1920, 1080);
    expect(result).toEqual({ width: 1200, height: 800 });
  });

  it("scales down large width image preserving aspect ratio", () => {
    const result = calculateAspectRatioFit(3840, 2160, 1920, 1080);
    expect(result).toEqual({ width: 1920, height: 1080 });
  });

  it("scales down tall portrait image preserving aspect ratio", () => {
    const result = calculateAspectRatioFit(2000, 4000, 1920, 1080);
    expect(result.height).toBe(1080);
    expect(result.width).toBe(540);
  });
});
