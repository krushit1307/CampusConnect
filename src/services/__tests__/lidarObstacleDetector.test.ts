import { describe, it, expect, beforeEach } from "vitest";
import { LiDARObstacleDetector } from "../lidarObstacleDetector";
import { LiDARFrame, LiDARPoint } from "@/types/lidarWayfinding";

describe("LiDARObstacleDetector", () => {
  let detector: LiDARObstacleDetector;

  beforeEach(() => {
    detector = new LiDARObstacleDetector({
      maxDetectionDistanceMeters: 4.0,
      immediateHazardDistanceMeters: 1.5,
      warningDistanceMeters: 3.0,
      corridorWidthMeters: 1.2,
      minClusterPoints: 3,
    });
  });

  it("returns null when frame contains no points", () => {
    const frame: LiDARFrame = { timestamp: Date.now(), points: [] };
    expect(detector.detectObstacle(frame)).toBeNull();
  });

  it("returns null when points are flat floor surface below ground clearance threshold", () => {
    // Ground floor points around y = -1.35m
    const floorPoints: LiDARPoint[] = [
      { x: 0, y: -1.35, z: 1.0 },
      { x: 0.2, y: -1.34, z: 1.2 },
      { x: -0.2, y: -1.36, z: 1.5 },
      { x: 0.1, y: -1.35, z: 2.0 },
    ];
    const frame: LiDARFrame = { timestamp: Date.now(), points: floorPoints };
    expect(detector.detectObstacle(frame)).toBeNull();
  });

  it("detects an immediate hazard when an obstacle cluster is within 1.5 meters", () => {
    const obstaclePoints: LiDARPoint[] = [
      { x: 0.1, y: -0.8, z: 1.1 },
      { x: 0.2, y: -0.6, z: 1.12 },
      { x: 0.0, y: -0.4, z: 1.08 },
      { x: -0.1, y: -0.5, z: 1.1 },
    ];
    const frame: LiDARFrame = { timestamp: Date.now(), points: obstaclePoints };
    const result = detector.detectObstacle(frame);

    expect(result).not.toBeNull();
    expect(result?.severity).toBe("immediate_hazard");
    expect(result?.distanceMeters).toBe(1.08);
    expect(result?.speechDescription).toContain("Obstacle detected");
  });

  it("recommends moving left when an obstacle is positioned to the right", () => {
    const rightObstaclePoints: LiDARPoint[] = [
      { x: 0.35, y: -0.5, z: 1.2 },
      { x: 0.45, y: -0.6, z: 1.2 },
      { x: 0.55, y: -0.7, z: 1.2 },
    ];
    const frame: LiDARFrame = { timestamp: Date.now(), points: rightObstaclePoints };
    const result = detector.detectObstacle(frame);

    expect(result).not.toBeNull();
    expect(result?.recommendedDirection).toBe("left");
    expect(result?.speechDescription).toContain("Move two steps to the left");
  });

  it("recommends moving right when an obstacle is positioned to the left", () => {
    const leftObstaclePoints: LiDARPoint[] = [
      { x: -0.35, y: -0.5, z: 1.2 },
      { x: -0.45, y: -0.6, z: 1.2 },
      { x: -0.55, y: -0.7, z: 1.2 },
    ];
    const frame: LiDARFrame = { timestamp: Date.now(), points: leftObstaclePoints };
    const result = detector.detectObstacle(frame);

    expect(result).not.toBeNull();
    expect(result?.recommendedDirection).toBe("right");
    expect(result?.speechDescription).toContain("Move two steps to the right");
  });

  it("classifies warning severity for obstacles between 1.5m and 3.0m", () => {
    const warningPoints: LiDARPoint[] = [
      { x: 0.0, y: -0.5, z: 2.2 },
      { x: 0.1, y: -0.6, z: 2.2 },
      { x: -0.1, y: -0.7, z: 2.2 },
    ];
    const frame: LiDARFrame = { timestamp: Date.now(), points: warningPoints };
    const result = detector.detectObstacle(frame);

    expect(result).not.toBeNull();
    expect(result?.severity).toBe("warning");
    expect(result?.distanceMeters).toBe(2.2);
  });
});
