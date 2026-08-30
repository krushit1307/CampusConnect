/**
 * Types for LiDAR Obstacle Avoidance & Acoustic Wayfinding (Issue #5142).
 */

export type HazardSeverity = "none" | "warning" | "immediate_hazard";

export type SafeDirection = "straight" | "left" | "right" | "stop";

export interface LiDARPoint {
  /** X offset in meters relative to device (positive = right, negative = left) */
  x: number;
  /** Y offset in meters relative to device ground height (positive = above ground) */
  y: number;
  /** Z distance in meters forward from device sensor */
  z: number;
  /** Optional confidence score (0 to 1) */
  confidence?: number;
}

export interface LiDARFrame {
  timestamp: number;
  points: LiDARPoint[];
  deviceHeightMeters?: number;
}

export interface LidarObstacle {
  id: string;
  /** Distance in meters to closest surface point */
  distanceMeters: number;
  /** Lateral angle relative to center line (-90 to +90 degrees) */
  relativeAngleDegrees: number;
  /** Estimated obstacle width in meters */
  widthMeters: number;
  /** Estimated height relative to ground in meters */
  heightMeters: number;
  /** Position classification relative to walking path */
  position: "center" | "left" | "right";
  /** Severity based on distance & path intersection */
  severity: HazardSeverity;
  /** Recommended safe direction adjustment */
  recommendedDirection: SafeDirection;
  /** Description for TTS speech output */
  speechDescription: string;
}

export interface ObstacleDetectionConfig {
  /** Maximum forward distance to consider an obstacle (meters). Default: 4.0 */
  maxDetectionDistanceMeters: number;
  /** Immediate hazard distance triggering safety override (meters). Default: 1.5 */
  immediateHazardDistanceMeters: number;
  /** Warning distance threshold (meters). Default: 3.0 */
  warningDistanceMeters: number;
  /** Walking path corridor width (meters). Default: 1.2 */
  corridorWidthMeters: number;
  /** Ground height threshold to filter out flat floor surface (meters). Default: 0.05 */
  minGroundClearanceMeters: number;
  /** Maximum obstacle height to consider (meters). Default: 2.0 */
  maxObstacleHeightMeters: number;
  /** Min points required to classify a cluster as an obstacle. Default: 5 */
  minClusterPoints: number;
}

export interface AcousticWayfindingState {
  isNavigating: boolean;
  isLidarActive: boolean;
  lidarSupported: boolean;
  permissionGranted: boolean;
  currentVenueId: string | null;
  currentVenueName: string | null;
  userPosition: { x: number; y: number; label?: string } | null;
  targetDestination: string | null;
  currentInstruction: string | null;
  activeObstacle: LidarObstacle | null;
  hazardSeverity: HazardSeverity;
  safetyOverrideActive: boolean;
  lastVoiceWarningTime: number;
  errorMessage: string | null;
}

export interface WayfindingAudioConfig {
  speechEnabled: boolean;
  hapticsEnabled: boolean;
  speechRate: number; // Default 1.0
  speechVolume: number; // Default 1.0
  voiceCooldownMs: number; // Default 4000ms
}
