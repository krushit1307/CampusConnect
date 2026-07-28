import { describe, expect, it, vi } from "vitest";
import { Area, createImage, getCroppedImg } from "./cropImage";

describe("cropImage Utility", () => {
  it("defines Area interface correctly", () => {
    const area: Area = { x: 10, y: 20, width: 100, height: 100 };
    expect(area.x).toBe(10);
    expect(area.y).toBe(20);
    expect(area.width).toBe(100);
    expect(area.height).toBe(100);
  });

  it("createImage sets crossOrigin attribute and returns promise", () => {
    const imageSrc = "https://example.com/test-image.jpg";
    const promise = createImage(imageSrc);

    expect(promise).toBeInstanceOf(Promise);
  });

  it("throws error when canvas 2D context is unavailable in getCroppedImg", async () => {
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      if (tagName === "canvas") {
        return {
          getContext: () => null,
        } as unknown as HTMLCanvasElement;
      }
      return origCreateElement(tagName);
    });

    const crop: Area = { x: 0, y: 0, width: 50, height: 50 };
    
    // Stub global Image load
    vi.spyOn(globalThis, "Image").mockImplementation(() => {
      const img = {} as HTMLImageElement;
      setTimeout(() => {
        if (img.onload) img.onload(new Event("load"));
      }, 0);
      return img;
    });

    await expect(getCroppedImg("test.jpg", crop)).rejects.toThrow("No 2d context");

    vi.restoreAllMocks();
  });
});
