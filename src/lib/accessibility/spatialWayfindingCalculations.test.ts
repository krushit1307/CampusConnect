import { describe, expect, it } from "vitest";
import {
  bearingBetween,
  buildNavigationSnapshot,
  classifyDirection,
  directionDescription,
  distanceBetween,
  isValidPosition,
  normalizeAngle,
  relativeBearing,
} from "@/lib/accessibility/spatialWayfindingCalculations";
import { HeadOrientation, SpatialPosition } from "@/types/spatialWayfinding";

const user: SpatialPosition = { x: 0, y: 0, z: 0 };
const head: HeadOrientation = { yaw: 0, pitch: 0, roll: 0 };

describe("normalizeAngle", () => {
  it("keeps 0°, 45°, 90°, 180° themselves", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(45)).toBe(45);
    expect(normalizeAngle(90)).toBe(90);
    expect(normalizeAngle(180)).toBe(180);
  });

  it("normalizes angles greater than 360° and large positive values", () => {
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(720)).toBe(0);
    expect(normalizeAngle(405)).toBe(45);
  });

  it("normalizes negative angles into (-180, 180]", () => {
    expect(normalizeAngle(-90)).toBe(-90);
    expect(normalizeAngle(-180)).toBe(180);
    expect(normalizeAngle(-270)).toBe(90);
    expect(normalizeAngle(-450)).toBe(-90);
  });

  it("wraps between 359° and 0° correctly", () => {
    expect(normalizeAngle(359)).toBe(-1);
    expect(normalizeAngle(361)).toBe(1);
    expect(normalizeAngle(-1)).toBe(-1);
  });

  it("returns NaN only for non-finite input", () => {
    expect(Number.isNaN(normalizeAngle(Number.NaN))).toBe(true);
    expect(Number.isNaN(normalizeAngle(Number.POSITIVE_INFINITY))).toBe(true);
  });
});

describe("isValidPosition", () => {
  it("accepts finite coordinates and rejects missing/non-finite ones", () => {
    expect(isValidPosition({ x: 0, y: 0, z: 0 })).toBe(true);
    expect(isValidPosition(null)).toBe(false);
    expect(isValidPosition(undefined)).toBe(false);
    expect(isValidPosition({ x: Number.NaN, y: 0, z: 0 })).toBe(false);
    expect(isValidPosition({ x: 0, y: Number.POSITIVE_INFINITY, z: 0 })).toBe(false);
  });
});

describe("distanceBetween", () => {
  it("computes 3D distance for a normal diagonal target", () => {
    expect(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 5, y: 0, z: 5 })).toBeCloseTo(
      Math.sqrt(50),
      5,
    );
  });

  it("returns 0 for coincident positions (zero distance)", () => {
    expect(distanceBetween({ x: 3, y: -2, z: 1 }, { x: 3, y: -2, z: 1 })).toBe(0);
  });

  it("includes vertical (z) difference in the 3D distance", () => {
    expect(distanceBetween({ x: 0, y: 0, z: 0 }, { x: 0, y: 3, z: 4 })).toBe(5);
  });
});

describe("bearingBetween", () => {
  it("straight ahead (due north, +Y)", () => {
    expect(bearingBetween(user, { x: 0, y: 5, z: 0 })).toBe(0);
  });

  it("right (due east, +X) is +90°", () => {
    expect(bearingBetween(user, { x: 5, y: 0, z: 0 })).toBe(90);
  });

  it("left (due west, -X) is -90°", () => {
    expect(bearingBetween(user, { x: -5, y: 0, z: 0 })).toBe(-90);
  });

  it("behind (due south, -Y) is ±180°", () => {
    expect(Math.abs(bearingBetween(user, { x: 0, y: -5, z: 0 }))).toBe(180);
  });

  it("diagonal target at due north-east is 45°", () => {
    expect(bearingBetween(user, { x: 5, y: 5, z: 0 })).toBeCloseTo(45, 5);
  });

  it("returns 0 for coincident positions (no NaN)", () => {
    expect(bearingBetween(user, { x: 0, y: 0, z: 0 })).toBe(0);
  });

  it("returns NaN for invalid input", () => {
    expect(Number.isNaN(bearingBetween(user, { x: Number.NaN, y: 0, z: 0 }))).toBe(true);
  });
});

describe("relativeBearing", () => {
  it("is 0 when the head faces the target directly", () => {
    expect(relativeBearing({ x: 0, y: 5, z: 0 }, user, head)).toBe(0);
  });

  it("shifts left when the head turns right", () => {
    // Target due north; turning head 90° right puts the target 90° to the left.
    expect(relativeBearing({ x: 0, y: 5, z: 0 }, user, { yaw: 90 })).toBe(-90);
  });

  it("wraps around 359°/0°", () => {
    // Target bearing 350° (almost north-west), head bearing 10° -> target is -20° to the left.
    const target = {
      x: -Math.sin((10 * Math.PI) / 180) * 10,
      y: Math.cos((10 * Math.PI) / 180) * 10,
      z: 0,
    };
    expect(normalizeAngle(bearingBetween(user, target))).toBeCloseTo(-10, 3);
    expect(relativeBearing(target, user, { yaw: 10 })).toBeCloseTo(-20, 3);
  });

  it("behind target is ±180°", () => {
    expect(Math.abs(relativeBearing({ x: 0, y: -5, z: 0 }, user, head))).toBe(180);
  });
});

describe("classifyDirection and directionDescription", () => {
  it("ahead within ±45°", () => {
    expect(classifyDirection(0)).toBe("ahead");
    expect(classifyDirection(30)).toBe("ahead");
    expect(directionDescription(30)).toBe("directly ahead");
  });

  it("diagonal target is ahead + side", () => {
    expect(classifyDirection(45)).toBe("ahead");
    expect(directionDescription(45)).toBe("ahead and to your right");
    expect(directionDescription(-45)).toBe("ahead and to your left");
  });

  it("right / left sides", () => {
    expect(classifyDirection(90)).toBe("right");
    expect(directionDescription(90)).toBe("to your right");
    expect(classifyDirection(-90)).toBe("left");
    expect(directionDescription(-90)).toBe("to your left");
  });

  it("behind", () => {
    expect(classifyDirection(180)).toBe("behind");
    expect(classifyDirection(-170)).toBe("behind");
    expect(directionDescription(180)).toBe("behind and to your right");
    expect(directionDescription(-180)).toBe("behind and to your left");
  });
});

describe("buildNavigationSnapshot", () => {
  it("produces a snapshot for a straight-ahead target", () => {
    const s = buildNavigationSnapshot({ x: 0, y: 6, z: 0 }, user, head);
    expect(s).not.toBeNull();
    expect(s?.distanceM).toBeCloseTo(6, 5);
    expect(s?.relativeBearingDeg).toBe(0);
    expect(s?.direction).toBe("ahead");
  });

  it("handles zero distance without NaN", () => {
    const s = buildNavigationSnapshot(user, user, head);
    expect(s?.distanceM).toBe(0);
    expect(Number.isFinite(s?.relativeBearingDeg)).toBe(true);
  });

  it("returns null for missing or invalid inputs", () => {
    expect(buildNavigationSnapshot(null, user, head)).toBeNull();
    expect(buildNavigationSnapshot({ x: 0, y: 5, z: 0 }, null, head)).toBeNull();
    expect(buildNavigationSnapshot({ x: 0, y: 5, z: 0 }, user, null)).toBeNull();
    expect(buildNavigationSnapshot({ x: Number.NaN, y: 5, z: 0 }, user, head)).toBeNull();
  });
});
