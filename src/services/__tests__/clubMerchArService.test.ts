import { describe, it, expect } from "vitest";
import { calculateChestPlacement } from "../clubMerchArService";

describe("clubMerchArService - AR Torso/Chest Alignment Math", () => {
  it("calculates chest coordinates proportionally below the tracked face", () => {
    const faceBox = { x: 100, y: 50, width: 80, height: 100 };
    const canvasWidth = 640;
    const canvasHeight = 480;

    const chest = calculateChestPlacement(faceBox, canvasWidth, canvasHeight, 1.0, 0.0);

    // Head center X = 100 + 40 = 140
    // Chest width = 80 * 1.8 = 144
    // Chest X = 140 - 72 = 68
    expect(chest.x).toBe(68);
    expect(chest.width).toBe(144);

    // Base chest Y = 50 + 100 * 1.4 = 190
    expect(chest.y).toBe(190);
  });

  it("scales chest and logo dynamically as scale factor changes (e.g. user moves closer or further)", () => {
    const faceBox = { x: 200, y: 100, width: 100, height: 120 };
    const canvasWidth = 800;
    const canvasHeight = 600;

    const scaledUp = calculateChestPlacement(faceBox, canvasWidth, canvasHeight, 1.5, 0.0);
    const normal = calculateChestPlacement(faceBox, canvasWidth, canvasHeight, 1.0, 0.0);

    expect(scaledUp.width).toBeGreaterThan(normal.width);
    expect(scaledUp.width).toBe(Math.round(100 * 1.8 * 1.5));
  });

  it("clamps coordinates within canvas bounds to prevent out-of-bounds rendering", () => {
    const faceBox = { x: 550, y: 400, width: 150, height: 150 };
    const canvasWidth = 640;
    const canvasHeight = 480;

    const chest = calculateChestPlacement(faceBox, canvasWidth, canvasHeight, 1.0, 0.0);
    expect(chest.x + chest.width).toBeLessThanOrEqual(canvasWidth);
    expect(chest.y + chest.height).toBeLessThanOrEqual(canvasHeight);
  });
});
