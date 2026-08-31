/**
 * LiDAR Obstacle Detector Engine (Issue #5142).
 *
 * Inspects forward frustum point-cloud frames, filters out flat ground surface,
 * detects physical hazards in walking corridor, computes distance & hazard severity,
 * and recommends safe detour direction (left vs right).
 */

import {
  HazardSeverity,
  LidarObstacle,
  LiDARFrame,
  LiDARPoint,
  ObstacleDetectionConfig,
  SafeDirection,
} from "@/types/lidarWayfinding";

export const DEFAULT_DETECTION_CONFIG: ObstacleDetectionConfig = {
  maxDetectionDistanceMeters: 4.0,
  immediateHazardDistanceMeters: 1.5,
  warningDistanceMeters: 3.0,
  corridorWidthMeters: 1.2,
  minGroundClearanceMeters: 0.1, // Points >10cm above ground floor
  maxObstacleHeightMeters: 2.0,
  minClusterPoints: 4,
};

export class LiDARObstacleDetector {
  private config: ObstacleDetectionConfig;

  constructor(config: Partial<ObstacleDetectionConfig> = {}) {
    this.config = { ...DEFAULT_DETECTION_CONFIG, ...config };
  }

  /**
   * Evaluates a single LiDAR frame and returns the most relevant hazard obstacle (if any).
   */
  public detectObstacle(frame: LiDARFrame): LidarObstacle | null {
    if (!frame.points || frame.points.length === 0) {
      return null;
    }

    const groundY = -1.35; // Standard camera height ground reference (~1.35m down)

    // 1. Filter points in the forward walking corridor
    const hazardPoints = frame.points.filter((pt) => {
      // Must be within max forward distance
      if (pt.z <= 0.1 || pt.z > this.config.maxDetectionDistanceMeters) return false;

      // Must be within walking corridor width (x offset)
      if (Math.abs(pt.x) > this.config.corridorWidthMeters / 2 + 0.3) return false;

      // Must be elevated above ground floor (filter out floor surface)
      const heightAboveGround = pt.y - groundY;
      if (heightAboveGround < this.config.minGroundClearanceMeters) return false;

      // Must not exceed max overhead height
      if (heightAboveGround > this.config.maxObstacleHeightMeters) return false;

      return true;
    });

    if (hazardPoints.length < this.config.minClusterPoints) {
      return null;
    }

    // 2. Compute closest point and spatial extent
    let minDistance = Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let sumX = 0;

    hazardPoints.forEach((pt) => {
      if (pt.z < minDistance) minDistance = pt.z;
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
      sumX += pt.x;
    });

    const avgX = sumX / hazardPoints.length;
    const width = Math.max(0.3, maxX - minX);
    const height = Math.max(0.3, maxY - minY);

    // 3. Classify hazard severity
    let severity: HazardSeverity = "none";
    if (minDistance <= this.config.immediateHazardDistanceMeters) {
      severity = "immediate_hazard";
    } else if (minDistance <= this.config.warningDistanceMeters) {
      severity = "warning";
    }

    if (severity === "none") {
      return null;
    }

    // 4. Determine lateral position relative to path
    let position: "center" | "left" | "right" = "center";
    if (avgX < -0.2) position = "left";
    else if (avgX > 0.2) position = "right";

    // 5. Calculate safe direction recommendation
    const recommendedDirection = this.calculateSafeDirection(avgX, hazardPoints, frame.points);

    // 6. Calculate relative angle in degrees
    const relativeAngleDegrees = Math.round((Math.atan2(avgX, minDistance) * 180) / Math.PI);

    // 7. Format speech description
    const speechDescription = this.formatSpeechWarning(minDistance, recommendedDirection, position);

    return {
      id: `obstacle_${Math.round(minDistance * 10)}_${Date.now()}`,
      distanceMeters: Number(minDistance.toFixed(2)),
      relativeAngleDegrees,
      widthMeters: Number(width.toFixed(2)),
      heightMeters: Number(height.toFixed(2)),
      position,
      severity,
      recommendedDirection,
      speechDescription,
    };
  }

  /**
   * Determines whether left or right side has more clearance for detour.
   */
  public calculateSafeDirection(
    avgX: number,
    hazardPoints: LiDARPoint[],
    allPoints: LiDARPoint[],
  ): SafeDirection {
    // If obstacle is shifted right, move left
    if (avgX > 0.15) {
      return "left";
    }
    // If obstacle is shifted left, move right
    if (avgX < -0.15) {
      return "right";
    }

    // Centered obstacle: evaluate point density on left vs right side
    const leftClearancePoints = allPoints.filter(
      (pt) => pt.x >= -1.5 && pt.x < -0.3 && pt.z < 2.5,
    ).length;
    const rightClearancePoints = allPoints.filter(
      (pt) => pt.x > 0.3 && pt.x <= 1.5 && pt.z < 2.5,
    ).length;

    return leftClearancePoints <= rightClearancePoints ? "left" : "right";
  }

  /**
   * Formats concise, actionable TTS audio warning string for visually impaired users.
   */
  public formatSpeechWarning(
    distanceMeters: number,
    direction: SafeDirection,
    position: "center" | "left" | "right",
  ): string {
    const distStep = Math.max(1, Math.round(distanceMeters / 0.75)); // Convert meters to steps (~0.75m per step)
    const stepText = distStep === 1 ? "1 step" : `${distStep} steps`;

    if (direction === "left") {
      return `Obstacle detected at ground level ${stepText} ahead. Move two steps to the left.`;
    } else if (direction === "right") {
      return `Obstacle detected at ground level ${stepText} ahead. Move two steps to the right.`;
    } else {
      return `Obstacle detected ${stepText} ahead. Stop immediately.`;
    }
  }
}

export const lidarObstacleDetector = new LiDARObstacleDetector();
