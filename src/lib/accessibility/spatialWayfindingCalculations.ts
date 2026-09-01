/**
 * Spatial wayfinding calculations (Issue #5458).
 *
 * Pure, platform-independent math:
 *  - normalize an angle into the (-180, 180] band (handles negative angles, angles
 *    greater than 360°, and wraparound between 359° and 0°),
 *  - 3D distance between two positions,
 *  - horizontal bearing between two positions (degrees clockwise from +Y / north),
 *  - target bearing relative to the user's head orientation,
 *  - human-readable direction description for accessibility announcements.
 */

import {
  HeadOrientation,
  SpatialDirection,
  SpatialNavigationSnapshot,
  SpatialPosition,
} from "@/types/spatialWayfinding";

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Normalize an angle into the (-180, 180] band.
 * Returns NaN for non-finite input.
 */
export function normalizeAngle(deg: number): number {
  if (!Number.isFinite(deg)) return NaN;
  const wrapped = ((deg % 360) + 360) % 360; // [0, 360)
  return wrapped > 180 ? wrapped - 360 : wrapped;
}

/** Check whether a position contains only finite coordinates. */
export function isValidPosition(position: SpatialPosition | null | undefined): boolean {
  return (
    position !== null &&
    position !== undefined &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z)
  );
}

/** Straight-line (3D) distance between two positions, in meters. */
export function distanceBetween(a: SpatialPosition, b: SpatialPosition): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/**
 * Horizontal bearing from `a` to `b`, in degrees clockwise from +Y (north).
 * Returns 0 when the two positions coincide (no undefined/NaN). Inputs with
 * non-finite coordinates produce NaN.
 */
export function bearingBetween(a: SpatialPosition, b: SpatialPosition): number {
  if (!isValidPosition(a) || !isValidPosition(b)) return NaN;
  return normalizeAngle(Math.atan2(b.x - a.x, b.y - a.y) * RAD_TO_DEG);
}

/**
 * Target bearing relative to the user's head orientation, in degrees.
 * 0 = straight ahead, positive = right, negative = left, ±180 = behind.
 */
export function relativeBearing(
  target: SpatialPosition,
  user: SpatialPosition,
  head: HeadOrientation,
): number {
  if (!isValidPosition(target) || !isValidPosition(user) || !Number.isFinite(head.yaw)) return NaN;
  return normalizeAngle(bearingBetween(user, target) - head.yaw);
}

/** Coarse directional zone for the navigation state. */
export function classifyDirection(relativeBearingDeg: number): SpatialDirection {
  const abs = Math.abs(relativeBearingDeg);
  if (abs <= 45) return "ahead";
  if (abs > 135) return "behind";
  return relativeBearingDeg < 0 ? "left" : "right";
}

/**
 * Human-readable direction for accessibility announcements, e.g.
 * "directly ahead", "ahead and to your left", "to your right", "behind and to your left".
 */
export function directionDescription(relativeBearingDeg: number): string {
  const abs = Math.abs(relativeBearingDeg);
  const side = relativeBearingDeg < 0 ? "left" : "right";
  if (abs <= 30) return "directly ahead";
  if (abs <= 75) return `ahead and to your ${side}`;
  if (abs <= 135) return `to your ${side}`;
  return `behind and to your ${side}`;
}

/**
 * Build a navigation snapshot from user/target positions and head orientation.
 * Returns null when any input is missing or non-finite.
 */
export function buildNavigationSnapshot(
  target: SpatialPosition | null,
  user: SpatialPosition | null,
  head: HeadOrientation | null,
): SpatialNavigationSnapshot | null {
  if (
    !isValidPosition(target) ||
    !isValidPosition(user) ||
    head === null ||
    !Number.isFinite(head.yaw)
  ) {
    return null;
  }

  const relativeBearingDeg = relativeBearing(target, user, head);
  if (!Number.isFinite(relativeBearingDeg)) return null;

  return {
    distanceM: distanceBetween(user, target),
    relativeBearingDeg,
    direction: classifyDirection(relativeBearingDeg),
    description: directionDescription(relativeBearingDeg),
  };
}
