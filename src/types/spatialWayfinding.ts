/**
 * Spatial wayfinding types (Issue #5458).
 *
 * Platform-independent spatial-positioning abstractions for acoustic wayfinding.
 * Coordinates use meters in a local venue space: +X = east, +Y = north, +Z = up.
 * Yaw is measured in degrees clockwise from +Y (north).
 *
 * The `SpatialPositionProvider` interface is deliberately platform-independent.
 * A mock provider supplies simulated positioning; a future native UWB provider can
 * implement the same interface to source real ranging data.
 */

export interface SpatialPosition {
  x: number;
  y: number;
  z: number;
}

export interface HeadOrientation {
  /** Degrees clockwise from north. */
  yaw: number;
  /** Degrees up (+). Optional; unused by the horizontal wayfinding math. */
  pitch?: number;
  /** Degrees of roll. Optional; reserved for future native head tracking. */
  roll?: number;
}

export interface SpatialPositionProvider {
  getTargetPosition(): Promise<SpatialPosition | null>;
  getUserPosition(): Promise<SpatialPosition | null>;
  getHeadOrientation(): Promise<HeadOrientation | null>;
}

export interface SpatialTarget {
  id: string;
  label: string;
  position: SpatialPosition;
}

export type SpatialDirection = "ahead" | "left" | "right" | "behind";

export interface SpatialNavigationSnapshot {
  /** Straight-line distance from user to target, in meters. */
  distanceM: number;
  /** Target bearing relative to the user's head yaw, normalized to (-180, 180]. */
  relativeBearingDeg: number;
  direction: SpatialDirection;
  /** Human-readable status line, e.g. "ahead and to your left". */
  description: string;
}

export type SpatialWayfindingStatus = "idle" | "starting" | "navigating" | "stopped" | "error";
