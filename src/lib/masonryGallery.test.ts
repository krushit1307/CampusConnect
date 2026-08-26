import { describe, it, expect } from "vitest";
import { calculateMasonry, type MasonryItem } from "../hooks/useMasonry";

describe("calculateMasonry math layout", () => {
  const sampleItems: MasonryItem[] = [
    { id: "img-1", url: "url-1", width: 800, height: 400 }, // Aspect ratio: 400/800 = 0.5 (Wide)
    { id: "img-2", url: "url-2", width: 800, height: 1600 }, // Aspect ratio: 1600/800 = 2.0 (Very tall)
    { id: "img-3", url: "url-3", width: 800, height: 800 }, // Aspect ratio: 800/800 = 1.0 (Square)
    { id: "img-4", url: "url-4", width: 800, height: 600 }, // Aspect ratio: 600/800 = 0.75
    { id: "img-5", url: "url-5", width: 800, height: 1200 }, // Aspect ratio: 1200/800 = 1.5
    { id: "img-6", url: "url-6", width: 800, height: 400 }, // Aspect ratio: 400/800 = 0.5
  ];

  it("distributes exactly 3 columns by default", () => {
    const result = calculateMasonry(sampleItems, 3);
    expect(result.length).toBe(3);
  });

  it("places images in the currently shortest column mathematically", () => {
    const columns = calculateMasonry(sampleItems, 3);

    // Manual step-by-step trace:
    // Initial column heights: [0, 0, 0]
    // 1. img-1 (aspect 0.5): placed in Col 0. heights: [0.5, 0, 0]
    // 2. img-2 (aspect 2.0): placed in Col 1. heights: [0.5, 2.0, 0]
    // 3. img-3 (aspect 1.0): placed in Col 2. heights: [0.5, 2.0, 1.0]
    // 4. img-4 (aspect 0.75): placed in Col 0 (shortest at 0.5). heights: [1.25, 2.0, 1.0]
    // 5. img-5 (aspect 1.5): placed in Col 2 (shortest at 1.0). heights: [1.25, 2.0, 2.5]
    // 6. img-6 (aspect 0.5): placed in Col 0 (shortest at 1.25). heights: [1.75, 2.0, 2.5]

    // Column 0 should have: img-1, img-4, img-6
    expect(columns[0].map((x) => x.id)).toEqual(["img-1", "img-4", "img-6"]);
    // Column 1 should have: img-2
    expect(columns[1].map((x) => x.id)).toEqual(["img-2"]);
    // Column 2 should have: img-3, img-5
    expect(columns[2].map((x) => x.id)).toEqual(["img-3", "img-5"]);
  });

  it("preserves intrinsic image dimensions metadata in distributed columns", () => {
    const columns = calculateMasonry(sampleItems, 3);

    // Check metadata fields
    expect(columns[0][0].width).toBe(800);
    expect(columns[0][0].height).toBe(400);
    expect(columns[1][0].width).toBe(800);
    expect(columns[1][0].height).toBe(1600);
  });
});
