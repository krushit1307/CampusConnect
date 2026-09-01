import { describe, expect, it } from "vitest";
import {
  DEFAULT_WAYPOINTS,
  MockSpatialPositionProvider,
} from "@/lib/accessibility/mockSpatialPositionProvider";

describe("MockSpatialPositionProvider", () => {
  it("returns the configured defaults deterministically", async () => {
    const provider = new MockSpatialPositionProvider();
    await expect(provider.getUserPosition()).resolves.toEqual({ x: 0, y: 0, z: 0 });
    await expect(provider.getHeadOrientation()).resolves.toEqual({ yaw: 0, pitch: 0, roll: 0 });
    await expect(provider.getTargetPosition()).resolves.toEqual(DEFAULT_WAYPOINTS[0].position);
  });

  it("allows deterministic position and orientation changes", async () => {
    const provider = new MockSpatialPositionProvider();
    const door: SpatialPosition = { x: -5, y: 0, z: 2 };

    provider.setTargetPosition(door);
    provider.setUserPosition({ x: 0, y: 0, z: 1 });
    provider.setHeadOrientation({ yaw: -135, pitch: 0, roll: 0 });

    await expect(provider.getTargetPosition()).resolves.toEqual(door);
    await expect(provider.getUserPosition()).resolves.toEqual({ x: 0, y: 0, z: 1 });
    await expect(provider.getHeadOrientation()).resolves.toEqual({ yaw: -135, pitch: 0, roll: 0 });
  });

  it("returns copies so callers cannot mutate internal state", async () => {
    const provider = new MockSpatialPositionProvider();
    const target = await provider.getTargetPosition();
    target.x = 999;
    await expect(provider.getTargetPosition()).resolves.toEqual(DEFAULT_WAYPOINTS[0].position);
  });
});
