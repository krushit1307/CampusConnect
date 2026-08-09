import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateEquirectangularAspectRatio,
  isWebGlSupported,
  convertAnglesToSphereVector,
} from "./virtualTour";

describe("Interactive Virtual Venue Tour Suite (#2685)", () => {
  beforeEach(() => {
    vi.stubGlobal("document", {
      createElement: vi.fn().mockReturnValue({
        getContext: vi.fn().mockReturnValue({}),
      }),
    });
    vi.stubGlobal("window", {
      WebGLRenderingContext: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("validates 2:1 aspect ratio for 360 equirectangular images", () => {
    expect(validateEquirectangularAspectRatio({ width: 4000, height: 2000 })).toBe(true);
    expect(validateEquirectangularAspectRatio({ width: 1920, height: 1080 })).toBe(false); // 16:9 -> false
  });

  it("detects WebGL support in browser context", () => {
    expect(isWebGlSupported()).toBe(true);
  });

  it("converts orientation pitch/yaw angles into 3D Cartesian coordinates", () => {
    // 0 deg pitch, 0 deg yaw -> Look straight ahead along Z axis
    const forwardVec = convertAnglesToSphereVector({ pitch: 0, yaw: 0 });
    expect(forwardVec.x).toBe(0);
    expect(forwardVec.y).toBe(0);
    expect(forwardVec.z).toBe(1);

    // 90 deg pitch (looking straight up) -> positive Y axis
    const topVec = convertAnglesToSphereVector({ pitch: 89.9, yaw: 0 });
    expect(topVec.y).toBeGreaterThan(0.99);
  });
});
